// api/admin-update-user.js
import { assertAdmin, serviceClient } from './_utils.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const check = await assertAdmin(req)
    if (!check.ok) return res.status(check.status).json({ error: check.msg })

    const { id, name, email, role } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id é obrigatório' })
    if (role && !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'role inválida' })
    }

    const supa = serviceClient()

    // atualiza email na Auth, se fornecido
    if (email) {
      const { error: eErr } = await supa.auth.admin.updateUserById(id, { email })
      if (eErr) return res.status(400).json({ error: eErr.message })
    }

    // atualiza profile
    const patch = { ...(name !== undefined && { name }), ...(email && { email }), ...(role && { role }) }
    if (Object.keys(patch).length === 0) {
      return res.status(200).json({ ok: true }) // nada pra atualizar
    }

    const { error: pErr } = await supa.from('profiles').update(patch).eq('id', id)
    if (pErr) return res.status(400).json({ error: pErr.message })

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('admin-update-user failed:', e)
    return res.status(500).json({ error: e.message || 'Internal error' })
  }
}
