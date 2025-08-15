// src/pages/SuperAdminOrgs.jsx
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Link } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE || ''

async function api(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const r = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })
  const text = await r.text()
  let payload = {}
  try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text } }
  if (!r.ok) throw new Error(payload?.error || payload?.raw || 'Erro na API')
  return payload
}

export default function SuperAdminOrgs() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  async function fetchOrgs() {
    setError(''); setLoading(true)
    try {
      const j = await api('/api/super-list-orgs')
      setList(j.orgs || [])
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchOrgs() }, [])

  async function removeOrg(id, name) {
    if (!confirm(`Excluir o gabinete "${name}"? Esta ação é irreversível.`)) return
    setBusy(id); setError('')
    try {
      await api('/api/super-delete-org', {
        method: 'POST',
        body: JSON.stringify({ org_id: id }),
      })
      await fetchOrgs()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">Super Admin — Gabinetes</h1>
        <Link to="/" className="px-3 py-2 rounded-full border border-slate-200 hover:bg-slate-50 no-underline">
          Voltar
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm mb-3">
          {error}
        </div>
      )}

      <div className="bg-white border rounded-2xl shadow-sm p-5">
        {loading ? (
          'Carregando…'
        ) : (
          <div className="table-responsive">
            <table className="table w-full align-middle">
              <thead>
                <tr className="text-left">
                  <th>Nome</th>
                  <th>ID</th>
                  <th>Stripe</th>
                  <th>Criado em</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map(o => (
                  <tr key={o.id}>
                    <td className="font-medium">{o.name}</td>
                    <td className="text-xs break-all">{o.id}</td>
                    <td className="text-xs">{o.stripe_customer_id || '—'}</td>
                    <td>{new Date(o.created_at).toLocaleString()}</td>
                    <td className="text-right">
                      <button
                        className="btn"
                        disabled={busy === o.id}
                        onClick={() => removeOrg(o.id, o.name)}
                      >
                        {busy === o.id ? 'Excluindo…' : 'Excluir'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!list.length && (
                  <tr><td colSpan="5" className="text-slate-500">Nenhum gabinete.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
