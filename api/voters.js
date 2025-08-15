// api/voters.js
import { createClient } from '@supabase/supabase-js'
import { assertAdmin, serviceClient } from './_utils' // <- para export CSV (somente admin)

// client com token do usuário (RLS)
function userClient(req) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Missing SUPABASE envs')
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  return createClient(url, anon, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

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
    const supa = userClient(req)
    const method = req.method
    const action = (req.query?.action || '').trim()

    // ===== LISTAR (GET) =====
    if (method === 'GET' && !action) {
      const org_id = (req.query.org_id || '').trim()
      if (!org_id) return bad(res, 'org_id is required')
      const q = (req.query.q || '').trim()
      const tag_id = (req.query.tag_id || '').trim() || null

      const page  = Math.max(1, parseInt(req.query.page || '1', 10))
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)))
      const from  = (page - 1) * limit
      const to    = from + limit - 1

      // se veio tag_id, buscar IDs na pivot voter_tags
      let voterIdsByTag = null
      if (tag_id) {
        const r = await supa
          .from('voter_tags')
          .select('voter_id')
          .eq('tag_id', tag_id)
        if (r.error) return bad(res, r.error.message, 400)
        voterIdsByTag = (r.data || []).map(x => x.voter_id)
        if (!voterIdsByTag.length) {
          return ok(res, { items: [], total: 0, page, limit })
        }
      }

      let sel = supa
        .from('voters')
        .select('id, name, phone, city, email, state, address, notes, created_at', { count: 'exact' })
        .eq('org_id', org_id)

      if (q) {
        sel = sel.or(
          `name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%`
        )
      }
      if (voterIdsByTag) {
        sel = sel.in('id', voterIdsByTag)
      }

      sel = sel.order('created_at', { ascending: false }).range(from, to)

      const { data, error, count } = await sel
      if (error) return bad(res, error.message, 400)
      return ok(res, { items: data || [], total: count ?? 0, page, limit })
    }

    // ===== EXPORT CSV (GET ?action=export) — SOMENTE ADMIN =====
    if (method === 'GET' && action === 'export') {
      const org_id = (req.query.org_id || '').trim()
      if (!org_id) return bad(res, 'org_id is required')

      // exige admin do gabinete
      const check = await assertAdmin(req, org_id)
      if (!check.ok) return bad(res, check.msg, check.status)

      const svc = serviceClient()
      const tag_id = (req.query.tag_id || '').trim() || null

      let voterIdsByTag = null
      if (tag_id) {
        const r = await svc
          .from('voter_tags')
          .select('voter_id')
          .eq('tag_id', tag_id)
        if (r.error) return bad(res, r.error.message, 400)
        voterIdsByTag = (r.data || []).map(x => x.voter_id)
        if (!voterIdsByTag.length) {
          res.setHeader('Content-Type', 'text/csv; charset=utf-8')
          res.setHeader('Content-Disposition', `attachment; filename="eleitores_${org_id}.csv"`)
          return res.status(200).end('name,phone,email,city,state,address,zipcode,notes,created_at\n')
        }
      }

      let q = svc
        .from('voters')
        .select('name,phone,email,city,state,address,zipcode,notes,created_at,id')
        .eq('org_id', org_id)
        .order('created_at', { ascending: false })

      if (voterIdsByTag) q = q.in('id', voterIdsByTag)

      const { data, error } = await q
      if (error) return bad(res, error.message, 400)

      const header = ['name','phone','email','city','state','address','zipcode','notes','created_at']
      const rows = (data || []).map(r => header.map(h => {
        const v = (r[h] ?? '').toString().replace(/"/g,'""')
        return `"${v}"`
      }).join(','))
      const csv = header.join(',') + '\n' + rows.join('\n')

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="eleitores_${org_id}.csv"`)
      return res.status(200).end(csv)
    }

    // ===== CRIAR (POST) =====
    if (method === 'POST' && !action) {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      const { org_id, name, phone, city, email, address, state, notes } = body
      if (!org_id || !name || !phone || !city) return bad(res, 'org_id, name, phone, city are required')

      const { data, error } = await supa
        .from('voters')
        .insert([{ org_id, name, phone, city, email, address, state, notes }])
        .select()
        .single()

      if (error) return bad(res, error.message, 400)
      return ok(res, { item: data })
    }

    // ===== EDITAR (PATCH) =====
    if (method === 'PATCH' && !action) {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      const { id, ...changes } = body
      if (!id) return bad(res, 'id is required')

      const { data, error } = await supa
        .from('voters')
        .update({ ...changes })
        .eq('id', id)
        .select()
        .maybeSingle()

      if (error) return bad(res, error.message, 400)
      return ok(res, { item: data })
    }

    // ===== EXCLUIR (DELETE) =====
    if (method === 'DELETE' && !action) {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      const { id } = body
      if (!id) return bad(res, 'id is required')

      const { error } = await supa.from('voters').delete().eq('id', id)
      if (error) return bad(res, error.message, 400)
      return ok(res, { ok: true })
    }

    // ===== LISTAR TAGS DE UM VOTER =====
    if (method === 'GET' && action === 'tags') {
      const voter_id = (req.query.voter_id || '').trim()
      if (!voter_id) return bad(res, 'voter_id is required')

      const { data, error } = await supa
        .from('voter_tags')
        .select('tag_id, tags(id, name, color)')
        .eq('voter_id', voter_id)

      if (error) return bad(res, error.message, 400)
      const items = (data || []).map(r => r.tags).filter(Boolean)
      return ok(res, { items })
    }

    // ===== ADICIONAR TAG A UM VOTER =====
    if (method === 'POST' && action === 'add_tag') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      const { voter_id, tag_id } = body
      if (!voter_id || !tag_id) return bad(res, 'voter_id and tag_id are required')

      const { error } = await supa.from('voter_tags').insert([{ voter_id, tag_id }])
      if (error) return bad(res, error.message, 400)
      return ok(res, { ok: true })
    }

    // ===== REMOVER TAG DE UM VOTER =====
    if (method === 'DELETE' && action === 'remove_tag') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      const { voter_id, tag_id } = body
      if (!voter_id || !tag_id) return bad(res, 'voter_id and tag_id are required')

      const { error } = await supa.from('voter_tags').delete().eq('voter_id', voter_id).eq('tag_id', tag_id)
      if (error) return bad(res, error.message, 400)
      return ok(res, { ok: true })
    }

    return bad(res, 'Invalid method/action', 405)
  } catch (e) {
    console.error('voters handler fatal:', e)
    return bad(res, e.message || 'internal error', 500)
  }
}
