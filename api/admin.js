// /api/admin
// Admin do gabinete sem RPCs e sem depender de FK para join em profiles.
// Ações: list | create | update | remove | reset | audit_list

import { userClient, serviceClient } from './_utils.js'

const ALLOWED_ROLES = new Set(['admin', 'assessor', 'viewer'])

function getOrgId(req) {
  return (
    (req.headers['x-org-id'] || req.headers['x-org'] || req.headers['x-tenant-id']) ||
    req.query?.org_id ||
    req.body?.org_id ||
    ''
  ).toString()
}

function parseAction(req) {
  try {
    const url = new URL(req.url, 'http://x') // base dummy
    return (url.searchParams.get('action') || req.body?.action || '').toString()
  } catch {
    return (req.body?.action || '').toString()
  }
}

function toISO(d) {
  if (!d) return null
  const x = new Date(d)
  return isNaN(x.getTime()) ? null : x.toISOString()
}

// --------- Auth & permissões (sem RPC) ----------
async function ensureAuth(supaUser) {
  const { data, error } = await supaUser.auth.getUser()
  if (error || !data?.user?.id) {
    const msg = error?.message || 'Invalid token'
    const e = new Error(msg); e.status = 401
    throw e
  }
  return data.user.id
}

async function isOrgAdminDirect(svc, org_id, user_id) {
  if (!org_id || !user_id) return false
  try {
    const { data, error } = await svc
      .from('memberships')
      .select('role')
      .eq('org_id', org_id)
      .eq('user_id', user_id)
      .maybeSingle()
    if (error) return false
    return (data?.role || '').toLowerCase() === 'admin'
  } catch {
    return false
  }
}

async function isSuperAdminDirect(svc, user_id) {
  if (!user_id) return false
  try {
    const { data, error } = await svc
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user_id)
      .maybeSingle()
    if (error) return false
    return !!data?.is_super_admin
  } catch {
    return false
  }
}
// -------------------------------------------------

export default async function handler(req, res) {
  const supaUser = userClient(req) // token do usuário
  const svc = serviceClient()      // service role (ignora RLS)

  try {
    // exige Bearer
    const auth = req.headers.authorization || ''
    if (!auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Bearer token' })
    }

    // usuário atual
    const uid = await ensureAuth(supaUser)
    const action = parseAction(req)
    if (!action) return res.status(400).json({ error: 'action inválida' })

    // ===== Ações por gabinete =====
    if (['list', 'create', 'update', 'remove'].includes(action)) {
      const org_id = getOrgId(req)
      if (!org_id) {
        return res.status(400).json({ error: 'org_id é obrigatório (header X-Org-Id ou query/body org_id)' })
      }

      // checagem de admin
      const isAdmin = await isOrgAdminDirect(svc, org_id, uid)
      if (!isAdmin) return res.status(403).json({ error: 'Sem permissão (admin do gabinete obrigatório)' })

      // ---- LIST: sem join implícito (2 queries + merge) ----
     if (action === 'list') {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const org_id = getOrgId(req)
  if (!org_id) return res.status(400).json({ error: 'org_id é obrigatório' })

  // Log mínimo para debug
  console.log('[admin:list] org_id=', org_id)

  // Autenticação do usuário (Bearer)
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) {
    console.log('[admin:list] falta Bearer')
    return res.status(401).json({ error: 'Missing Bearer token' })
  }

  let uid
  try {
    uid = await ensureAuth(supaUser)
  } catch (e) {
    console.error('[admin:list] ensureAuth erro:', e)
    return res.status(e.status || 401).json({ error: e.message || 'Invalid token' })
  }

  // Verifica admin direto na tabela memberships
  try {
    const isAdmin = await isOrgAdminDirect(svc, org_id, uid)
    if (!isAdmin) {
      console.log('[admin:list] usuário não é admin do org', { uid, org_id })
      return res.status(403).json({ error: 'Sem permissão (admin do gabinete obrigatório)' })
    }
  } catch (e) {
    console.error('[admin:list] isOrgAdminDirect erro:', e)
    return res.status(500).json({ error: 'Falha ao checar permissão' })
  }

  // Busca memberships e depois perfis (merge em memória)
  try {
    const memQ = await svc
      .from('memberships')
      .select('user_id, role, created_at')
      .eq('org_id', org_id)
      .order('created_at', { ascending: false })

    if (memQ.error) {
      console.error('[admin:list] memberships error:', memQ.error)
      return res.status(400).json({ error: `memberships error: ${memQ.error.message}` })
    }

    const memberships = memQ.data || []
    const userIds = [...new Set(memberships.map(m => m.user_id))]

    let profilesById = {}
    if (userIds.length) {
      const profQ = await svc
        .from('profiles')
        .select('id, name, email, created_at')
        .in('id', userIds)

      if (profQ.error) {
        console.error('[admin:list] profiles error:', profQ.error)
        return res.status(400).json({ error: `profiles error: ${profQ.error.message}` })
      }
      for (const p of (profQ.data || [])) profilesById[p.id] = p
    }

    const users = memberships.map(m => {
      const p = profilesById[m.user_id] || {}
      return {
        id: m.user_id,
        name: p.name ?? null,
        email: p.email ?? null,
        role: m.role,
        created_at: m.created_at ?? p.created_at ?? null,
      }
    })

    return res.status(200).json({ users })
  } catch (e) {
    console.error('[admin:list] fatal:', e)
    return res.status(500).json({ error: e.message || 'Erro inesperado' })
  }
}


      // ---- CREATE (cria user + vínculo ao org) ----
      if (action === 'create') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
        const { name = '', email = '', password = '', role = '' } = (req.body || {})
        const normRole = String(role).toLowerCase().trim()

        if (!email || !password || !normRole) {
          return res.status(400).json({ error: 'email, password e role são obrigatórios' })
        }
        if (!ALLOWED_ROLES.has(normRole)) {
          return res.status(400).json({ error: `role inválido. Use: ${Array.from(ALLOWED_ROLES).join(', ')}` })
        }
        if (password.length < 8) {
          return res.status(400).json({ error: 'password deve ter pelo menos 8 caracteres' })
        }

        const { data: created, error: cErr } = await svc.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name: String(name || '').trim() || null },
        })
        if (cErr) return res.status(400).json({ error: cErr.message })

        const newUid = created?.user?.id
        if (!newUid) return res.status(400).json({ error: 'Falha ao criar usuário (uid ausente)' })

        const upQ = await svc
          .from('memberships')
          .upsert({ org_id, user_id: newUid, role: normRole }, { onConflict: 'org_id,user_id' })
        if (upQ.error) return res.status(400).json({ error: upQ.error.message })

        // auditoria (best effort)
        await svc.from('audit_log').insert({
          org_id, actor: uid, entity: 'membership', action: 'CREATE',
          details: { target_user_id: newUid, role: normRole, by: uid, at: new Date().toISOString() },
        }).catch(() => {})

        return res.status(200).json({ ok: true, user_id: newUid })
      }

      // ---- UPDATE role ----
      if (action === 'update') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
        const { id: targetUserId, role } = req.body || {}
        const normRole = String(role || '').toLowerCase().trim()

        if (!targetUserId || !normRole) {
          return res.status(400).json({ error: 'id e role são obrigatórios' })
        }
        if (!ALLOWED_ROLES.has(normRole)) {
          return res.status(400).json({ error: `role inválido. Use: ${Array.from(ALLOWED_ROLES).join(', ')}` })
        }

        const upQ = await svc
          .from('memberships')
          .upsert({ org_id, user_id: targetUserId, role: normRole }, { onConflict: 'org_id,user_id' })
        if (upQ.error) return res.status(400).json({ error: upQ.error.message })

        await svc.from('audit_log').insert({
          org_id, actor: uid, entity: 'membership', action: 'UPDATE',
          details: { target_user_id: targetUserId, role: normRole, by: uid, at: new Date().toISOString() },
        }).catch(() => {})

        return res.status(200).json({ ok: true })
      }

      // ---- REMOVE membro (protege último admin) ----
      if (action === 'remove') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
        const { id: targetUserId } = req.body || {}
        if (!targetUserId) return res.status(400).json({ error: 'id é obrigatório' })

        const adminsCountQ = await svc
          .from('memberships')
          .select('user_id', { count: 'exact', head: true })
          .eq('org_id', org_id)
          .eq('role', 'admin')
        if (adminsCountQ.error) return res.status(400).json({ error: adminsCountQ.error.message })

        const { data: target, error: tErr } = await svc
          .from('memberships')
          .select('role')
          .eq('org_id', org_id)
          .eq('user_id', targetUserId)
          .maybeSingle()
        if (tErr) return res.status(400).json({ error: tErr.message })

        if ((target?.role || '').toLowerCase() === 'admin' && (adminsCountQ?.count ?? 0) <= 1) {
          return res.status(400).json({ error: 'Não é possível remover o único admin do gabinete.' })
        }

        const dQ = await svc
          .from('memberships')
          .delete()
          .eq('org_id', org_id)
          .eq('user_id', targetUserId)
        if (dQ.error) return res.status(400).json({ error: dQ.error.message })

        await svc.from('audit_log').insert({
          org_id, actor: uid, entity: 'membership', action: 'DELETE',
          details: { target_user_id: targetUserId, by: uid, at: new Date().toISOString() },
        }).catch(() => {})

        return res.status(200).json({ ok: true })
      }
    }

    // ===== Super admin (reset de senha) =====
    if (action === 'reset') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
      const { id, password } = req.body || {}
      if (!id || !password) return res.status(400).json({ error: 'id e password são obrigatórios' })
      if (password.length < 8) return res.status(400).json({ error: 'password deve ter pelo menos 8 caracteres' })

      const isSuper = await isSuperAdminDirect(svc, uid)
      if (!isSuper) return res.status(403).json({ error: 'Somente super admin' })

      const { error } = await svc.auth.admin.updateUserById(id, { password })
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    // ===== Auditoria (lista) =====
    if (action === 'audit_list') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

      const org_id = getOrgId(req) || null
      const superAdmin = await isSuperAdminDirect(svc, uid)
      const orgAdmin = org_id ? await isOrgAdminDirect(svc, org_id, uid) : false

      const actor = (req.query.actor || '').toString() || null
      const actionFilter = (req.query.action || '').toString() || null
      const from = toISO(req.query.from)
      const to = toISO(req.query.to)
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1)
      const page_size = Math.min(200, Math.max(1, parseInt(String(req.query.page_size || '50'), 10) || 50))
      const fromIdx = (page - 1) * page_size
      const toIdx = fromIdx + page_size - 1

      let q = svc.from('audit_log').select('*', { count: 'exact' }).order('created_at', { ascending: false })

      if (superAdmin) {
        // vê tudo
      } else if (orgAdmin && org_id) {
        q = q.eq('org_id', org_id)
      } else {
        q = q.eq('actor', uid) // usuário comum: só as próprias
      }

      if (org_id && (superAdmin || orgAdmin)) q = q.eq('org_id', org_id)
      if (actor) q = q.eq('actor', actor)
      if (actionFilter) q = q.eq('action', actionFilter)
      if (from) q = q.gte('created_at', from)
      if (to) q = q.lte('created_at', to)

      q = q.range(fromIdx, toIdx)
      const { data, error, count } = await q
      if (error) return res.status(400).json({ error: error.message })

      const items = (data || []).map(row => {
        const { details, ...rest } = row
        return { ...rest, details: details ?? null }
      })
      return res.status(200).json({ page, page_size, total: count ?? 0, items })
    }

    return res.status(400).json({ error: 'action inválida' })
  } catch (e) {
    console.error('[api/admin] error:', e)
    const status = e?.status || 500
    return res.status(status).json({ error: e.message || 'Internal error' })
  }
}
