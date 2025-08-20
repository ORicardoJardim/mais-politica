// /api/secure-actions.js
// Gateway único de ações críticas, com fallbacks de env e CORS.

import { createClient } from '@supabase/supabase-js'

// ===== util =====
function getEnv() {
  const url =
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL

  const anon =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON

  return { url, anon }
}

function supabaseFromReq(req) {
  const { url, anon } = getEnv()
  if (!url || !anon) {
    const found = {
      VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: !!process.env.VITE_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY || !!process.env.SUPABASE_ANON,
    }
    throw new Error('Variáveis Supabase ausentes. Verifique URL/ANON_KEY no ambiente do servidor. ' + JSON.stringify(found))
  }
  const auth = req.headers?.authorization || '' // "Bearer <jwt>"
  return createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
}

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body)
    let raw = ''
    req.on('data', chunk => (raw += chunk))
    req.on('end', () => {
      if (!raw) return resolve({})
      try { resolve(JSON.parse(raw)) } catch (e) { reject(new Error('Body não é JSON válido')) }
    })
  })
}

// ===== Operações =====
const OPS = {
  async 'undo-day'(sb, payload) {
    const { actor, day } = payload
    if (!actor || !day) throw new Error('actor e day são obrigatórios')
    return sb.rpc('undo_actions_for_day', { p_actor: actor, p_day: day })
  },

  async 'approvals.request'(sb, payload) {
    const { action, payload: p } = payload
    if (!action) throw new Error('action é obrigatório')
    return sb.rpc('request_approval', { p_action: action, p_payload: p ?? {} })
  },

  async 'approvals.decide'(sb, payload) {
    const { id, decision } = payload
    if (!id || !decision) throw new Error('id e decision são obrigatórios')
    return sb.rpc('decide_approval', { p_id: id, p_decision: decision })
  },

  async 'rate-check'(sb, payload) {
    const { bucket, refill = 3, cap = 10 } = payload
    if (!bucket) throw new Error('bucket é obrigatório')
    return sb.rpc('take_token', { p_bucket: bucket, p_refill_seconds: refill, p_capacity: cap })
  },

  async 'voters.merge'(sb, payload) {
    const { winner, loser } = payload
    if (!winner || !loser) throw new Error('winner e loser são obrigatórios')
    return sb.rpc('merge_people', { p_winner: winner, p_loser: loser })
  },

  async 'security.alerts.list'(sb) {
    return sb.from('security_alerts').select('*').order('created_at', { ascending: false }).limit(100)
  },

  async 'security.alerts.ack'(sb, payload) {
    const { id } = payload
    if (!id) throw new Error('id é obrigatório')
    return sb.rpc('security_alerts_ack', { p_id: id })
  },

  async 'cache.invalidate'(sb, payload) {
    const { orgId = null } = payload
    return sb.rpc('cache_invalidate', { p_org: orgId })
  },

  // >>> TROCA DE FUNÇÃO (members.setRole)
  async 'members.setRole'(sb, body) {
    const { userId, id, role } = body
    const target = userId || id
    if (!target || !role) throw new Error('id e role são obrigatórios')
    return sb.rpc('membership_set_role', { p_user: target, p_role: role })
  },
}

// ===== Handler =====
export default async function handler(req, res) {
  setCORS(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const body = req.method === 'GET' ? req.query : await parseBody(req)
    const op = (req.query?.op || body?.op || '').toString()

    if (op === '__list') {
      return res.status(200).json({ ok: true, allowed: Object.keys(OPS) })
    }
    if (!op || !(op in OPS)) {
      return res.status(400).json({ error: 'op inválida', allowed: Object.keys(OPS) })
    }

    const sb = supabaseFromReq(req)
    const { data: { user }, error: userErr } = await sb.auth.getUser()
    if (userErr || !user) return res.status(401).json({ error: 'não autenticado' })

    const { data, error } = await OPS[op](sb, body || {})
    if (error) return res.status(400).json({ error: error.message || String(error) })
    return res.status(200).json({ ok: true, data })
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
