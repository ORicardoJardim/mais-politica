// src/pages/AdminInvites.jsx
import React, { useEffect, useState } from 'react'
import { useOrg } from '../context/OrgContext'

export default function AdminInvites() {
  const { currentOrgId, currentOrg } = useOrg()
  const isAdmin = currentOrg?.role === 'admin'

  const [email, setEmail] = useState('')
  const [role, setRole] = useState('user')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function fetchInvites() {
    setError('')
    setLoading(true)
    try {
      if (!currentOrgId) { setList([]); return }
      const r = await fetch(`/api/invite?action=list&org_id=${currentOrgId}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao listar convites')
      setList(j.items || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInvites() }, [currentOrgId])

  async function createInvite(e) {
    e.preventDefault()
    if (!currentOrgId) return alert('Selecione um gabinete')
    if (!isAdmin) return alert('Apenas admins podem convidar')
    setError('')
    setSubmitting(true)
    try {
      const r = await fetch('/api/invite?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: currentOrgId, email, role })
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro ao criar convite')
      setEmail('')
      setRole('user')
      await fetchInvites()
      try {
        await navigator.clipboard.writeText(j.link)
        alert('Convite criado e link copiado!')
      } catch {
        alert(`Convite criado! Copie o link abaixo na tabela.`)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Link copiado!')
    } catch {
      alert('Não foi possível copiar. Copie manualmente.')
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Convites</h1>
        <span className="px-3 py-1 rounded-full text-xs bg-slate-100 border text-slate-700">
          {currentOrgId ? (currentOrg?.name || 'Gabinete') : 'Selecione um gabinete'}
        </span>
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-sm">
          Você é <strong>{currentOrg?.role || 'membro'}</strong> neste gabinete. Apenas <strong>admins</strong> podem criar convites.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Formulário */}
      <form
        onSubmit={createInvite}
        className="bg-white border rounded-2xl shadow-sm p-5 grid gap-3 md:grid-cols-4"
      >
        <input
          className="input md:col-span-2"
          type="email"
          placeholder="email@exemplo.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={!isAdmin || !currentOrgId || submitting}
        />
        <select
          className="input"
          value={role}
          onChange={e => setRole(e.target.value)}
          disabled={!isAdmin || !currentOrgId || submitting}
        >
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        <button
          className="btn-primary"
          disabled={!isAdmin || !currentOrgId || submitting}
          title={!isAdmin ? 'Somente admins' : (!currentOrgId ? 'Selecione um gabinete' : undefined)}
        >
          {submitting ? 'Enviando…' : 'Convidar'}
        </button>
      </form>

      {/* Lista */}
      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <h2 className="font-semibold mb-3">Convites pendentes</h2>
        {loading ? (
          'Carregando…'
        ) : (
          <div className="table-responsive">
            <table className="table w-full">
              <thead>
                <tr className="text-left">
                  <th>Email</th>
                  <th>Papel</th>
                  <th>Expira</th>
                  <th>Link</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map(it => {
                  const expired = new Date(it.expires_at) < new Date()
                  return (
                    <tr key={it.token} className={expired ? 'opacity-60' : ''}>
                      <td>{it.email}</td>
                      <td>{it.role}</td>
                      <td>
                        {new Date(it.expires_at).toLocaleString()}
                        {expired && (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded-full border bg-slate-50">
                            expirado
                          </span>
                        )}
                      </td>
                      <td className="break-all text-xs">{it.link}</td>
                      <td className="flex gap-2">
                        <button className="btn" onClick={() => copy(it.link)} disabled={expired}>
                          Copiar
                        </button>
                        <button
                          className="btn"
                          onClick={async () => {
                            if (!confirm('Cancelar este convite?')) return
                            const r = await fetch('/api/invite?action=cancel', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ token: it.token, org_id: currentOrgId })
                            })
                            const j = await r.json()
                            if (!r.ok) return alert(j.error || 'Falha ao cancelar')
                            fetchInvites()
                          }}
                        >
                          Cancelar
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {!list.length && (
                  <tr>
                    <td colSpan="5" className="text-slate-500">Nenhum convite.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
