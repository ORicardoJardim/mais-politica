// src/pages/Relatorios.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrg } from '../context/OrgContext'

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
  let payload; try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text } }
  if (!r.ok) throw new Error(payload?.error || payload?.raw || 'Erro na API')
  return payload
}

const todayISO = () => new Date().toISOString().slice(0,10)
const minusDaysISO = (n) => new Date(Date.now() - n*24*3600*1000).toISOString().slice(0,10)

export default function Relatorios() {
  const { currentOrgId, currentOrg } = useOrg()
  const [from, setFrom] = useState(minusDaysISO(30))
  const [to, setTo] = useState(todayISO())

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  async function fetchReports() {
    if (!currentOrgId) return
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ action: 'overview', org_id: currentOrgId, from, to })
      const j = await api(`/api/reports?${params.toString()}`)
      setData(j || null)
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchReports() }, [currentOrgId])

  const maxCity = useMemo(() => Math.max(1, ...(data?.votersByCity?.map(x => x.count) || [1])), [data])
  const maxTag  = useMemo(() => Math.max(1, ...(data?.votersByTag?.map(x => x.count) || [1])), [data])
  const maxSt   = useMemo(() => Math.max(1, ...(data?.demandasByStatus?.map(x => x.count) || [1])), [data])

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <span className="px-3 py-1 rounded-full text-xs bg-slate-100 border text-slate-700">
          {currentOrg?.name || 'Gabinete'}
        </span>
      </div>

      {/* Filtros */}
      <div className="bg-white border rounded-2xl shadow-sm p-5">
        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
        <div className="grid gap-3 md:grid-cols-6 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Período inicial</label>
            <input className="input w-full" type="date" value={from} onChange={e=>setFrom(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Período final</label>
            <input className="input w-full" type="date" value={to} onChange={e=>setTo(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={() => { setFrom(minusDaysISO(7)); setTo(todayISO()); }}>7d</button>
            <button className="btn" onClick={() => { setFrom(minusDaysISO(30)); setTo(todayISO()); }}>30d</button>
            <button className="btn" onClick={() => { setFrom(minusDaysISO(90)); setTo(todayISO()); }}>90d</button>
          </div>
          <div className="text-right">
            <button className="btn-primary" onClick={fetchReports} disabled={!currentOrgId || loading}>
              {loading ? 'Carregando…' : 'Aplicar filtros'}
            </button>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Eleitores (total)" value={data?.cards?.voters_total ?? '—'} />
        <Card title="Eleitores no período" value={data?.cards?.voters_period ?? '—'} />
        <Card title="Demandas (período)" value={data?.cards?.demandas_total_periodo ?? '—'} />
        <Card title="Prazo vencido (período)" value={data?.cards?.demandas_sla_vencido ?? '—'} />
      </div>

      {/* Listas com barrinhas */}
      <div className="grid gap-4 md:grid-cols-2">
        <Box title="Eleitores por cidade (top 10)">
          {!data ? '—' : (
            <ul className="space-y-2">
              {data.votersByCity?.map((it) => (
                <li key={it.city} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{it.city}</span>
                    <span className="text-slate-600">{it.count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded">
                    <div className="h-2 rounded bg-slate-300" style={{ width: `${(it.count / maxCity) * 100}%` }} />
                  </div>
                </li>
              ))}
              {!data?.votersByCity?.length && <div className="text-slate-500">Sem dados no período.</div>}
            </ul>
          )}
        </Box>

        <Box title="Eleitores por tag (top 10)">
          {!data ? '—' : (
            <ul className="space-y-2">
              {data.votersByTag?.map((t) => (
                <li key={t.tag_id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                      <span className="font-medium">{t.name}</span>
                    </span>
                    <span className="text-slate-600">{t.count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded">
                    <div className="h-2 rounded" style={{ width: `${(t.count / maxTag) * 100}%`, backgroundColor: t.color || '#64748b' }} />
                  </div>
                </li>
              ))}
              {!data?.votersByTag?.length && <div className="text-slate-500">Sem dados.</div>}
            </ul>
          )}
        </Box>
      </div>

      <Box title="Demandas por status (período)">
        {!data ? '—' : (
          <ul className="space-y-2">
            {data.demandasByStatus?.map((s) => (
              <li key={s.status} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.status}</span>
                  <span className="text-slate-600">{s.count}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded">
                  <div className="h-2 rounded bg-slate-300" style={{ width: `${(s.count / maxSt) * 100}%` }} />
                </div>
              </li>
            ))}
            {!data?.demandasByStatus?.length && <div className="text-slate-500">Sem dados no período.</div>}
          </ul>
        )}
      </Box>
    </div>
  )
}

function Card({ title, value }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  )
}
function Box({ title, children }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5">
      <h2 className="font-semibold mb-3">{title}</h2>
      {children}
    </div>
  )
}
