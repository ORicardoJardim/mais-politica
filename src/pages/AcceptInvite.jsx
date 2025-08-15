// src/pages/AcceptInvite.jsx
import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useOrg } from '../context/OrgContext'

const API_BASE = import.meta.env.VITE_API_BASE || ''

async function api(path) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const text = await r.text()
  let payload
  try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text } }
  if (!r.ok) throw new Error(payload?.error || payload?.raw || 'Erro na API')
  return payload
}

export default function AcceptInvite() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setCurrentOrgId, refetchMemberships } = useOrg()
  const [msg, setMsg] = useState('Validando convite…')

  useEffect(() => {
    const run = async () => {
      const token = params.get('token')
      if (!token) { setMsg('Convite inválido (sem token).'); return }
      try {
        const j = await api(`/api/invite?action=accept&token=${encodeURIComponent(token)}`)
        // atualiza memberships / org atual
        await refetchMemberships?.()
        if (j.org_id) setCurrentOrgId(j.org_id)
        setMsg('Convite aceito! Redirecionando…')
        setTimeout(() => navigate('/'), 1200)
      } catch (e) {
        setMsg(`Erro ao aceitar convite: ${e.message}`)
      }
    }
    run()
  }, [])

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <h1 className="text-xl font-semibold mb-2">Aceitar convite</h1>
        <p className="text-slate-700">{msg}</p>
      </div>
    </div>
  )
}
