// api/invite.js
import { userClient, serviceClient } from './_utils.js'

export default async function handler(req, res) {
  const supaUser = userClient(req)
  const svc = serviceClient()

  try {
    const url = new URL(req.url, 'http://x')
    const action = url.searchParams.get('action') // list|create|cancel|accept

    if (action === 'list') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
      const org_id = url.searchParams.get('org_id')
      if (!org_id) return res.status(400).json({ error: 'org_id é obrigatório' })
      const { data: isAdmin } = await supaUser.rpc('is_org_admin', { p_org: org_id })
      if (!isAdmin) return res.status(403).json({ error: 'Sem permissão' })
      const { data, error } = await svc.from('invites').select('*').eq('org_id', org_id).order('created_at', { ascending: false })
      if (error) return res.status(400).json({ error: error.message })
      const base = process.env.SITE_URL || url.origin
      const items = (data || []).map(v => ({
        ...v,
        link: `${base}/accept-invite?token=${v.token}`
      }))
      return res.status(200).json({ items })
    }

    if (action === 'create') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
      const { org_id, email, role } = req.body || {}
      if (!org_id || !email || !role) return res.status(400).json({ error: 'org_id, email e role são obrigatórios' })
      const { data: isAdmin } = await supaUser.rpc('is_org_admin', { p_org: org_id })
      if (!isAdmin) return res.status(403).json({ error: 'Sem permissão' })
      const { data, error } = await svc.from('invites').insert({ org_id, email, role }).select('*').single()
      if (error) return res.status(400).json({ error: error.message })
      const base = process.env.SITE_URL || (new URL(req.url, 'http://x')).origin
      const link = `${base}/accept-invite?token=${data.token}`
      return res.status(200).json({ ok: true, token: data.token, link })
    }

    if (action === 'cancel') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
      const { token, org_id } = req.body || {}
      if (!token || !org_id) return res.status(400).json({ error: 'token e org_id são obrigatórios' })
      const { data: isAdmin } = await supaUser.rpc('is_org_admin', { p_org: org_id })
      if (!isAdmin) return res.status(403).json({ error: 'Sem permissão' })
      const { error } = await svc.from('invites').delete().eq('token', token).eq('org_id', org_id)
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    if (action === 'accept') {
      if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
      const token = (req.method === 'GET')
        ? new URL(req.url, 'http://x').searchParams.get('token')
        : req.body?.token
      if (!token) return res.status(400).json({ error: 'token é obrigatório' })
      const { data: { user } } = await supaUser.auth.getUser()
      if (!user) return res.status(401).json({ error: 'Não autenticado' })
      const { data: inv, error: iErr } = await svc.from('invites').select('*').eq('token', token).single()
      if (iErr) return res.status(400).json({ error: iErr.message })
      if (new Date(inv.expires_at) < new Date()) return res.status(400).json({ error: 'Convite expirado' })
      if (inv.email.toLowerCase() !== (user.email || '').toLowerCase()) {
        return res.status(400).json({ error: 'E-mail do convite não corresponde ao seu login' })
      }
      const { error: mErr } = await svc
        .from('memberships')
        .upsert({ org_id: inv.org_id, user_id: user.id, role: inv.role }, { onConflict: 'org_id,user_id' })
      if (mErr) return res.status(400).json({ error: mErr.message })
      await svc.from('invites').delete().eq('token', token)
      return res.status(200).json({ ok: true, org_id: inv.org_id })
    }

    return res.status(400).json({ error: 'action inválida' })
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Erro' })
  }
}
