// api/admin-list-users.js
import { assertAdmin, serviceClient } from './_utils.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const check = await assertAdmin(req)
    if (!check.ok) return res.status(check.status).json({ error: check.msg })

    const supa = serviceClient()
    const { data, error } = await supa
      .from('profiles')
      .select('id, name, email, role, created_at')
      .order('created_at', { ascending: false })

    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ users: data })
  } catch (e) {
    console.error('admin-list-users failed:', e)
    return res.status(500).json({ error: e.message || 'Internal error' })
  }
}
