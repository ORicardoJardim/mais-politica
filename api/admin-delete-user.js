// api/admin-delete-user.js
import { assertAdmin, serviceClient } from './_utils'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { id } = req.body || {}
  if (!id) return res.status(400).json({ error: 'id é obrigatório' })

  const check = await assertAdmin(req)
  if (!check.ok) return res.status(check.status).json({ error: check.msg })

  const svc = serviceClient()
  // remove user da Auth
  const { error: aErr } = await svc.auth.admin.deleteUser(id)
  if (aErr) return res.status(400).json({ error: aErr.message })
  // remove profile (se sobrou)
  await svc.from('profiles').delete().eq('id', id)

  return res.status(200).json({ ok: true })
}
