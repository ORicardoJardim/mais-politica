// api/admin-delete-user.js
import { assertAdmin, serviceClient } from './_utils.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const check = await assertAdmin(req)
    if (!check.ok) return res.status(check.status).json({ error: check.msg })

    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id é obrigatório' })

    const supa = serviceClient()

    // apaga usuário na Auth
    const { error: aErr } = await supa.auth.admin.deleteUser(id)
    if (aErr) return res.status(400).json({ error: aErr.message })

    // apaga profile (se sobrar)
    await supa.from('profiles').delete().eq('id', id)

    // (opcional) deletar dados relacionados (ex.: demandas do usuário)
    // await supa.from('demandas').delete().eq('user_id', id)

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('admin-delete-user failed:', e)
    return res.status(500).json({ error: e.message || 'Internal error' })
  }
}
