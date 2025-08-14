// api/_utils.js
import { createClient } from '@supabase/supabase-js'

// cliente com o JWT do usuário (para descobrir se é admin)
export function userClient(req) {
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  const authHeader = req.headers.authorization || ''
  return createClient(url, anon, {
    global: { headers: { Authorization: authHeader } }
  })
}

// cliente com service role (p/ ações privilegiadas)
export function serviceClient() {
  const url = process.env.VITE_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE
  return createClient(url, service)
}

// checa se o caller é admin (usa a função is_admin(uid))
export async function assertAdmin(req) {
  const supaUser = userClient(req)
  const { data: { user }, error: uErr } = await supaUser.auth.getUser()
  if (uErr || !user) return { ok: false, status: 401, msg: 'Not authenticated' }

  const { data, error } = await supaUser.rpc('is_admin', { uid: user.id })
  if (error) return { ok: false, status: 500, msg: error.message }
  if (!data) return { ok: false, status: 403, msg: 'Not authorized' }
  return { ok: true, user }
}
