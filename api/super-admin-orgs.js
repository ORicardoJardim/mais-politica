// /api/super-admin-orgs.js
import { createClient } from '@supabase/supabase-js'

// Clients
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

export default async function handler(req, res) {
  try {
    const method = req.method
    const action = (method === 'GET' ? req.query.action : (req.query.action || req.body?.action)) || ''

    // valida super admin
    const gate = await assertSuper(req)
    if (!gate.ok) return bad(res, gate.msg, gate.code)
    const svc = gate.svc

    // ---------- AÇÃO: stats ----------
    if (method === 'GET' && action === 'stats') {
      const counts = {}

      // orgs
      {
        const { count, error } = await svc
          .from('orgs')
          .select('*', { count: 'exact', head: true })
        if (error) return bad(res, `orgs count error: ${error.message}`, 500)
        counts.orgs = count || 0
      }
      // profiles (usuários)
      {
        const { count, error } = await svc
          .from('profiles')
          .select('*', { count: 'exact', head: true })
        if (error) return bad(res, `profiles count error: ${error.message}`, 500)
        counts.users = count || 0
      }
      // demandas
      {
        const { count, error } = await svc
          .from('demandas')
          .select('*', { count: 'exact', head: true })
        if (error) return bad(res, `demandas count error: ${error.message}`, 500)
        counts.demandas = count || 0
      }
      // memberships
      {
        const { count, error } = await svc
          .from('memberships')
          .select('*', { count: 'exact', head: true })
        if (error) return bad(res, `memberships count error: ${error.message}`, 500)
        counts.memberships = count || 0
      }

      return ok(res, { counts })
    }

    // ---------- AÇÃO: listar gabinetes ----------
    // ...código de imports e verificação de super admin acima

if (req.method === 'GET') {
  const action = req.query.action || 'stats';

  if (action === 'list') {
    // ⚠️ AQUI: selecione 'id' e faça alias para 'org_id'
    const { data, error } = await svc
      .from('orgs')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    // mapeia para o formato esperado pelo front
    const items = (data || []).map(o => ({
      org_id: o.id,            // alias
      name: o.name,
      created_at: o.created_at,
    }));

    return res.status(200).json({ items });
  }

  if (action === 'stats') {
    // permanece como está
    const [{ count: orgsCount }] = await Promise.all([
      svc.from('orgs').select('*', { count: 'exact', head: true }),
    ]);
    const { count: usersCount } = await svc.from('profiles').select('*', { count: 'exact', head: true });
    const { count: demandasCount } = await svc.from('demandas').select('*', { count: 'exact', head: true });
    const { count: membershipsCount } = await svc.from('memberships').select('*', { count: 'exact', head: true });

    return res.status(200).json({
      counts: {
        orgs: orgsCount ?? 0,
        users: usersCount ?? 0,
        demandas: demandasCount ?? 0,
        memberships: membershipsCount ?? 0,
      },
    });
  }

  return res.status(400).json({ error: 'Invalid action' });
}

// DELETE mantém igual; ele recebe { org_id } e usa nos deletes
// ...


    // ---------- AÇÃO: excluir gabinete ----------
    if (method === 'DELETE' && (action === '' || action === 'delete')) {
      const org_id = req.body?.org_id
      if (!org_id) return bad(res, 'org_id is required', 400)

      // apaga dependências (ajuste conforme suas FKs / ON DELETE CASCADE)
      await svc.from('memberships').delete().eq('org_id', org_id)
      await svc.from('invites').delete().eq('org_id', org_id)
      await svc.from('demandas').delete().eq('org_id', org_id)

      const { error } = await svc.from('orgs').delete().eq('org_id', org_id)
      if (error) return bad(res, `delete error: ${error.message}`, 500)

      return ok(res, { ok: true })
    }

    return bad(res, 'Unsupported method/action', 405)
  } catch (e) {
    console.error('super-admin handler fatal:', e)
    return bad(res, String(e?.message || e), 500)
  }
}
