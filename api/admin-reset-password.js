// api/admin-reset-password.js
import { assertAdmin, serviceClient } from './_utils'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { id, password } = req.body || {}
  if (!id || !password) return res.status(400).json({ error: 'id e password são obrigatórios' })

  const check = await assertAdmin(req)
  if (!check.ok) return res.status(check.status).json({ error: check.msg })

  const svc = serviceClient()
  const { data, error } = await svc.auth.admin.updateUserById(id, { password })
  if (error) return res.status(400).json({ error: error.message })
  return res.status(200).json({ ok: true, userId: data.user?.id })
}
