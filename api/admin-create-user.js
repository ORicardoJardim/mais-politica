import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, password, name, role = 'user' } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'email e password são obrigatórios' })
  if (!['user','admin'].includes(role)) return res.status(400).json({ error: 'role inválida' })

  const url = process.env.VITE_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE
  if (!url || !service) return res.status(500).json({ error: 'Env faltando' })

  const admin = createClient(url, service)

  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name }
  })
  if (error) return res.status(400).json({ error: error.message })

  const userId = data.user.id
  const { error: pErr } = await admin.from('profiles')
    .update({ email, name, role })
    .eq('id', userId)
  if (pErr) return res.status(400).json({ error: pErr.message })

  return res.status(200).json({ ok: true, userId })
}
