// src/pages/SuperDashboard.jsx
import React, { useEffect, useMemo, useState } from 'react'
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

const OFFICES = [
  { value: '',              label: 'Todos os cargos' },
  { value: 'prefeito',      label: 'Prefeito(a)' },
  { value: 'vice_prefeito', label: 'Vice-prefeito(a)' },
  { value: 'vereador',      label: 'Vereador(a)' },
  { value: 'dep_estadual',  label: 'Deputado(a) Estadual' },
  { value: 'dep_federal',   label: 'Deputado(a) Federal' },
  { value: 'senador',       label: 'Senador(a)' },
]

const UFS = [
  '', 'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]

export default function SuperDashboard() {
  const [activeTab, setActiveTab] = useState('orgs') // 'orgs' | 'users'

  // ====== CARDS ======
  const [counts, setCounts] = useState(null)
  const [loadingCounts, setLoadingCounts] = useState(true)
  const [errorCounts, setErrorCounts] = useState('')

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

  // ====== ORGS (lista + filtros) ======
  const [orgItems, setOrgItems] = useState([])
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [errorOrgs, setErrorOrgs] = useState('')
  const [orgQ, setOrgQ] = useState('')
  const [orgDeleting, setOrgDeleting] = useState(null)
  const [filters, setFilters] = useState({ office: '', state: '', city: '' })

  function buildOrgsQuery() {
    const params = new URLSearchParams()
    params.set('action', 'list')
    if (filters.office) params.set('office', filters.office)
    if (filters.state)  params.set('state', filters.state)
    if (filters.city)   params.set('city', filters.city)
    return `/api/super-admin-orgs?${params.toString()}`
  }

  async function fetchOrgs() {
    setErrorOrgs(''); setLoadingOrgs(true)
    try {
      const j = await api(buildOrgsQuery())
      setOrgItems(j.items || [])
    } catch (e) {
      setErrorOrgs(e.message)
    } finally {
      setLoadingOrgs(false)
    }
  }

  const orgsFiltered = useMemo(() => {
    if (!orgQ) return orgItems
    const s = orgQ.toLowerCase()
    return orgItems.filter(it =>
      (it.name || '').toLowerCase().includes(s) ||
      (it.org_id || '').toLowerCase().includes(s) ||
      (it.city || '').toLowerCase().includes(s) ||
      (it.state || '').toLowerCase().includes(s) ||
      (it.office || '').toLowerCase().includes(s)
    )
  }, [orgItems, orgQ])

  async function onDeleteOrg(org) {
    if (!confirm(
      `Excluir o gabinete "${org.name}"?\n\n` +
      'Isto também removerá todos os membros, convites e demandas deste gabinete. Esta ação NÃO pode ser desfeita.'
    )) return

    try {
      setOrgDeleting(org.org_id)
      await api('/api/super-admin-orgs', {
        method: 'DELETE',
        body: JSON.stringify({ org_id: org.org_id }),
      })
      await Promise.all([fetchStats(), fetchOrgs()])
    } catch (e) {
      alert(e.message)
    } finally {
      setOrgDeleting(null)
    }
  }

  // ====== USERS (lista + busca + paginação) ======
  const [users, setUsers] = useState([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState('')
  const [usersQ, setUsersQ] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  async function fetchUsers(p = page, l = limit, q = usersQ) {
    setUsersError(''); setUsersLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('action', 'users')
      if (q) params.set('q', q)
      params.set('page', String(p))
      params.set('limit', String(l))

      const j = await api(`/api/super-admin-orgs?${params.toString()}`)
      setUsers(j.items || [])
      setUsersTotal(j.total || 0)
      setPage(j.page || p)
      setLimit(j.limit || l)
    } catch (e) {
      setUsersError(e.message)
    } finally {
      setUsersLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(usersTotal / limit))

  useEffect(() => { fetchStats(); fetchOrgs() }, [])

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard (Owner)</h1>
        <button onClick={() => { fetchStats(); activeTab==='orgs' ? fetchOrgs() : fetchUsers() }} className="btn">Atualizar</button>
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
            <div className="text-sm text-slate-500">Membros</div>
            <div className="text-3xl font-semibold">{counts?.memberships ?? '—'}</div>
          </div>
        </div>
      )}

      {/* ABAS */}
      <div className="bg-white border rounded-2xl shadow-sm">
        <div className="p-3 border-b flex gap-2">
          <button
            className={['px-3 py-2 rounded-full border', activeTab==='orgs' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 hover:bg-slate-50'].join(' ')}
            onClick={() => setActiveTab('orgs')}
          >
            Gabinetes
          </button>
          <button
            className={['px-3 py-2 rounded-full border', activeTab==='users' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 hover:bg-slate-50'].join(' ')}
            onClick={() => { setActiveTab('users'); fetchUsers(1, limit, usersQ) }}
          >
            Usuários
          </button>
        </div>

        {/* CONTEÚDO DA ABA */}
        <div className="p-5 space-y-6">
          {activeTab === 'orgs' && (
            <>
              {/* Filtros */}
              <div className="grid gap-3 md:grid-cols-5">
                <div>
                  <label className="block text-sm mb-1">Cargo</label>
                  <select
                    className="input w-full"
                    value={filters.office}
                    onChange={e => setFilters(f => ({ ...f, office: e.target.value }))}
                  >
                    {OFFICES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">UF</label>
                  <select
                    className="input w-full"
                    value={filters.state}
                    onChange={e => setFilters(f => ({ ...f, state: e.target.value }))}
                  >
                    {UFS.map(uf => <option key={uf} value={uf}>{uf || 'Todas'}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1">Cidade (contém)</label>
                  <input
                    className="input w-full"
                    placeholder="Ex.: Porto"
                    value={filters.city}
                    onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button className="btn" onClick={fetchOrgs}>Aplicar</button>
                  <button
                    className="btn"
                    onClick={() => { setFilters({ office: '', state: '', city: '' }); setOrgQ(''); fetchOrgs() }}
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {/* Lista de gabinetes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Gabinetes</h2>
                  <input
                    className="input w-64"
                    placeholder="Buscar por nome/ID/cidade/UF…"
                    value={orgQ}
                    onChange={e => setOrgQ(e.target.value)}
                  />
                </div>

                {errorOrgs && (
                  <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm mb-3">
                    {errorOrgs}
                  </div>
                )}

                {loadingOrgs ? (
                  'Carregando…'
                ) : (
                  <div className="table-responsive">
                    <table className="table w-full">
                      <thead>
                        <tr className="text-left">
                          <th>Nome</th>
                          <th className="hidden md:table-cell">Cargo</th>
                          <th>UF</th>
                          <th className="hidden md:table-cell">Cidade</th>
                          <th className="hidden md:table-cell">ID</th>
                          <th>Criado em</th>
                          <th style={{width: 140}}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgsFiltered.map(org => (
                          <tr key={org.org_id}>
                            <td>{org.name}</td>
                            <td className="hidden md:table-cell">{org.office || '—'}</td>
                            <td>{org.state || '—'}</td>
                            <td className="hidden md:table-cell">{org.city || '—'}</td>
                            <td className="hidden md:table-cell text-xs text-slate-500 break-all">{org.org_id}</td>
                            <td>{org.created_at ? new Date(org.created_at).toLocaleString() : '—'}</td>
                            <td>
                              <button
                                className="btn"
                                disabled={orgDeleting === org.org_id}
                                onClick={() => onDeleteOrg(org)}
                                title="Excluir gabinete"
                              >
                                {orgDeleting === org.org_id ? 'Excluindo…' : 'Excluir'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {!orgsFiltered.length && (
                          <tr>
                            <td colSpan="7" className="text-slate-500">Nenhum gabinete.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'users' && (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1">Buscar usuários (nome ou email)</label>
                  <input
                    className="input w-full"
                    placeholder="Ex.: maria@exemplo.com"
                    value={usersQ}
                    onChange={e => setUsersQ(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button className="btn" onClick={() => fetchUsers(1, limit, usersQ)}>Buscar</button>
                  <button className="btn" onClick={() => { setUsersQ(''); fetchUsers(1, limit, '') }}>Limpar</button>
                </div>
              </div>

              {usersError && (
                <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
                  {usersError}
                </div>
              )}

              {usersLoading ? (
                'Carregando…'
              ) : (
                <>
                  <div className="table-responsive">
                    <table className="table w-full">
                      <thead>
                        <tr className="text-left">
                          <th>Nome</th>
                          <th>Email</th>
                          <th>Superadmin</th>
                          <th>Criado em</th>
                          <th className="hidden md:table-cell">ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id}>
                            <td>{u.name || '—'}</td>
                            <td>{u.email}</td>
                            <td>{u.is_super_admin ? 'Sim' : 'Não'}</td>
                            <td>{u.created_at ? new Date(u.created_at).toLocaleString() : '—'}</td>
                            <td className="hidden md:table-cell text-xs text-slate-500 break-all">{u.id}</td>
                          </tr>
                        ))}
                        {!users.length && (
                          <tr><td colSpan="5" className="text-slate-500">Nenhum usuário encontrado.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginação */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-sm text-slate-600">
                      Total: <strong>{usersTotal}</strong> • Página {page} de {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="btn"
                        disabled={page <= 1}
                        onClick={() => fetchUsers(page - 1, limit, usersQ)}
                      >
                        ← Anterior
                      </button>
                      <select
                        className="input"
                        value={limit}
                        onChange={e => { const l = parseInt(e.target.value, 10) || 20; setLimit(l); fetchUsers(1, l, usersQ) }}
                        title="Itens por página"
                      >
                        {[10,20,50,100].map(n => <option key={n} value={n}>{n}/pág</option>)}
                      </select>
                      <button
                        className="btn"
                        disabled={page >= totalPages}
                        onClick={() => fetchUsers(page + 1, limit, usersQ)}
                      >
                        Próxima →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
