// src/pages/SuperDashboard.jsx
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const API_BASE = import.meta.env.VITE_API_BASE || ''

async function api(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const r = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const text = await r.text()
  let payload
  try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text } }
  if (!r.ok) throw new Error(payload?.error || payload?.raw || 'Erro na API')
  return payload
}

export default function SuperDashboard() {
  // cards
  const [counts, setCounts] = useState(null)
  const [loadingCounts, setLoadingCounts] = useState(true)
  const [errorCounts, setErrorCounts] = useState('')

  // lista
  const [items, setItems] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [errorList, setErrorList] = useState('')
  const [q, setQ] = useState('')
  const [deleting, setDeleting] = useState(null) // org_id sendo excluído

  async function fetchStats() {
    setErrorCounts(''); setLoadingCounts(true)
    try {
      const j = await api('/api/super-admin-orgs?action=stats')
      setCounts(j.counts || null)
    } catch (e) {
      setErrorCounts(e.message)
    } finally {
      setLoadingCounts(false)
    }
  }

  async function fetchList() {
    setErrorList(''); setLoadingList(true)
    try {
      const j = await api('/api/super-admin-orgs?action=list')
      setItems(j.items || [])
    } catch (e) {
      setErrorList(e.message)
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    fetchStats()
    fetchList()
  }, [])

  async function onDelete(org) {
    if (!confirm(
      `Excluir o gabinete "${org.name}"?\n\n` +
      'Isto também removerá todos os membros, convites e demandas deste gabinete. Esta ação NÃO pode ser desfeita.'
    )) return

    try {
      setDeleting(org.org_id)
      await api('/api/super-admin-orgs', {
        method: 'DELETE',
        body: JSON.stringify({ org_id: org.org_id }),
      })
      // atualiza cards e lista
      await Promise.all([fetchStats(), fetchList()])
    } catch (e) {
      alert(e.message)
    } finally {
      setDeleting(null)
    }
  }

  const filtered = items.filter(it =>
    (it.name || '').toLowerCase().includes(q.toLowerCase()) ||
    (it.org_id || '').toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard (Owner)</h1>
        <button onClick={() => { fetchStats(); fetchList(); }} className="btn">
          Atualizar
        </button>
      </div>

      {/* CARDS */}
      {errorCounts && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {errorCounts}
        </div>
      )}
      {loadingCounts ? (
        <div>Carregando…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="bg-white border rounded-2xl shadow-sm p-5">
            <div className="text-sm text-slate-500">Gabinetes</div>
            <div className="text-3xl font-semibold">{counts?.orgs ?? '—'}</div>
          </div>
          <div className="bg-white border rounded-2xl shadow-sm p-5">
            <div className="text-sm text-slate-500">Usuários</div>
            <div className="text-3xl font-semibold">{counts?.users ?? '—'}</div>
          </div>
          <div className="bg-white border rounded-2xl shadow-sm p-5">
            <div className="text-sm text-slate-500">Demandas</div>
            <div className="text-3xl font-semibold">{counts?.demandas ?? '—'}</div>
          </div>
          <div className="bg-white border rounded-2xl shadow-sm p-5">
            <div className="text-sm text-slate-500">Membros (memberships)</div>
            <div className="text-3xl font-semibold">{counts?.memberships ?? '—'}</div>
          </div>
        </div>
      )}

      {/* LISTA DE GABINETES */}
      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Gabinetes</h2>
          <input
            className="input w-64"
            placeholder="Buscar por nome ou ID…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>

        {errorList && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm mb-3">
            {errorList}
          </div>
        )}

        {loadingList ? (
          'Carregando…'
        ) : (
          <div className="table-responsive">
            <table className="table w-full">
              <thead>
                <tr className="text-left">
                  <th>Nome</th>
                  <th className="hidden md:table-cell">ID</th>
                  <th>Criado em</th>
                  <th style={{width: 140}}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(org => (
                  <tr key={org.org_id}>
                    <td>{org.name}</td>
                    <td className="hidden md:table-cell text-xs text-slate-500 break-all">{org.org_id}</td>
                    <td>{org.created_at ? new Date(org.created_at).toLocaleString() : '—'}</td>
                    <td>
                      <button
                        className="btn"
                        disabled={deleting === org.org_id}
                        onClick={() => onDelete(org)}
                        title="Excluir gabinete"
                      >
                        {deleting === org.org_id ? 'Excluindo…' : 'Excluir'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan="4" className="text-slate-500">Nenhum gabinete.</td>
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
