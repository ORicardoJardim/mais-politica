// api/_utils.js
import { createClient } from '@supabase/supabase-js'

// helper: lê env com fallback (ex.: SUPABASE_URL ou VITE_SUPABASE_URL)
function getEnv(primary, fallbacks = []) {
  return process.env[primary] || fallbacks.map(k => process.env[k]).find(Boolean)
}

// cliente do usuário (para checar se é admin via RPC)
export function userClient(req) {
  const url  = getEnv('SUPABASE_URL', ['VITE_SUPABASE_URL'])
  const anon = getEnv('SUPABASE_ANON_KEY', ['VITE_SUPABASE_ANON_KEY'])
  if (!url || !anon) throw new Error('Env faltando: SUPABASE_URL/ANON_KEY')

  const authHeader = req.headers?.authorization || ''
  const headers = authHeader ? { Authorization: authHeader } : {}
  return createClient(url, anon, { global: { headers } })
}

// cliente com service role (para ações privilegiadas)
export function serviceClient() {
  const url = getEnv('SUPABASE_URL', ['VITE_SUPABASE_URL'])
  const service = getEnv('SUPABASE_SERVICE_ROLE', ['SUPABASE_SERVICE_ROLE_KEY'])
  if (!url || !service) throw new Error('Env faltando: SUPABASE_URL/SUPABASE_SERVICE_ROLE')
  return createClient(url, service)
}

// garante que o caller é admin (usa a função SQL is_admin(uid))
export async function assertAdmin(req) {
  try {
    const supa = userClient(req)
    const { data: { user }, error: uErr } = await supa.auth.getUser()
    if (uErr || !user) return { ok: false, status: 401, msg: 'Not authenticated' }

    const { data, error } = await supa.rpc('is_admin', { uid: user.id })
    if (error) return { ok: false, status: 500, msg: error.message }
    if (!data) return { ok: false, status: 403, msg: 'Not authorized' }

    return { ok: true, user }
  } catch (e) {
    return { ok: false, status: 500, msg: e.message }
  }
}
