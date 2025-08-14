// api/admin-update-user.js
import { assertAdmin, serviceClient } from './_utils'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { id, name, email, role } = req.body || {}

  if (!id) return res.status(400).json({ error: 'id é obrigatório' })
  if (role && !['user','admin'].includes(role)) return res.status(400).json({ error: 'role inválida' })

  const check = await assertAdmin(req)
  if (!check.ok) return res.status(check.status).json({ error: check.msg })

  const svc = serviceClient()
  const { error } = await svc.from('profiles')
    .update({ name, email, role })
    .eq('id', id)

  if (error) return res.status(400).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
