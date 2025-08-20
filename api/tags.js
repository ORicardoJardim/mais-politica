// api/tags.js
import { createClient } from '@supabase/supabase-js'

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

    // ===== LISTAR =====
    if (method === 'GET') {
      const org_id = (req.query.org_id || '').trim()
      if (!org_id) return bad(res, 'org_id is required')

      const { data, error } = await supa
        .from('tags')
        .select('id, name, color, created_at')
        .eq('org_id', org_id)
        .order('created_at', { ascending: false })

      if (error) return bad(res, error.message, 400)
      return ok(res, { items: data || [] })
    }

    // ===== CRIAR (admin) =====
    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      const { org_id, name, color = '#64748b' } = body
      if (!org_id || !name) return bad(res, 'org_id and name are required')

      const { data, error } = await supa
        .from('tags')
        .insert([{ org_id, name, color }])
        .select()
        .single()

      if (error) return bad(res, error.message, 400)
      return ok(res, { item: data })
    }

    // ===== EDITAR (admin) =====
    if (method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      const { id, name, color } = body
      if (!id) return bad(res, 'id is required')

      const { data, error } = await supa
        .from('tags')
        .update({ ...(name !== undefined ? { name } : {}), ...(color !== undefined ? { color } : {}) })
        .eq('id', id)
        .select()
        .maybeSingle()

      if (error) return bad(res, error.message, 400)
      return ok(res, { item: data })
    }

    // ===== APAGAR (admin) =====
    if (method === 'DELETE') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      const { id } = body
      if (!id) return bad(res, 'id is required')

      const { error } = await supa.from('tags').delete().eq('id', id)
      if (error) return bad(res, error.message, 400)
      return ok(res, { ok: true })
    }

    return bad(res, 'Invalid method', 405)
  } catch (e) {
    console.error('tags handler fatal:', e)
    return bad(res, e.message || 'internal error', 500)
  }
}
