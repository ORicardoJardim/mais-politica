// api/org-create.js
import { userClient, serviceClient } from './_utils.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supa = userClient(req)
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  const { name } = req.body || {}
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' })

  const svc = serviceClient()

  // cria org
  const { data: org, error: oErr } = await svc
    .from('orgs')
    .insert({ name: name.trim() })
    .select('id')
    .single()
  if (oErr) return res.status(400).json({ error: oErr.message })

  // vincula usuário como admin
  const { error: mErr } = await svc
    .from('memberships')
    .insert({ org_id: org.id, user_id: user.id, role: 'admin' })
  if (mErr) return res.status(400).json({ error: mErr.message })

  return res.status(200).json({ ok: true, org_id: org.id })
}
