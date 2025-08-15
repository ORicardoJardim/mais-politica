// src/pages/AcceptInvite.jsx
import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'

export default function AcceptInvite() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const { user } = useAuth()
  const { setCurrentOrgId } = useOrg()
  const [msg, setMsg] = useState('Validando convite...')
  const token = new URLSearchParams(search).get('token')

  useEffect(() => {
    async function run() {
      if (!token) { setMsg('Token ausente.'); return }
      // precisa estar logado: se não, força Google e volta pra cá
      if (!user) {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.href }
        })
        return
      }
      // aceita convite
      const r = await fetch(`/api/invite-accept?token=${token}`)
      const j = await r.json()
      if (!r.ok) { setMsg(j.error || 'Falha ao aceitar convite.'); return }
      setCurrentOrgId(j.org_id) // entra direto no gabinete
      setMsg('Convite aceito! Redirecionando...')
      setTimeout(() => navigate('/', { replace: true }), 800)
    }
    run()
  }, [user, token, navigate, setCurrentOrgId])

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-3">Aceitar convite</h1>
      <p className="text-slate-700">{msg}</p>
    </div>
  )
}
