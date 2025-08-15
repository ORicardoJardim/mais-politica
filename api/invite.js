// pages/api/invite.js
import { supabase } from '../../utils/supabaseClient'

export default async function handler(req, res) {
  const { action } = req.query

  try {
    if (action === 'list') {
      const { org_id } = req.query
      if (!org_id) return res.status(400).json({ error: 'org_id é obrigatório' })

      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .eq('org_id', org_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return res.status(200).json({ items: data })
    }

    if (action === 'create') {
      const { org_id, email, role } = req.body
      if (!org_id || !email) return res.status(400).json({ error: 'Dados incompletos' })

      const token = crypto.randomUUID()
      const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias
      const link = `${process.env.NEXT_PUBLIC_SITE_URL}/accept-invite/${token}`

      const { error } = await supabase
        .from('invites')
        .insert([{ org_id, email, role, token, link, expires_at }])

      if (error) throw error
      return res.status(200).json({ link })
    }

    if (action === 'cancel') {
      const { token, org_id } = req.body
      if (!token || !org_id) return res.status(400).json({ error: 'Dados incompletos' })

      const { error } = await supabase
        .from('invites')
        .delete()
        .eq('token', token)
        .eq('org_id', org_id)

      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (action === 'accept') {
      const { token } = req.body
      if (!token) return res.status(400).json({ error: 'Token é obrigatório' })

      // Busca convite
      const { data: invite, error: findError } = await supabase
        .from('invites')
        .select('*')
        .eq('token', token)
        .single()

      if (findError || !invite) return res.status(404).json({ error: 'Convite não encontrado' })
      if (new Date(invite.expires_at) < new Date()) return res.status(400).json({ error: 'Convite expirado' })

      // Aqui você precisa pegar o user_id logado (dependendo do auth que você usa)
      // Exemplo genérico:
      const { data: { user }, error: userError } = await supabase.auth.getUser(req.headers.authorization?.split(' ')[1])
      if (userError || !user) return res.status(401).json({ error: 'Não autenticado' })

      // Adiciona usuário à org
      const { error: insertError } = await supabase
        .from('org_members')
        .insert([{ org_id: invite.org_id, user_id: user.id, role: invite.role }])

      if (insertError) throw insertError

      // Deleta convite
      await supabase.from('invites').delete().eq('token', token)

      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Ação inválida' })

  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
