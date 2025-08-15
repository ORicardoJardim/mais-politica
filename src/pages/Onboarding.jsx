// src/pages/Onboarding.jsx
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useOrg } from '../context/OrgContext'

export default function Onboarding() {
  const navigate = useNavigate()
  const { setCurrentOrgId } = useOrg()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function createOrg(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Dê um nome ao gabinete.'); return }

    setLoading(true)
    try {
      // pega o token do usuário logado
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const r = await fetch('/api/org-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao criar gabinete')

      // define este gabinete como atual e vai para o app
      setCurrentOrgId(j.org_id)
      navigate('/', { replace: true })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Criar seu gabinete</h1>
      <p className="text-slate-600 mb-6">
        Dê um nome para o seu gabinete. Você será o administrador e poderá convidar pessoas depois.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={createOrg} className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
        <label className="block text-sm font-medium">Nome do gabinete</label>
        <input
          className="input w-full"
          placeholder="Ex.: Gabinete da Vereadora Maria"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <button
          className="btn-primary w-full"
          disabled={loading}
        >
          {loading ? 'Criando…' : 'Criar gabinete'}
        </button>
      </form>
    </div>
  )
}
