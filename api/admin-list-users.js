// api/admin-list-users.js
import { assertAdmin } from './_utils'
import { serviceClient } from './_utils'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const check = await assertAdmin(req)
  if (!check.ok) return res.status(check.status).json({ error: check.msg })

  // perfis (id, name, email, role, created_at)
  const svc = serviceClient()
  const { data, error } = await svc.from('profiles')
    .select('id, name, email, role, created_at')
    .order('created_at', { ascending: false })

  if (error) return res.status(400).json({ error: error.message })
  return res.status(200).json({ users: data })
}
