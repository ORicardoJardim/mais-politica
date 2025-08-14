// api/admin-create-user.js
import { assertAdmin, serviceClient } from './_utils.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const check = await assertAdmin(req)
    if (!check.ok) return res.status(check.status).json({ error: check.msg })

    const { name, email, password, role = 'user' } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ error: 'email e password são obrigatórios' })
    }
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'role inválida' })
    }

    const supa = serviceClient()

    // cria usuário na Auth
    const { data: created, error: aErr } = await supa.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })
    if (aErr) return res.status(400).json({ error: aErr.message })

    const userId = created.user.id

    // upsert no profile
    const { error: pErr } = await supa.from('profiles').upsert({
      id: userId,
      email,
      name: name || null,
      role,
    })
    if (pErr) return res.status(400).json({ error: pErr.message })

    return res.status(200).json({ ok: true, id: userId })
  } catch (e) {
    console.error('admin-create-user failed:', e)
    return res.status(500).json({ error: e.message || 'Internal error' })
  }
}
