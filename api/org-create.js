// /api/org-create.js
import { createClient } from '@supabase/supabase-js'

// --------- clients ----------
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

// --------- helpers ----------
function ok(res, data) {
  res.setHeader('Content-Type', 'application/json')
  res.status(200).end(JSON.stringify(data ?? {}))
}
function bad(res, msg, code = 400) {
  res.setHeader('Content-Type', 'application/json')
  res.status(code).end(JSON.stringify({ error: msg }))
}

async function requireUser(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return { ok: false, code: 401, msg: 'No Authorization bearer' }
  const anon = anonClient()
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data?.user) return { ok: false, code: 401, msg: 'Invalid session' }
  return { ok: true, user: data.user }
}

// --------- validação de campos ----------
const ALLOWED_OFFICES = [
  'dep_estadual',
  'dep_federal',
  'prefeito',
  'vice_prefeito',
  'vereador',
  'senador',
]

const MUNICIPAL = new Set(['prefeito', 'vice_prefeito', 'vereador'])
const ESTADUAL_FEDERAL = new Set(['dep_estadual', 'dep_federal', 'senador'])

function normalizeUF(uf) {
  if (!uf) return ''
  return String(uf).trim().toUpperCase()
}

function normalizeCity(city) {
  if (!city) return ''
  return String(city).trim()
}

function validatePayload({ name, office, state, city }) {
  const errors = []

  if (!name || !String(name).trim()) errors.push('Nome do gabinete é obrigatório.')

  if (!office) errors.push('Cargo é obrigatório.')
  else if (!ALLOWED_OFFICES.includes(office))
    errors.push('Cargo inválido.')

  const uf = normalizeUF(state)
  const c = normalizeCity(city)

  if (MUNICIPAL.has(office)) {
    // precisa estado (UF 2 letras) + cidade
    if (!/^[A-Z]{2}$/.test(uf)) errors.push('Estado (UF) é obrigatório para cargos municipais (ex.: RS, SP).')
    if (!c) errors.push('Cidade é obrigatória para cargos municipais.')
  } else if (ESTADUAL_FEDERAL.has(office)) {
    // precisa apenas estado (UF)
    if (!/^[A-Z]{2}$/.test(uf)) errors.push('Estado (UF) é obrigatório para cargos estaduais/federais.')
    // cidade deve ser vazia
    if (c) errors.push('Cidade não deve ser informada para cargos estaduais/federais.')
  } else {
    // fallback (se surgir outro tipo)
    if (uf && !/^[A-Z]{2}$/.test(uf)) errors.push('UF inválida.')
  }

  return { ok: errors.length === 0, errors, uf, city: c }
}

// --------- handler ----------
export default async function handler(req, res) {
  if (req.method !== 'POST') return bad(res, 'Method not allowed', 405)

  try {
    const auth = await requireUser(req)
    if (!auth.ok) return bad(res, auth.msg, auth.code)
    const user = auth.user

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    let { name, office, state, city } = body

    name = String(name || '').trim()
    office = String(office || '').trim()
    state = String(state || '').trim()
    city = String(city || '').trim()

    const v = validatePayload({ name, office, state, city })
    if (!v.ok) return bad(res, v.errors.join(' '), 400)

    const svc = serviceClient()

    // cria org
    const { data: org, error: orgErr } = await svc
      .from('orgs')
      .insert([{
        name,
        office,
        state: v.uf || null,
        city: v.city || null,
      }])
      .select('id, name, office, state, city, created_at')
      .single()

    if (orgErr) return bad(res, `org create error: ${orgErr.message}`, 400)

    // torna o criador admin do gabinete
    const { error: memErr } = await svc
      .from('memberships')
      .insert([{ org_id: org.id, user_id: user.id, role: 'admin' }])

    if (memErr) return bad(res, `membership error: ${memErr.message}`, 400)

    return ok(res, { org })
  } catch (e) {
    console.error('org-create fatal:', e)
    return bad(res, e.message || 'org-create failed', 500)
  }
}
