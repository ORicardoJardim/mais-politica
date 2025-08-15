// /api/super-admin-orgs.js
import { createClient } from '@supabase/supabase-js'

// ---------- clients ----------
function serviceClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE
  if (!url || !key) throw new Error('Missing SUPABASE envs (URL/SERVICE_ROLE)')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
function anonClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing SUPABASE envs (ANON)')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ---------- helpers ----------
function ok(res, data) {
  res.setHeader('Content-Type', 'application/json')
  res.status(200).end(JSON.stringify(data ?? {}))
}
function bad(res, msg, code = 400) {
  res.setHeader('Content-Type', 'application/json')
  res.status(code).end(JSON.stringify({ error: msg }))
}
async function assertSuper(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return { ok: false, code: 401, msg: 'No Authorization bearer' }

  const anon = anonClient()
  const { data: userData, error: userErr } = await anon.auth.getUser(token)
  if (userErr || !userData?.user) return { ok: false, code: 401, msg: 'Invalid session' }
  const user = userData.user

  const svc = serviceClient()
  const { data: prof, error } = await svc
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return { ok: false, code: 500, msg: `profile error: ${error.message}` }
  if (!prof?.is_super_admin) return { ok: false, code: 403, msg: 'forbidden: not super admin' }

  return { ok: true, user, svc }
}

// ---------- handler ----------
export default async function handler(req, res) {
  try {
    const method = req.method
    const action = (method === 'GET'
      ? (req.query?.action || '')
      : ((req.query?.action) || (req.body?.action) || '')
    ).trim()

    // gate
    const gate = await assertSuper(req)
    if (!gate.ok) return bad(res, gate.msg, gate.code)
    const svc = gate.svc

    // ===== GET?action=stats =====
    if (method === 'GET' && action === 'stats') {
      const counts = {}

      let r
      r = await svc.from('orgs').select('*', { count: 'exact', head: true })
      if (r.error) return bad(res, `orgs count error: ${r.error.message}`, 500)
      counts.orgs = r.count || 0

      r = await svc.from('profiles').select('*', { count: 'exact', head: true })
      if (r.error) return bad(res, `profiles count error: ${r.error.message}`, 500)
      counts.users = r.count || 0

      r = await svc.from('demandas').select('*', { count: 'exact', head: true })
      if (r.error) return bad(res, `demandas count error: ${r.error.message}`, 500)
      counts.demandas = r.count || 0

      r = await svc.from('memberships').select('*', { count: 'exact', head: true })
      if (r.error) return bad(res, `memberships count error: ${r.error.message}`, 500)
      counts.memberships = r.count || 0

      return ok(res, { counts })
    }

    // ===== GET?action=list (orgs com filtros) =====
    if (method === 'GET' && (action === 'list' || action === '')) {
      const office = (req.query.office || '').trim()
      const state  = (req.query.state  || '').trim().toUpperCase()
      const city   = (req.query.city   || '').trim()

      let q = svc
        .from('orgs')
        .select('id, name, created_at, office, state, city')
        .order('created_at', { ascending: false })

      if (office) q = q.eq('office', office)
      if (state)  q = q.eq('state', state)
      if (city)   q = q.ilike('city', `%${city}%`)

      const { data, error } = await q
      if (error) return bad(res, `list error: ${error.message}`, 500)

      const items = (data || []).map(o => ({
        org_id: o.id,
        name: o.name,
        created_at: o.created_at,
        office: o.office,
        state: o.state,
        city: o.city,
      }))

      return ok(res, { items })
    }

    // ===== GET?action=users (lista com busca e paginação) =====
    if (method === 'GET' && action === 'users') {
      const q = (req.query.q || '').trim()
      const page  = Math.max(1, parseInt(req.query.page || '1', 10))
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)))
      const from  = (page - 1) * limit
      const to    = from + limit - 1

      let sel = svc
        .from('profiles')
        .select('id, name, email, is_super_admin, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (q) sel = sel.or(`name.ilike.%${q}%,email.ilike.%${q}%`)

      const { data, error, count } = await sel
      if (error) return bad(res, `users list error: ${error.message}`, 500)

      return ok(res, {
        items: data || [],
        total: count ?? 0,
        page,
        limit,
      })
    }

    // ===== DELETE (excluir gabinete inteiro) =====
    if (method === 'DELETE') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      const org_id = (body.org_id || '').trim()
      if (!org_id) return bad(res, 'org_id is required', 400)

      let r
      r = await svc.from('memberships').delete().eq('org_id', org_id)
      if (r.error) return bad(res, r.error.message, 400)

      r = await svc.from('invites').delete().eq('org_id', org_id)
      if (r.error) return bad(res, r.error.message, 400)

      r = await svc.from('demandas').delete().eq('org_id', org_id)
      if (r.error) return bad(res, r.error.message, 400)

      r = await svc.from('orgs').delete().eq('id', org_id)
      if (r.error) return bad(res, r.error.message, 400)

      return ok(res, { ok: true })
    }

    return bad(res, 'Invalid action or method', 405)
  } catch (e) {
    console.error('super-admin handler fatal:', e)
    return bad(res, e.message || 'internal error', 500)
  }
}
