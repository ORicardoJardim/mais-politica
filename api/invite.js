// /api/invite.js
import { createClient } from '@supabase/supabase-js'

// Util: cria clientes
function serviceClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE
  if (!url || !key) throw new Error('Missing SUPABASE envs (URL / SERVICE_ROLE)')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
function anonClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing SUPABASE envs (ANON)')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Helpers HTTP
function ok(res, data) {
  res.setHeader('Content-Type', 'application/json')
  res.status(200).end(JSON.stringify(data ?? {}))
}
function bad(res, msg, code = 400) {
  res.setHeader('Content-Type', 'application/json')
  res.status(code).end(JSON.stringify({ error: msg }))
}

export default async function handler(req, res) {
  try {
    const action = (req.method === 'GET' ? req.query.action : (req.query.action || (req.body && req.body.action))) || ''
    const org_id = req.method === 'GET' ? req.query.org_id : req.body?.org_id

    // 1) Autentica o usuário pelo Bearer do Supabase
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return bad(res, 'No Authorization bearer', 401)

    const anon = anonClient()
    const { data: userData, error: userErr } = await anon.auth.getUser(token)
    if (userErr || !userData?.user) return bad(res, 'Invalid session', 401)
    const user = userData.user

    // 2) Checar se usuário é admin do org
    if (!org_id) return bad(res, 'org_id is required', 400)

    const svc = serviceClient()
    const { data: membership, error: memErr } = await svc
      .from('memberships')
      .select('role')
      .eq('org_id', org_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memErr) return bad(res, `membership error: ${memErr.message}`, 500)
    if (!membership || membership.role !== 'admin') return bad(res, 'forbidden: not org admin', 403)

    // 3) Ações
    if (req.method === 'GET' && action === 'list') {
      const { data, error } = await svc
        .from('invites')
        .select('token,email,role,expires_at')
        .eq('org_id', org_id)
        .order('created_at', { ascending: false })

      if (error) return bad(res, `list error: ${error.message}`, 500)

      // monta link com SITE_URL
      const site = process.env.SITE_URL
      const items = (data || []).map(it => ({
        ...it,
        link: site ? `${site}/accept-invite?token=${it.token}` : null,
      }))
      return ok(res, { items })
    }

    if (req.method === 'POST' && action === 'create') {
      const { email, role } = req.body || {}
      if (!email || !role) return bad(res, 'email and role are required', 400)

      // cria token + expiração
      const token = crypto.randomUUID()
      const expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString() // 7 dias

      const { error } = await svc
        .from('invites')
        .insert([{ token, org_id, email, role, expires_at, created_by: user.id }])
      if (error) return bad(res, `create error: ${error.message}`, 500)

      const site = process.env.SITE_URL
      const link = site ? `${site}/accept-invite?token=${token}` : null
      return ok(res, { token, link })
    }

    if (req.method === 'POST' && action === 'cancel') {
      const { token: tok } = req.body || {}
      if (!tok) return bad(res, 'token is required', 400)

      const { error } = await svc
        .from('invites')
        .delete()
        .eq('token', tok)
        .eq('org_id', org_id)
      if (error) return bad(res, `cancel error: ${error.message}`, 500)

      return ok(res, { ok: true })
    }

    // Aceite (GET) - /api/invite?action=accept&token=...
    if (req.method === 'GET' && action === 'accept') {
      const tokenParam = req.query.token
      if (!tokenParam) return bad(res, 'token is required', 400)

      const nowIso = new Date().toISOString()
      const { data: inv, error: invErr } = await svc
        .from('invites')
        .select('org_id,email,role,expires_at')
        .eq('token', tokenParam)
        .maybeSingle()

      if (invErr) return bad(res, `invite error: ${invErr.message}`, 500)
      if (!inv) return bad(res, 'invite not found', 404)
      if (inv.expires_at && inv.expires_at < nowIso) return bad(res, 'invite expired', 400)
      if (inv.org_id !== org_id) return bad(res, 'org mismatch', 400)

      // cria/garante membership
      const { error: upErr } = await svc
        .from('memberships')
        .upsert({ org_id, user_id: user.id, role: inv.role }, { onConflict: 'org_id,user_id' })

      if (upErr) return bad(res, `membership upsert error: ${upErr.message}`, 500)

      // remove convite
      await svc.from('invites').delete().eq('token', tokenParam).eq('org_id', org_id)

      return ok(res, { org_id, role: inv.role })
    }

    return bad(res, 'Unsupported method/action', 405)
  } catch (e) {
    console.error('invite handler fatal:', e)
    return bad(res, String(e?.message || e), 500)
  }
}
