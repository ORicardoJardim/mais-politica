// api/super-list-orgs.js
import { userClient, serviceClient } from './_utils.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // precisa ser super admin
  const supa = userClient(req)
  const { data: isSuper } = await supa.rpc('is_super_admin')
  if (!isSuper) return res.status(403).json({ error: 'Sem permissão (super admin requerido)' })

  const svc = serviceClient()
  const { data, error } = await svc
    .from('orgs')
    .select('id, name, stripe_customer_id, created_at')
    .order('created_at', { ascending: false })

  if (error) return res.status(400).json({ error: error.message })
  return res.status(200).json({ orgs: data || [] })
}
