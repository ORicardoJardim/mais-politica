// api/super.js
import { userClient, serviceClient } from './_utils.js'

export default async function handler(req, res) {
  const supa = userClient(req)
  const svc = serviceClient()

  const url = new URL(req.url, 'http://x')
  const action = url.searchParams.get('action') // list_orgs|delete_org

  const { data: isSuper } = await supa.rpc('is_super_admin')
  if (!isSuper) return res.status(403).json({ error: 'Sem permissão (super admin)' })

  if (action === 'list_orgs') {
    const { data, error } = await svc
      .from('orgs').select('id, name, stripe_customer_id, created_at').order('created_at', { ascending: false })
    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ orgs: data || [] })
  }

  if (action === 'delete_org') {
    const org_id = url.searchParams.get('org_id') || req.body?.org_id
    if (!org_id) return res.status(400).json({ error: 'org_id é obrigatório' })
    await svc.from('demandas').delete().eq('org_id', org_id).catch(()=>{})
    await svc.from('invites').delete().eq('org_id', org_id).catch(()=>{})
    await svc.from('memberships').delete().eq('org_id', org_id).catch(()=>{})
    const { error } = await svc.from('orgs').delete().eq('id', org_id)
    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(400).json({ error: 'action inválida' })
}
