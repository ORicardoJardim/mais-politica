// api/user-delete-account.js
import { userClient, serviceClient } from './_utils.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // identifica o usuário logado a partir do token (Authorization: Bearer ...)
    const supaUser = userClient(req)
    const { data: { user }, error: uErr } = await supaUser.auth.getUser()
    if (uErr || !user) return res.status(401).json({ error: 'Not authenticated' })

    const uid = user.id

    // usa service role para apagar de fato
    const svc = serviceClient()

    // (opcional) apaga dados relacionados do usuário antes
    // await svc.from('demandas').delete().eq('user_id', uid)

    // apaga o profile
    await svc.from('profiles').delete().eq('id', uid)

    // apaga o usuário da Auth
    const { error: delErr } = await svc.auth.admin.deleteUser(uid)
    if (delErr) return res.status(400).json({ error: delErr.message })

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('user-delete-account failed:', e)
    return res.status(500).json({ error: e.message || 'Internal error' })
  }
}
