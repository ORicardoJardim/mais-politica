// src/pages/AdminDashboard.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'

const API_BASE = import.meta.env.VITE_API_BASE || ''

async function api(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const url = `${API_BASE}${path}`
  const r = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const txt = await r.text()
  let payload = {}
  try { payload = txt ? JSON.parse(txt) : {} } catch { payload = { raw: txt } }
  if (!r.ok) throw new Error(payload?.error || payload?.raw || 'Erro na API')
  return payload
}

/** Paleta de cores para tags */
const TAG_COLORS = [
  '#0ea5e9', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6',
  '#14b8a6', '#e11d48', '#a3e635', '#06b6d4', '#64748b'
]

// Papéis permitidos pelo backend (/api/admin)
const ROLES = ['viewer', 'assessor', 'admin']

export default function AdminDashboard() {
  const { user } = useAuth()
  const { currentOrgId, currentOrg } = useOrg()
  const isAdmin = currentOrg?.role === 'admin'
  const isAdminOwner = currentOrg?.role === 'admin' || currentOrg?.role === 'owner'

  // ======= CÓDIGO DO GABINETE =======
  const [orgCode, setOrgCode] = useState('')
  const [codeLoading, setCodeLoading] = useState(true)
  const [codeErr, setCodeErr] = useState('')
  const [rotating, setRotating] = useState(false)

  async function fetchOrgCode() {
    setCodeErr(''); setCodeLoading(true)
    try {
      if (!currentOrgId || !isAdmin) { setOrgCode(''); return }
      const { data, error } = await supabase
        .from('orgs')
        .select('join_code')
        .eq('id', currentOrgId)
        .maybeSingle()
      if (error) throw error
      setOrgCode(data?.join_code || '')
    } catch (e) { setCodeErr(e.message) }
    finally { setCodeLoading(false) }
  }
  useEffect(() => { fetchOrgCode() }, [currentOrgId, isAdmin])

  async function rotateCode() {
    if (!currentOrgId) return
    if (!confirm('Gerar um novo código? O anterior deixa de valer.')) return
    setRotating(true); setCodeErr('')
    try {
      const { data, error } = await supabase.rpc('rotate_org_code', { p_org_id: currentOrgId })
      if (error) throw error
      setOrgCode(data || '')
    } catch (e) { alert(e.message || 'Falha ao girar código') }
    finally { setRotating(false) }
  }

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); alert('Copiado!') }
    catch { alert('Não foi possível copiar.') }
  }

  // ======= PEDIDOS DE ENTRADA =======
  const [joinReqs, setJoinReqs] = useState([])
  const [joinLoading, setJoinLoading] = useState(true)
  const [joinErr, setJoinErr] = useState('')
  const [decidingId, setDecidingId] = useState(null)

  async function fetchJoinRequests() {
    if (!currentOrgId) { setJoinReqs([]); setJoinLoading(false); return }
    setJoinErr(''); setJoinLoading(true)
    try {
      const { data, error } = await supabase
        .from('org_join_requests')
        .select('id, requester_id, note, status, created_at, decided_at, decided_by, profiles!org_join_requests_requester_id_fkey(name,email)')
        .eq('org_id', currentOrgId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      if (error) throw error
      setJoinReqs(data || [])
    } catch (e) { setJoinErr(e.message) }
    finally { setJoinLoading(false) }
  }
  useEffect(() => { fetchJoinRequests() }, [currentOrgId])

  async function decideJoin(id, decision) {
  if (!confirm(`${decision === 'approved' ? 'Aprovar' : 'Negar'} este pedido?`)) return
  setDecidingId(id)
  try {
    const params = {
      p_request_id: id,
      p_decision: decision,
      ...(decision === 'approved' ? { p_role: 'viewer' } : {}) // << aqui: viewer
    }
    const { error } = await supabase.rpc('decide_org_join', params)
    if (error) throw error
    await fetchJoinRequests()
  } catch (e) {
    alert(e.message)
  } finally {
    setDecidingId(null)
  }
}


  // =================== CONVITES ===================
  const [invEmail, setInvEmail] = useState('')
  const [invRole, setInvRole] = useState('viewer')
  const [invites, setInvites] = useState([])
  const [invLoading, setInvLoading] = useState(true)
  const [invSubmitting, setInvSubmitting] = useState(false)
  const [invError, setInvError] = useState('')

  async function fetchInvites() {
    if (!currentOrgId) { setInvites([]); setInvLoading(false); return }
    setInvError(''); setInvLoading(true)
    try {
      const j = await api(`/api/invite?action=list&org_id=${encodeURIComponent(currentOrgId)}`)
      setInvites(j.items || [])
    } catch (e) { setInvError(e.message) }
    finally { setInvLoading(false) }
  }
  useEffect(() => { fetchInvites() }, [currentOrgId])

  async function createInvite(e) {
    e.preventDefault()
    if (!isAdmin) return
    setInvSubmitting(true); setInvError('')
    try {
      await api('/api/invite?action=create', {
        method: 'POST',
        body: JSON.stringify({ org_id: currentOrgId, email: invEmail, role: invRole })
      })
      setInvEmail(''); setInvRole('viewer')
      await fetchInvites()
    } catch (e) { setInvError(e.message) }
    finally { setInvSubmitting(false) }
  }

  async function cancelInvite(token) {
    if (!confirm('Cancelar este convite?')) return
    try {
      await api('/api/invite?action=cancel', { method:'POST', body: JSON.stringify({ token, org_id: currentOrgId }) })
      await fetchInvites()
    } catch (e) { alert(e.message) }
  }

  // =================== USUÁRIOS ===================
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState('')
  const [savingRoleId, setSavingRoleId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [q, setQ] = useState('')

  const ROLE_OPTIONS = [
    { value: 'viewer',   label: 'viewer' },
    { value: 'assessor', label: 'assessor' },
    { value: 'admin',    label: 'admin' },
  ]

  async function fetchUsers() {
    if (!currentOrgId) {
      setUsers([]); setUsersLoading(false)
      return
    }
    setUsersError(''); setUsersLoading(true)
    try {
      const j = await api(`/api/admin?action=list&org_id=${encodeURIComponent(currentOrgId)}`)
      setUsers(j.users || [])
    } catch (e) {
      setUsersError(e.message)
    } finally {
      setUsersLoading(false)
    }
  }
  useEffect(() => { fetchUsers() }, [currentOrgId])

  const filteredUsers = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return users
    return users.filter(u =>
      (u.name || '').toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s)
    )
  }, [users, q])

  async function changeRole(user_id, role) {
    if (!currentOrgId) return
    const current = users.find(u => u.id === user_id)?.role || 'viewer'
    if (current === role) return

    setSavingRoleId(user_id)
    try {
      await api('/api/admin?action=update', {
        method: 'POST',
        body: JSON.stringify({ id: user_id, role, org_id: currentOrgId })
      })
      setUsers(l => l.map(u => u.id === user_id ? { ...u, role } : u))
    } catch (e) {
      alert(e.message)
    } finally {
      setSavingRoleId(null)
    }
  }

  async function deleteUser(user_id) {
    if (!currentOrgId) return
    if (!confirm('Remover este usuário do gabinete?')) return
    setDeletingId(user_id)
    try {
      await api('/api/admin?action=remove', {
        method: 'POST',
        body: JSON.stringify({ id: user_id, org_id: currentOrgId })
      })
      setUsers(l => l.filter(u => u.id !== user_id))
    } catch (e) { alert(e.message) }
    finally { setDeletingId(null) }
  }

  // =================== TAGS ===================
  const [tags, setTags] = useState([])
  const [tagsLoading, setTagsLoading] = useState(true)
  const [tagsError, setTagsError] = useState('')
  const [tagForm, setTagForm] = useState({ name:'', color: TAG_COLORS[9] })
  const [savingTag, setSavingTag] = useState(false)
  const [editing, setEditing] = useState(null) // { id, name, color }
  const [savingEdit, setSavingEdit] = useState(false)

  async function fetchTags() {
    if (!currentOrgId) { setTags([]); setTagsLoading(false); return }
    setTagsLoading(true); setTagsError('')
    try {
      const j = await api(`/api/tags?org_id=${currentOrgId}`)
      setTags(j.items || [])
    } catch (e) { setTagsError(e.message) }
    finally { setTagsLoading(false) }
  }
  useEffect(() => { fetchTags() }, [currentOrgId])

  async function createTag(e) {
    e.preventDefault()
    if (!isAdmin) return
    setSavingTag(true)
    try {
      await api('/api/tags', { method:'POST', body: JSON.stringify({ org_id: currentOrgId, ...tagForm }) })
      setTagForm({ name:'', color: TAG_COLORS[9] })
      await fetchTags()
    } catch (e) { setTagsError(e.message) }
    finally { setSavingTag(false) }
  }

  async function saveEditTag() {
    if (!editing) return
    setSavingEdit(true)
    try {
      await api('/api/tags', { method:'PATCH', body: JSON.stringify({ id: editing.id, name: editing.name, color: editing.color }) })
      setEditing(null)
      await fetchTags()
    } catch (e) { alert(e.message) }
    finally { setSavingEdit(false) }
  }

  async function removeTag(id) {
    if (!confirm('Excluir esta tag?')) return
    try {
      await api('/api/tags', { method: 'DELETE', body: JSON.stringify({ id }) })
      await fetchTags()
    } catch (e) { alert(e.message) }
  }

  // =================== RENDER ===================
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* heading */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Painel do Administrador</h1>
          <div className="text-sm text-slate-600">
            Gabinete atual: <span className="font-medium">{currentOrg?.name || '—'}</span>
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full border text-xs bg-slate-50 border-slate-200 text-slate-700">
              {currentOrg?.role || 'viewer'}
            </span>
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-sm">
          Você é <strong>{currentOrg?.role || 'membro'}</strong>. Apenas <strong>admins</strong> podem criar, editar e excluir.
        </div>
      )}

      {/* CÓDIGO DO GABINETE */}
      {isAdmin && (
        <div className="bg-white border rounded-2xl shadow-sm">
          <div className="p-5 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Código do gabinete</h2>
              <p className="text-sm text-slate-600">
                Compartilhe este código com quem precisa pedir acesso. O admin deve aprovar em “Pedidos de entrada”.
              </p>
            </div>
          </div>

          {codeErr && (
            <div className="px-5 pt-5">
              <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{codeErr}</div>
            </div>
          )}

          <div className="p-5 flex flex-wrap items-center gap-3">
            <input
              className="input w-56 font-mono text-center"
              value={codeLoading ? 'Carregando…' : (orgCode || '—')}
              readOnly
            />
            <button className="btn" onClick={() => copy(orgCode)} disabled={!orgCode || codeLoading}>Copiar</button>
            <button className="btn" onClick={rotateCode} disabled={codeLoading || rotating}>
              {rotating ? 'Gerando…' : 'Gerar novo código'}
            </button>
          </div>
        </div>
      )}

      {/* PEDIDOS DE ENTRADA */}
      <div className="bg-white border rounded-2xl shadow-sm">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Pedidos de entrada</h2>
            <p className="text-sm text-slate-600">Aprovar/Negar solicitações para este gabinete.</p>
          </div>
        </div>

        {joinErr && (
          <div className="px-5 pt-5">
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{joinErr}</div>
          </div>
        )}

        <div className="p-5">
          {joinLoading ? 'Carregando…' : (
            <div className="table-responsive">
              <table className="table w-full">
                <thead>
                  <tr className="text-left">
                    <th>Solicitante</th>
                    <th className="hidden md:table-cell">E-mail</th>
                    <th className="hidden md:table-cell">Mensagem</th>
                    <th style={{width:220}}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {joinReqs.map(r => (
                    <tr key={r.id}>
                      <td className="font-medium">{r.profiles?.name || '—'}</td>
                      <td className="hidden md:table-cell">{r.profiles?.email || '—'}</td>
                      <td className="hidden md:table-cell">{r.note || '—'}</td>
                      <td className="flex gap-2">
                        <button
                          className="btn-primary"
                          onClick={() => decideJoin(r.id, 'approved')}
                          disabled={decidingId === r.id}
                        >
                          {decidingId === r.id ? 'Processando…' : 'Aprovar'}
                        </button>
                        <button
                          className="btn"
                          onClick={() => decideJoin(r.id, 'denied')}
                          disabled={decidingId === r.id}
                        >
                          Negar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!joinReqs.length && (
                    <tr><td colSpan="4" className="text-slate-500">Nenhum pedido pendente.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CONVITES */}
      <div className="bg-white border rounded-2xl shadow-sm">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Convites do gabinete</h2>
            <p className="text-sm text-slate-600">Gere links para que novos membros entrem no gabinete.</p>
          </div>
        </div>

        {invError && (
          <div className="px-5 pt-5">
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{invError}</div>
          </div>
        )}

        {/* Criar convite */}
        <div className="p-5 border-b">
          <form onSubmit={createInvite} className="grid gap-3 md:grid-cols-4">
            <input
              className="input md:col-span-2"
              type="email"
              placeholder="email@exemplo.com"
              value={invEmail}
              onChange={e=>setInvEmail(e.target.value)}
              disabled={!isAdmin || !currentOrgId || invSubmitting}
            />
            <select
              className="input"
              value={invRole}
              onChange={e=>setInvRole(e.target.value)}
              disabled={!isAdmin || !currentOrgId || invSubmitting}
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              className="btn-primary"
              disabled={!isAdmin || !currentOrgId || invSubmitting}
              title={!isAdmin ? 'Somente admins' : (!currentOrgId ? 'Selecione um gabinete' : undefined)}
            >
              {invSubmitting ? 'Gerando…' : 'Gerar convite'}
            </button>
          </form>
        </div>

        {/* Lista convites */}
        <div className="p-5">
          <h3 className="font-semibold mb-2">Convites pendentes</h3>
          {invLoading ? 'Carregando…' : (
            <div className="table-responsive">
              <table className="table w-full">
                <thead>
                  <tr className="text-left">
                    <th>Email</th>
                    <th style={{width:120}}>Papel</th>
                    <th style={{width:160}}>Expira</th>
                    <th>Link</th>
                    <th style={{width:200}}></th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map(it => {
                    const expired = new Date(it.expires_at) < new Date()
                    return (
                      <tr key={it.token} className={expired ? 'opacity-60' : ''}>
                        <td>{it.email}</td>
                        <td>{it.role}</td>
                        <td>{new Date(it.expires_at).toLocaleString()}</td>
                        <td className="break-all text-xs">{it.link}</td>
                        <td className="flex gap-2">
                          <button className="btn" onClick={() => copy(it.link)} disabled={expired}>Copiar</button>
                          <button className="btn" onClick={() => cancelInvite(it.token)} disabled={!isAdmin}>Cancelar</button>
                        </td>
                      </tr>
                    )
                  })}
                  {!invites.length && (
                    <tr><td colSpan="5" className="text-slate-500">Nenhum convite.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* USUÁRIOS */}
      <div className="bg-white border rounded-2xl shadow-sm">
        <div className="p-5 border-b">
          <h2 className="font-semibold">Usuários do gabinete</h2>
          <p className="text-sm text-slate-600">Altere a função ou remova membros. Para adicionar, use os convites acima.</p>
        </div>

        {usersError && (
          <div className="px-5 pt-5">
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{usersError}</div>
          </div>
        )}

        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-slate-600">
              {usersLoading ? 'Carregando…' : <>Total: <strong>{users.length}</strong></>}
            </div>
            <input
              className="input w-64"
              placeholder="Buscar por nome/email…"
              value={q}
              onChange={e => setQ(e.target.value)}
              title="Filtrar"
            />
          </div>

          <div className="table-responsive">
            <table className="table w-full">
              <thead>
                <tr className="text-left">
                  <th>Nome</th>
                  <th className="hidden md:table-cell">E-mail</th>
                  <th style={{width:180}}>Função</th>
                  <th style={{width:140}}></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.name || '—'}</td>
                    <td className="hidden md:table-cell">{u.email || '—'}</td>
                    <td>
                      <select
                        className="input"
                        value={u.role || 'viewer'}
                        onChange={e => changeRole(u.id, e.target.value)}
                        disabled={!isAdmin || savingRoleId === u.id}
                        title="Alterar função"
                      >
                        {ROLE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="text-right">
                      <button
                        className="btn"
                        onClick={() => deleteUser(u.id)}
                        disabled={!isAdmin || deletingId === u.id}
                        title="Remover usuário do gabinete"
                      >
                        {deletingId === u.id ? 'Removendo…' : 'Remover'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!usersLoading && !filteredUsers.length && (
                  <tr><td colSpan="4" className="text-slate-500">Nenhum usuário neste gabinete.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* TAGS */}
      <div className="bg-white border rounded-2xl shadow-sm">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Tags do gabinete</h2>
            <p className="text-sm text-slate-600">Crie categorias para os cadastros de eleitores/contatos.</p>
          </div>
          {!isAdmin && <span className="text-xs px-2 py-1 rounded-full border bg-slate-50">Somente admin pode criar/editar</span>}
        </div>

        {tagsError && (
          <div className="px-5 pt-5">
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{tagsError}</div>
          </div>
        )}

        {/* Criar tag */}
        <div className="p-5 border-b">
          <form onSubmit={createTag} className="grid gap-3 md:grid-cols-5 items-end">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Nome</label>
              <input
                className="input w-full"
                value={tagForm.name}
                onChange={e => setTagForm(f => ({ ...f, name: e.target.value }))}
                disabled={!isAdmin}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Cor</label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setTagForm(f => ({ ...f, color: c }))}
                    className={[
                      'w-8 h-8 rounded-full border',
                      tagForm.color === c ? 'ring-2 ring-offset-2' : ''
                    ].join(' ')}
                    style={{ backgroundColor: c, borderColor: '#e5e7eb' }}
                    title={c}
                    disabled={!isAdmin}
                  />
                ))}
              </div>
            </div>
            <div>
              <button className="btn-primary w-full" disabled={!isAdmin || savingTag}>
                {savingTag ? 'Criando…' : 'Criar tag'}
              </button>
            </div>
          </form>
        </div>

        {/* Lista de tags */}
        <div className="p-5">
          {tagsLoading ? 'Carregando…' : (
            <div className="table-responsive">
              <table className="table w-full">
                <thead>
                  <tr className="text-left">
                    <th>Nome</th>
                    <th style={{width:100}}>Cor</th>
                    <th className="hidden md:table-cell">ID</th>
                    <th style={{width:200}}></th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map(t => (
                    <tr key={t.id}>
                      <td>
                        {editing?.id === t.id ? (
                          <input
                            className="input"
                            value={editing.name}
                            onChange={e => setEditing({ ...editing, name: e.target.value })}
                          />
                        ) : (
                          <span className="font-medium">{t.name}</span>
                        )}
                      </td>
                      <td>
                        {editing?.id === t.id ? (
                          <div className="flex flex-wrap gap-2">
                            {TAG_COLORS.map(c => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setEditing({ ...editing, color: c })}
                                className={[
                                  'w-7 h-7 rounded-full border',
                                  editing.color === c ? 'ring-2 ring-offset-2' : ''
                                ].join(' ')}
                                style={{ backgroundColor: c, borderColor: '#e5e7eb' }}
                                title={c}
                                disabled={!isAdmin}
                              />
                            ))}
                          </div>
                        ) : (
                          <span
                            className="inline-block w-5 h-5 rounded-full border"
                            style={{ backgroundColor: t.color || '#64748b', borderColor: '#e5e7eb' }}
                            title={t.color}
                          />
                        )}
                      </td>
                      <td className="hidden md:table-cell text-xs text-slate-500">{t.id}</td>
                      <td className="flex gap-2">
                        {editing?.id === t.id ? (
                          <>
                            <button className="btn-primary" onClick={saveEditTag} disabled={savingEdit}>Salvar</button>
                            <button className="btn" onClick={() => setEditing(null)}>Cancelar</button>
                          </>
                        ) : (
                          <>
                            <button className="btn" disabled={!isAdmin} onClick={() => setEditing(t)}>Editar</button>
                            <button className="btn" disabled={!isAdmin} onClick={() => removeTag(t.id)}>Excluir</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!tags.length && (
                    <tr><td colSpan="4" className="text-slate-500">Nenhuma tag.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
