import { supabase } from './supabaseClient'

export async function secureAction(op, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const r = await fetch(`/api/secure-actions?op=${encodeURIComponent(op)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ op, ...payload })
  })

  const j = await r.json()
  if (!r.ok || j?.error) throw new Error(j?.error || 'Falha na ação')
  return j.data
}
