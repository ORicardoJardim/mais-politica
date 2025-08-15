// api/admin.js
import { userClient, serviceClient } from './_utils.js'

export default async function handler(req, res) {
  const supaUser = userClient(req)
  const svc = serviceClient()

  try {
    const url = new URL(req.url, 'http://x') // base dummy
    const action = url.searchParams.get('action') // list|create|update|remove|reset

    if (action === 'list') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
      const org_id = url.searchParams.get('org_id')
      if (!org_id) return res.status(400).json({ error: 'org_id é obrigatório' })
      const { data: isAdmin } = await supaUser.rpc('is_org_admin', { p_org: org_id })
      if (!isAdmin) return res.status(403).json({ error: 'Sem permissão' })
      const { data, error } = await svc
        .from('memberships')
        .select('user:profiles(id, name, email, created_at), role, user_id')
        .eq('org_id', org_id)
        .order('created_at', { ascending: false })
      if (error) return res.status(400).json({ error: error.message })
      const users = (data || []).map(m => ({
        id: m.user_id, name: m.user?.name ?? null, email: m.user?.email ?? null,
        role: m.role, created_at: m.user?.created_at ?? null,
      }))
      return res.status(200).json({ users })
    }

    if (action === 'create') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
      const { name, email, password, role, org_id } = req.body || {}
      if (!email || !password || !org_id || !role) {
        return res.status(400).json({ error: 'email, password, role e org_id são obrigatórios' })
      }
      const { data: isAdmin } = await supaUser.rpc('is_org_admin', { p_org: org_id })
      if (!isAdmin) return res.status(403).json({ error: 'Sem permissão' })
      // cria o usuário no auth
      const { data: created, error: cErr } = await svc.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { name }
      })
      if (cErr) return res.status(400).json({ error: cErr.message })
      const uid = created.user?.id
      // vincula ao gabinete com role
      const { error: mErr } = await svc
        .from('memberships')
        .upsert({ org_id, user_id: uid, role }, { onConflict: 'org_id,user_id' })
      if (mErr) return res.status(400).json({ error: mErr.message })
      return res.status(200).json({ ok: true })
    }

    if (action === 'update') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
      const { id: targetUserId, role, org_id } = req.body || {}
      if (!targetUserId || !role || !org_id) return res.status(400).json({ error: 'id, role e org_id são obrigatórios' })
      const { data: isAdmin } = await supaUser.rpc('is_org_admin', { p_org: org_id })
      if (!isAdmin) return res.status(403).json({ error: 'Sem permissão' })
      const { error: mErr } = await svc
        .from('memberships')
        .upsert({ org_id, user_id: targetUserId, role }, { onConflict: 'org_id,user_id' })
      if (mErr) return res.status(400).json({ error: mErr.message })
      return res.status(200).json({ ok: true })
    }

    if (action === 'remove') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
      const { id: targetUserId, org_id } = req.body || {}
      if (!targetUserId || !org_id) return res.status(400).json({ error: 'id e org_id são obrigatórios' })
      const { data: isAdmin } = await supaUser.rpc('is_org_admin', { p_org: org_id })
      if (!isAdmin) return res.status(403).json({ error: 'Sem permissão' })
      const { data: adminsCount, error: cErr } = await svc
        .from('memberships')
        .select('user_id', { count: 'exact', head: true })
        .eq('org_id', org_id).eq('role', 'admin')
      if (cErr) return res.status(400).json({ error: cErr.message })
      const { data: target, error: tErr } = await svc
        .from('memberships').select('role').eq('org_id', org_id).eq('user_id', targetUserId).single()
      if (tErr) return res.status(400).json({ error: tErr.message })
      if (target?.role === 'admin' && (adminsCount?.count ?? 0) <= 1) {
        return res.status(400).json({ error: 'Não é possível remover o único admin do gabinete.' })
      }
      const { error: dErr } = await svc
        .from('memberships').delete().eq('org_id', org_id).eq('user_id', targetUserId)
      if (dErr) return res.status(400).json({ error: dErr.message })
      return res.status(200).json({ ok: true })
    }

    if (action === 'reset') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
      const { id, password } = req.body || {}
      if (!id || !password) return res.status(400).json({ error: 'id e password são obrigatórios' })
      // só super admin ou o próprio admin do gabinete deveriam usar; aqui deixamos livre para super admin:
      const { data: isSuper } = await supaUser.rpc('is_super_admin')
      if (!isSuper) return res.status(403).json({ error: 'Somente super admin' })
      const { error } = await svc.auth.admin.updateUserById(id, { password })
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'action inválida' })
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Erro' })
  }
}
