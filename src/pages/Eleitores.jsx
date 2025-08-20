// src/pages/Eleitores.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrg } from '../context/OrgContext'
import { Pencil, Trash2, Tag, Plus } from 'lucide-react'


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

export default function Eleitores() {
  const { currentOrgId, currentOrg } = useOrg()

  // filtros e listagem
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [q, setQ] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // cadastro rápido
  const [form, setForm] = useState({ name:'', phone:'', city:'', email:'', birthdate:'' })
  const [quickTags, setQuickTags] = useState([]) // ids selecionados
  const [saving, setSaving] = useState(false)

  // cadastro completo (na página)
  const [fullOpen, setFullOpen] = useState(false)
  const [fullForm, setFullForm] = useState({
    name:'', phone:'', email:'', birthdate:'', city:'', state:'', address:'', zipcode:'', notes:''
  })
  const [fullTags, setFullTags] = useState([])
  const [savingFull, setSavingFull] = useState(false)

  // tags do gabinete
  const [tagsList, setTagsList] = useState([])
  const [tagsLoading, setTagsLoading] = useState(false)

  // editor (modal) – cadastro completo já existente
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSaving, setEditorSaving] = useState(false)
  const [editorError, setEditorError] = useState('')
  const [editorId, setEditorId] = useState(null)
  const [editorForm, setEditorForm] = useState({
    name:'', phone:'', email:'', city:'', state:'', address:'', zipcode:'', notes:'', birthdate:''
  })
  const [editorVoterTags, setEditorVoterTags] = useState([])
  const [editorAddTagId, setEditorAddTagId] = useState('')

  const editorAvailableTags = useMemo(
    () => tagsList.filter(t => !editorVoterTags.some(vt => vt.id === t.id)),
    [tagsList, editorVoterTags]
  )

  async function fetchList(p = page, l = limit, search = q) {
    if (!currentOrgId) return
    setError(''); setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('org_id', currentOrgId)
      params.set('page', String(p))
      params.set('limit', String(l))
      if (search) params.set('q', search)
      if (tagFilter) params.set('tag_id', tagFilter)

      const j = await api(`/api/voters?${params.toString()}`)
      setItems(j.items || [])
      setTotal(j.total || 0)
      setPage(j.page || p)
      setLimit(j.limit || l)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList(1, limit, q) }, [currentOrgId, tagFilter])
  useEffect(() => {
    async function loadTags() {
      if (!currentOrgId) { setTagsList([]); return }
      setTagsLoading(true)
      try {
        const j = await api(`/api/tags?org_id=${currentOrgId}`)
        setTagsList(j.items || [])
      } catch (e) { console.error(e) }
      finally { setTagsLoading(false) }
    }
    loadTags()
  }, [currentOrgId])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  // ===== criar rápido (com birthdate e tags) =====
  async function createQuick(e) {
    e.preventDefault()
    if (!currentOrgId) return alert('Selecione um gabinete')
    if (!form.name || !form.phone || !form.city) {
      return alert('Nome, telefone e cidade são obrigatórios.')
    }
    setSaving(true); setError('')
    try {
      const created = await api('/api/voters', {
        method:'POST',
        body: JSON.stringify({ org_id: currentOrgId, ...form })
      })
      // pega id correto do payload
      const voterId = created?.item?.id
      if (voterId && quickTags.length) {
        for (const tag_id of quickTags) {
          await api('/api/voters?action=add_tag', { method:'POST', body: JSON.stringify({ voter_id: voterId, tag_id }) })
        }
      }
      setForm({ name:'', phone:'', city:'', email:'', birthdate:'' })
      setQuickTags([])
      await fetchList(1, limit, q)
    } catch (e) {
      setError(e.message)
    } finally { setSaving(false) }
  }

  // ===== criar completo (na página) =====
  async function createFull(e) {
    e.preventDefault()
    if (!currentOrgId) return alert('Selecione um gabinete')
    if (!fullForm.name || !fullForm.phone) return alert('Nome e telefone são obrigatórios.')
    setSavingFull(true); setError('')
    try {
      const created = await api('/api/voters', {
        method:'POST',
        body: JSON.stringify({ org_id: currentOrgId, ...fullForm })
      })
      const voterId = created?.item?.id
      if (voterId && fullTags.length) {
        for (const tag_id of fullTags) {
          await api('/api/voters?action=add_tag', { method:'POST', body: JSON.stringify({ voter_id: voterId, tag_id }) })
        }
      }
      setFullForm({ name:'', phone:'', email:'', birthdate:'', city:'', state:'', address:'', zipcode:'', notes:'' })
      setFullTags([])
      setFullOpen(false)
      await fetchList(1, limit, q)
      alert('Cadastro criado!')
    } catch (e) {
      setError(e.message)
    } finally { setSavingFull(false) }
  }

  // ===== TAGS por eleitor (linha) =====
  async function fetchVoterTags(voter_id) {
    const j = await api(`/api/voters?action=tags&voter_id=${voter_id}`)
    return j.items || []
  }
  async function addTagToVoter(voter_id, tag_id) {
    await api('/api/voters?action=add_tag', { method:'POST', body: JSON.stringify({ voter_id, tag_id }) })
  }
  async function removeTagFromVoter(voter_id, tag_id) {
    await api('/api/voters?action=remove_tag', { method:'DELETE', body: JSON.stringify({ voter_id, tag_id }) })
  }

  // ===== EDITOR (modal, já existente) =====
  async function openEditor(id) {
    setEditorId(id)
    setEditorOpen(true)
    setEditorError('')
    try {
      const { data, error } = await supabase.from('voters').select('*').eq('id', id).single()
      if (error) throw new Error(error.message)
      setEditorForm({
        name: data.name || '',
        phone: data.phone || '',
        email: data.email || '',
        birthdate: data.birthdate || '',
        city: data.city || '',
        state: data.state || '',
        address: data.address || '',
        zipcode: data.zipcode || '',
        notes: data.notes || '',
      })
      const vt = await fetchVoterTags(id)
      setEditorVoterTags(vt)
      setEditorAddTagId('')
    } catch (e) {
      setEditorError(e.message)
    }
  }
  function closeEditor() {
    setEditorOpen(false)
    setEditorId(null)
    setEditorForm({ name:'', phone:'', email:'', birthdate:'', city:'', state:'', address:'', zipcode:'', notes:'' })
    setEditorVoterTags([])
    setEditorAddTagId('')
    setEditorSaving(false)
    setEditorError('')
  }
  async function saveEditor(e) {
    e.preventDefault()
    if (!editorId) return
    setEditorSaving(true); setEditorError('')
    try {
      await api('/api/voters', { method:'PATCH', body: JSON.stringify({ id: editorId, ...editorForm }) })
      await fetchList(page, limit, q)
      alert('Dados salvos!')
      closeEditor()
    } catch (e) {
      setEditorError(e.message)
    } finally {
      setEditorSaving(false)
    }
  }
  async function editorAddTag() {
    if (!editorId || !editorAddTagId) return
    try {
      await addTagToVoter(editorId, editorAddTagId)
      const vt = await fetchVoterTags(editorId)
      setEditorVoterTags(vt)
      setEditorAddTagId('')
    } catch (e) { alert(e.message) }
  }
  async function editorRemoveTag(tag_id) {
    if (!editorId) return
    if (!confirm('Remover esta tag?')) return
    try {
      await removeTagFromVoter(editorId, tag_id)
      const vt = await fetchVoterTags(editorId)
      setEditorVoterTags(vt)
    } catch (e) { alert(e.message) }
  }

  async function remove(id) {
    if (!confirm('Excluir este cadastro?')) return
    try {
      await api('/api/voters', { method: 'DELETE', body: JSON.stringify({ id }) })
      await fetchList(page, limit, q)
    } catch (e) { alert(e.message) }
  }

  // ===== UI =====
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Eleitores / Contatos</h1>
        <span className="px-3 py-1 rounded-full text-xs bg-slate-100 border text-slate-700">
          {currentOrg?.name || 'Gabinete'}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Cadastro rápido */}
      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <h2 className="font-semibold mb-3">Cadastro rápido</h2>
        <form onSubmit={createQuick} className="grid gap-3 md:grid-cols-5">
          <input className="input md:col-span-2" placeholder="Nome *"
                 value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))}/>
          <input className="input" placeholder="Telefone *"
                 value={form.phone} onChange={e=>setForm(f=>({...f, phone:e.target.value}))}/>
          <input className="input" placeholder="Cidade *"
                 value={form.city} onChange={e=>setForm(f=>({...f, city:e.target.value}))}/>
          <input className="input" type="email" placeholder="E-mail (opcional)"
                 value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))}/>
          <div className="md:col-span-1">
            <input className="input w-full" type="date" title="Data de nascimento"
                   value={form.birthdate} onChange={e=>setForm(f=>({...f, birthdate:e.target.value}))}/>
          </div>

          {/* Tags no cadastro rápido */}
          <div className="md:col-span-5 flex flex-wrap items-center gap-2">
            <select
              className="input"
              value=""
              onChange={e => {
                const id = e.target.value
                if (!id) return
                if (!quickTags.includes(id)) setQuickTags(t => [...t, id])
              }}
              disabled={tagsLoading || !tagsList.length}
              title="Adicionar tag"
            >
              <option value="">{tagsLoading ? 'Carregando tags…' : 'Adicionar tag…'}</option>
              {tagsList
                .filter(t => !quickTags.includes(String(t.id)))
                .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            {quickTags.map(id => {
              const t = tagsList.find(x => String(x.id) === String(id))
              if (!t) return null
              return (
                <span key={id} className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs border"
                      style={{ backgroundColor: '#fff', borderColor: '#e5e7eb' }}>
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: t.color || '#64748b' }} />
                  {t.name}
                  <button className="text-slate-500 hover:text-red-600"
                          onClick={() => setQuickTags(qq => qq.filter(x => x !== id))}>×</button>
                </span>
              )
            })}
          </div>

          <div className="md:col-span-5">
            <button className="btn-primary" disabled={saving || !currentOrgId}>
              {saving ? 'Salvando…' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>

      {/* Cadastro completo (na página) */}
      <div className="bg-white border rounded-2xl shadow-sm">
        <div className="p-5 flex items-center justify-between">
          <h2 className="font-semibold">Cadastro completo</h2>
          <button className="btn" onClick={() => setFullOpen(v => !v)}>
            {fullOpen ? 'Fechar' : 'Abrir'}
          </button>
        </div>
        {fullOpen && (
          <form onSubmit={createFull} className="p-5 grid gap-3 md:grid-cols-2">
            <input className="input md:col-span-2" placeholder="Nome *"
                   value={fullForm.name} onChange={e=>setFullForm(f=>({...f, name:e.target.value}))}/>
            <input className="input" placeholder="Telefone *"
                   value={fullForm.phone} onChange={e=>setFullForm(f=>({...f, phone:e.target.value}))}/>
            <input className="input" type="email" placeholder="E-mail"
                   value={fullForm.email} onChange={e=>setFullForm(f=>({...f, email:e.target.value}))}/>
            <input className="input" type="date" title="Data de nascimento"
                   value={fullForm.birthdate} onChange={e=>setFullForm(f=>({...f, birthdate:e.target.value}))}/>
            <input className="input" placeholder="Cidade"
                   value={fullForm.city} onChange={e=>setFullForm(f=>({...f, city:e.target.value}))}/>
            <input className="input" placeholder="Estado (UF)"
                   value={fullForm.state} onChange={e=>setFullForm(f=>({...f, state:e.target.value}))}/>
            <input className="input md:col-span-2" placeholder="Endereço"
                   value={fullForm.address} onChange={e=>setFullForm(f=>({...f, address:e.target.value}))}/>
            <input className="input" placeholder="CEP"
                   value={fullForm.zipcode} onChange={e=>setFullForm(f=>({...f, zipcode:e.target.value}))}/>
            <textarea className="input md:col-span-2" rows={4} placeholder="Observações"
                      value={fullForm.notes} onChange={e=>setFullForm(f=>({...f, notes:e.target.value}))}/>
            {/* Tags no completo */}
            <div className="md:col-span-2 flex flex-wrap items-center gap-2">
              <select
                className="input"
                value=""
                onChange={e => {
                  const id = e.target.value
                  if (!id) return
                  if (!fullTags.includes(id)) setFullTags(t => [...t, id])
                }}
                disabled={tagsLoading || !tagsList.length}
              >
                <option value="">{tagsLoading ? 'Carregando tags…' : 'Adicionar tag…'}</option>
                {tagsList
                  .filter(t => !fullTags.includes(String(t.id)))
                  .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {fullTags.map(id => {
                const t = tagsList.find(x => String(x.id) === String(id))
                if (!t) return null
                return (
                  <span key={id} className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs border"
                        style={{ backgroundColor: '#fff', borderColor: '#e5e7eb' }}>
                    <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: t.color || '#64748b' }} />
                    {t.name}
                    <button className="text-slate-500 hover:text-red-600"
                            onClick={() => setFullTags(qq => qq.filter(x => x !== id))}>×</button>
                  </span>
                )
              })}
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button className="btn-primary" disabled={savingFull || !currentOrgId}>
                {savingFull ? 'Salvando…' : 'Criar cadastro'}
              </button>
              <button type="button" className="btn" onClick={() => { setFullOpen(false) }}>Cancelar</button>
            </div>
          </form>
        )}
      </div>

      {/* Barra de filtros / ações */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input w-full md:w-80"
          placeholder="Buscar por nome, telefone, e-mail ou cidade…"
          value={q}
          onChange={e=>setQ(e.target.value)}
        />
        <select
          className="input"
          value={tagFilter}
          onChange={e => setTagFilter(e.target.value)}
          title="Filtrar por tag"
        >
          <option value="">Todas as tags</option>
          {tagsList.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button className="btn" onClick={() => fetchList(1, limit, q)}>Buscar</button>
        <button className="btn" onClick={() => { setQ(''); setTagFilter(''); fetchList(1, limit, '') }}>Limpar</button>
        {currentOrg?.role === 'admin' && (
          <button
            className="btn"
            onClick={() => {
              const url = `/api/voters?action=export&org_id=${currentOrgId}${tagFilter ? `&tag_id=${tagFilter}` : ''}`
              window.open(url, '_blank')
            }}
            title="Exportar CSV (somente admin)"
          >
            Exportar CSV
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <h2 className="font-semibold mb-3">Cadastros</h2>
        {loading ? (
          'Carregando…'
        ) : (
          <>
            <div className="table-responsive">
              <table className="table w-full">
                <thead>
                  <tr className="text-left">
                    <th>Nome</th>
                    <th>Telefone</th>
                    <th>Cidade</th>
                    <th className="hidden md:table-cell">E-mail</th>
                    <th style={{width:260}}></th>
                  </tr>
                </thead>
                <tbody>
                    {items.map((v) => (
                      <tr
                        key={v.id}
                        className="border-b last:border-0 even:bg-slate-50"
                      >
                        <td>{v.name}</td>
                        <td>{v.phone}</td>
                        <td>{v.city}</td>
                        <td className="hidden md:table-cell">{v.email || '—'}</td>
                        <td>
                          <div className="flex flex-col gap-2">
                            <VoterTagsRow
                              voter={v}
                              allTags={tagsList}
                              onAdd={addTagToVoter}
                              onRemove={removeTagFromVoter}
                              loadTags={fetchVoterTags}
                            />

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openEditor(v.id)}
                                title="Editar cadastro"
                                aria-label="Editar cadastro"
                                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-200 hover:bg-slate-50 transition"
                              >
                                <Pencil size={18} className="text-slate-700" />
                              </button>

                              <button
                                type="button"
                                onClick={() => remove(v.id)}
                                title="Excluir cadastro"
                                aria-label="Excluir cadastro"
                                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!items.length && (
                      <tr>
                        <td colSpan="5" className="text-slate-500">
                          Nenhum cadastro.
                        </td>
                      </tr>
                    )}
                  </tbody>

              </table>
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="text-sm text-slate-600">
                Total: <strong>{total}</strong> • Página {page} de {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button className="btn" disabled={page<=1} onClick={() => fetchList(page-1, limit, q)}>← Anterior</button>
                <select
                  className="input"
                  value={limit}
                  onChange={e => { const l = parseInt(e.target.value, 10) || 20; setLimit(l); fetchList(1, l, q) }}
                  title="Itens por página"
                >
                  {[10,20,50,100].map(n => <option key={n} value={n}>{n}/pág</option>)}
                </select>
                <button className="btn" disabled={page>=totalPages} onClick={() => fetchList(page+1, limit, q)}>Próxima →</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ===== Modal Editor ===== */}
      {editorOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={closeEditor} />
          <div className="absolute right-0 top-0 h-full w-full sm:w-[600px] bg-white shadow-xl overflow-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="text-xl font-semibold">Cadastro completo</h3>
              <button className="btn" onClick={closeEditor}>Fechar</button>
            </div>

            {editorError && (
              <div className="m-5 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
                {editorError}
              </div>
            )}

            <form onSubmit={saveEditor} className="p-5 grid gap-3 md:grid-cols-2">
              <input className="input md:col-span-2" placeholder="Nome *"
                     value={editorForm.name} onChange={e=>setEditorForm(f=>({...f, name:e.target.value}))}/>
              <input className="input" placeholder="Telefone *"
                     value={editorForm.phone} onChange={e=>setEditorForm(f=>({...f, phone:e.target.value}))}/>
              <input className="input" type="email" placeholder="E-mail"
                     value={editorForm.email} onChange={e=>setEditorForm(f=>({...f, email:e.target.value}))}/>
              <input className="input" type="date" title="Data de nascimento"
                     value={editorForm.birthdate || ''} onChange={e=>setEditorForm(f=>({...f, birthdate:e.target.value}))}/>
              <input className="input" placeholder="Cidade"
                     value={editorForm.city} onChange={e=>setEditorForm(f=>({...f, city:e.target.value}))}/>
              <input className="input" placeholder="Estado (UF)"
                     value={editorForm.state} onChange={e=>setEditorForm(f=>({...f, state:e.target.value}))}/>
              <input className="input md:col-span-2" placeholder="Endereço"
                     value={editorForm.address} onChange={e=>setEditorForm(f=>({...f, address:e.target.value}))}/>
              <input className="input" placeholder="CEP"
                     value={editorForm.zipcode} onChange={e=>setEditorForm(f=>({...f, zipcode:e.target.value}))}/>
              <textarea className="input md:col-span-2" rows={4} placeholder="Observações"
                        value={editorForm.notes} onChange={e=>setEditorForm(f=>({...f, notes:e.target.value}))}/>
              <div className="md:col-span-2 flex gap-2">
                <button className="btn-primary" disabled={editorSaving}>
                  {editorSaving ? 'Salvando…' : 'Salvar'}
                </button>
                <button type="button" className="btn" onClick={closeEditor}>Cancelar</button>
              </div>
            </form>

            <div className="p-5">
              <h4 className="font-semibold mb-2">Tags</h4>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {editorVoterTags.map(t => (
                  <span key={t.id} className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs border"
                        style={{ backgroundColor: '#fff', borderColor: '#e5e7eb' }}>
                    <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: t.color || '#64748b' }} />
                    {t.name}
                    <button className="text-slate-500 hover:text-red-600" onClick={() => editorRemoveTag(t.id)} title="Remover">×</button>
                  </span>
                ))}
                {!editorVoterTags.length && <span className="text-slate-500 text-sm">Sem tags.</span>}
              </div>
              <div className="flex items-center gap-2">
                <select className="input" value={editorAddTagId} onChange={e=>setEditorAddTagId(e.target.value)}>
                  <option value="">Adicionar tag…</option>
                  {editorAvailableTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button className="btn" onClick={editorAddTag} disabled={!editorAddTagId}>Adicionar</button>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Precisa criar/editar cores de tags? Vá em <strong>Admin → Tags do gabinete</strong>.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente de Tags inline na linha da tabela
function VoterTagsRow({ voter, allTags, onAdd, onRemove, loadTags }) {
  const [tags, setTags] = React.useState([])
  const [open, setOpen] = React.useState(false)
  const [adding, setAdding] = React.useState(false)
  const [selected, setSelected] = React.useState('')

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const list = await loadTags(voter.id)
        if (alive) setTags(list)
      } catch {}
    })()
    return () => { alive = false }
  }, [voter.id, loadTags])

  const available = allTags.filter(t => !tags.some(x => x.id === t.id))

  async function add() {
    if (!selected) return
    setAdding(true)
    try {
      await onAdd(voter.id, selected)
      const list = await loadTags(voter.id)
      setTags(list)
      setSelected('')
      setOpen(false)
    } catch (e) { alert(e.message) } finally { setAdding(false) }
  }

  async function remove(tag_id) {
    if (!confirm('Remover esta tag?')) return
    try {
      await onRemove(voter.id, tag_id)
      const list = await loadTags(voter.id)
      setTags(list)
    } catch (e) { alert(e.message) }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map(t => (
        <span key={t.id} className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs border"
              style={{ backgroundColor: '#fff', borderColor: '#e5e7eb' }}>
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: t.color || '#64748b' }} />
          {t.name}
          <button className="text-slate-500 hover:text-red-600" onClick={() => remove(t.id)} title="Remover">×</button>
        </span>
      ))}
     {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!available.length}
          title={available.length ? 'Adicionar tag' : 'Sem tags disponíveis'}
          aria-label={available.length ? 'Adicionar tag' : 'Sem tags disponíveis'}
          className={[
            'inline-flex items-center justify-center w-9 h-9 rounded-full border transition',
            available.length
              ? 'border-slate-200 hover:bg-slate-50 text-slate-700'
              : 'opacity-50 cursor-not-allowed border-slate-200 text-slate-400'
          ].join(' ')}
        >
          <Tag size={18} />
          <Plus size={12} className="ml-[-10px] mt-[10px]" />
          {/* o Plus fica “sobreposto” na borda da Tag para sugerir “adicionar” */}
        </button>
      ) : (
  
  


          <div className="flex items-center gap-2">
            <select className="input" value={selected} onChange={e=>setSelected(e.target.value)}>
              <option value="">Selecione…</option>
              {available.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button className="btn-primary" onClick={add} disabled={!selected || adding}>
              {adding ? 'Adicionando…' : 'Adicionar'}
            </button>
            <button className="btn" onClick={() => { setOpen(false); setSelected('') }}>Cancelar</button>
          </div>
        )}
      
    </div>
  )
}
