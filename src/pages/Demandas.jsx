// src/pages/Demandas.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import { supabase } from '../lib/supabaseClient'

/** -------- helpers -------- */
const isoDate = (d = new Date()) => new Date(d).toISOString().slice(0,10)
function calcPrazo(dataAbertura, slaDias) {
  if (!dataAbertura || !slaDias) return null
  const d = new Date(dataAbertura)
  d.setDate(d.getDate() + Number(slaDias))
  return d.toISOString().slice(0, 10)
}
function genProtocolo() {
  const ymd = isoDate().replaceAll('-', '')
  const rnd = Math.random().toString(16).slice(2, 6).toUpperCase()
  return `MP-${ymd}-${rnd}`
}
function firstTruthy(obj, keys = []) {
  for (const k of keys) if (obj?.[k]) return obj[k]
  return ''
}

export default function Demandas() {
  const { user } = useAuth()
  const { currentOrgId, currentOrg } = useOrg()

  /** ----- estado da tela ----- */
  const [q, setQ] = useState('')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [activeTab, setActiveTab] = useState('ativas') // ativas | atrasadas | resolvidas

  // membros (responsável)
  const [assessores, setAssessores] = useState([])
  const [loadingAssessores, setLoadingAssessores] = useState(false)

  // busca de eleitores
  const [citSearch, setCitSearch] = useState('')
  const [citResults, setCitResults] = useState([])
  const [citOpen, setCitOpen] = useState(false)

  // formulário
  const [form, setForm] = useState({
    protocolo: genProtocolo(),
    data_abertura: isoDate(),
    cidadao: '',     // nome do eleitor
    contato: '',
    cidade: '',
    tema: '',
    orgao: '',
    sla_dias: '7',
    status: 'Aberta',
    solucao: '',
    responsavel: '', // nome do responsável (membro)
    obs: ''
  })

  /** ----- carregar demandas + membros ----- */
  useEffect(() => {
    let alive = true
    async function run() {
      setErr('')
      setLoading(true)
      try {
        if (!user || !currentOrgId) {
          if (alive) { setList([]); setAssessores([]); setLoading(false) }
          return
        }

        // demandas
        {
          const r = await supabase
            .from('demandas')
            .select('id, protocolo, data_abertura, cidadao, contato, cidade, tema, orgao, sla_dias, status, solucao, responsavel, obs, prazo, user_id, org_id, created_at')
            .eq('org_id', currentOrgId)
            .order('created_at', { ascending: false })

          if (r.error) throw new Error(r.error.message)
          if (alive) setList(r.data || [])
        }

        // membros do gabinete (qualquer role) → nomes via profiles
        setLoadingAssessores(true)
        try {
          const mem = await supabase
            .from('memberships')
            .select('user_id, role')
            .eq('org_id', currentOrgId)

          if (mem.error) throw mem.error

          const ids = (mem.data || []).map(m => m.user_id)
          let profiles = []
          if (ids.length) {
            const p = await supabase
              .from('profiles')
              .select('id, name, email')
              .in('id', ids)
            if (p.error) throw p.error
            profiles = p.data || []
          }

          const options = profiles
            .map(p => ({ id: p.id, name: p.name || p.email || p.id }))
            .sort((a,b) => a.name.localeCompare(b.name))

          if (alive) setAssessores(options)
        } catch (e) {
          if (alive) setAssessores([])
        } finally {
          if (alive) setLoadingAssessores(false)
        }
      } catch (e) {
        if (alive) setErr(e.message || 'Erro ao carregar demandas')
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => { alive = false }
  }, [user, currentOrgId])

  /** ----- filtro global de texto ----- */
  const filteredText = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return list
    return list.filter(d =>
      [
        d.protocolo, d.cidadao, d.cidade, d.tema, d.status, d.responsavel
      ].filter(Boolean).join(' ').toLowerCase().includes(s)
    )
  }, [list, q])

  /** ----- listas por aba ----- */
  const hoje = isoDate()
  const splitLists = useMemo(() => {
    const ativas = []
    const atrasadas = []
    const resolvidas = []
    for (const d of filteredText) {
      const st = String(d.status || '').toLowerCase()
      const isResolved = st === 'resolvida' || st === 'resolvido' || st.includes('conclu')
      const isLate = !isResolved && d.prazo && d.prazo < hoje
      if (isResolved) resolvidas.push(d)
      else if (isLate) atrasadas.push(d)
      else ativas.push(d)
    }
    return { ativas, atrasadas, resolvidas }
  }, [filteredText, hoje])

  const visible = activeTab === 'atrasadas'
    ? splitLists.atrasadas
    : activeTab === 'resolvidas'
      ? splitLists.resolvidas
      : splitLists.ativas

  /** ----- buscar eleitores (modal) ----- */
  useEffect(() => {
    let alive = true
    const t = setTimeout(async () => {
      if (!citOpen || !currentOrgId) return
      try {
        const s = (citSearch || '').trim()
        if (!s) { setCitResults([]); return }
        // apenas colunas existentes no seu schema
        const r = await supabase
          .from('voters')
          .select('id, name, city, phone, email')
          .eq('org_id', currentOrgId)
          .or(`name.ilike.%${s}%,city.ilike.%${s}%`)
          .order('created_at', { ascending: false })
          .limit(20)
        if (!alive) return
        if (r.error) throw r.error
        setCitResults(r.data || [])
      } catch {
        if (alive) setCitResults([])
      }
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [citSearch, citOpen, currentOrgId])

  const pickCidadao = (v) => {
    const nome = firstTruthy(v, ['name'])
    const cidade = firstTruthy(v, ['city'])
    const contato = firstTruthy(v, ['phone','email'])
    setForm(f => ({
      ...f,
      cidadao: nome || '(sem nome)',
      cidade: cidade || f.cidade,
      contato: contato || f.contato,
    }))
    setCitOpen(false)
    setCitSearch('')
    setCitResults([])
  }

  /** ----- ações CRUD ----- */
  const add = async () => {
    if (!currentOrgId) return alert('Selecione um gabinete no topo.')
    if (!form.data_abertura || !form.cidadao || !form.tema) {
      alert('Data, Cidadão e Tema são obrigatórios'); return
    }
    const payload = { ...form }
    if (!payload.protocolo) payload.protocolo = genProtocolo()
    payload.prazo = calcPrazo(payload.data_abertura, payload.sla_dias)

    setSaving(true)
    const { error } = await supabase
      .from('demandas')
      .insert([{ ...payload, user_id: user.id, org_id: currentOrgId }])
    setSaving(false)

    if (error) return alert(error.message)

    setForm({
      protocolo: genProtocolo(),
      data_abertura: isoDate(),
      cidadao: '', contato: '',
      cidade: '', tema: '', orgao: '',
      sla_dias: '7', status: 'Aberta',
      solucao: '', responsavel: '', obs: ''
    })
    // refetch rápido
    const r = await supabase
      .from('demandas')
      .select('id, protocolo, data_abertura, cidadao, contato, cidade, tema, orgao, sla_dias, status, solucao, responsavel, obs, prazo, user_id, org_id, created_at')
      .eq('org_id', currentOrgId)
      .order('created_at', { ascending: false })
    if (!r.error) setList(r.data || [])
  }

  const removeItem = async (id) => {
    if (!confirm('Remover esta demanda?')) return
    const { error } = await supabase
      .from('demandas')
      .delete()
      .eq('id', id)
      .eq('org_id', currentOrgId)
    if (error) return alert(error.message)
    setList(l => l.filter(x => x.id !== id))
  }

  const concluir = async (item) => {
    const sol = prompt('Descreva a solução/resultado (opcional):', item.solucao || '')
    const { data, error } = await supabase
      .from('demandas')
      .update({ status: 'Resolvida', solucao: sol ?? item.solucao })
      .eq('id', item.id)
      .select()
      .maybeSingle()
    if (error) return alert(error.message)
    setList(l => l.map(d => d.id === item.id ? (data || d) : d))
  }

  /** ----- UI ----- */
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Demandas</h1>
        <span className="px-3 py-1 rounded-full text-xs bg-slate-100 border text-slate-700">
          {currentOrg ? currentOrg.name : 'Selecione um gabinete'}
        </span>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {err}
        </div>
      )}

      {/* ---------- Formulário ---------- */}
      <div className="bg-white border rounded-2xl shadow-sm">
        <div className="p-5 grid gap-3 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">Data de abertura</label>
            <input className="input w-full" type="date"
              value={form.data_abertura}
              onChange={e=>setForm({...form, data_abertura:e.target.value})}/>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Cidadão</label>
            <div className="flex gap-2">
              <input className="input flex-1" readOnly placeholder="Selecione um eleitor…"
                value={form.cidadao}
              />
              <button className="btn" onClick={() => setCitOpen(true)}>Selecionar</button>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Ao escolher, cidade e contato são preenchidos automaticamente.
            </div>
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">Protocolo</label>
            <input className="input w-full" value={form.protocolo} readOnly title="Gerado automaticamente" />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Tema</label>
            <input className="input w-full" value={form.tema} onChange={e=>setForm({...form, tema:e.target.value})}/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Órgão</label>
            <input className="input w-full" value={form.orgao} onChange={e=>setForm({...form, orgao:e.target.value})}/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cidade</label>
            <input className="input w-full" value={form.cidade} onChange={e=>setForm({...form, cidade:e.target.value})}/>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">SLA (dias)</label>
            <input className="input w-full" type="number" min={1}
              value={form.sla_dias} onChange={e=>setForm({...form, sla_dias:e.target.value})}/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Responsável</label>
            <select
              className="input w-full"
              value={form.responsavel}
              onChange={e=>setForm({...form, responsavel:e.target.value})}
              disabled={loadingAssessores}
            >
              <option value="">{loadingAssessores ? 'Carregando…' : (assessores.length ? 'Selecione' : 'Sem membros')}</option>
              {assessores.map(a => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Contato (tel/email)</label>
            <input className="input w-full" value={form.contato} onChange={e=>setForm({...form, contato:e.target.value})}/>
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-1">Observações</label>
            <input className="input w-full" value={form.obs} onChange={e=>setForm({...form, obs:e.target.value})}/>
          </div>
          <div className="md:col-span-1 flex items-end">
            <button className="btn-primary w-full" onClick={add} disabled={!currentOrgId || saving}>
              {saving ? 'Salvando…' : 'Adicionar'}
            </button>
          </div>
        </div>
      </div>

      {/* ---------- Busca + Abas + Lista ---------- */}
      <div className="bg-white border rounded-2xl shadow-sm">
        <div className="p-5 border-b">
          <input
            className="input w-full"
            placeholder="Buscar por protocolo, cidadão, cidade, tema, status ou responsável…"
            value={q}
            onChange={e=>setQ(e.target.value)}
          />
          <div className="mt-3 flex gap-2">
            {[
              {key:'ativas', label:`Ativas (${splitLists.ativas.length})`},
              {key:'atrasadas', label:`Atrasadas (${splitLists.atrasadas.length})`},
              {key:'resolvidas', label:`Resolvidas (${splitLists.resolvidas.length})`},
            ].map(tab => (
              <button
                key={tab.key}
                onClick={()=>setActiveTab(tab.key)}
                className={[
                  'px-3 py-1.5 rounded-full text-sm border',
                  activeTab===tab.key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-5">Carregando…</div>
        ) : (
          <div className="p-5 table-responsive">
            <table className="table w-full">
              <thead>
                <tr className="text-left">
                  <th style={{width:140}}>Protocolo</th>
                  <th>Cidadão</th>
                  <th>Tema</th>
                  <th className="hidden md:table-cell">Responsável</th>
                  <th className="hidden md:table-cell" style={{width:120}}>Abertura</th>
                  <th style={{width:100}}>Prazo</th>
                  <th style={{width:160}}>Status</th>
                  <th style={{width:230}}></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(d => {
                  const atrasada = String(d.status || '').toLowerCase() !== 'resolvida' && d.prazo && d.prazo < hoje
                  const statusPill =
                    String(d.status || '').toLowerCase().startsWith('resolvid')
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : atrasada
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  return (
                    <tr key={d.id} className="border-b border-slate-200/70">
                      <td className="font-mono text-xs">{d.protocolo}</td>
                      <td>{d.cidadao || '—'}</td>
                      <td className="font-medium">{d.tema || '—'}</td>
                      <td className="hidden md:table-cell">{d.responsavel || '—'}</td>
                      <td className="hidden md:table-cell">{d.data_abertura || '—'}</td>
                      <td className="text-sm">{d.prazo || '—'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${statusPill}`}>
                            {d.status || '—'}
                          </span>
                          {atrasada && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] border bg-amber-50 border-amber-200 text-amber-700">
                              Atrasada
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="flex gap-2">
                        {String(d.status || '').toLowerCase() !== 'resolvida' && (
                          <button
                            className="btn border-green-200 bg-green-50 hover:bg-green-100 text-green-700"
                            onClick={() => concluir(d)}
                          >
                            Concluir
                          </button>
                        )}
                        <button
                          className="btn border-red-200 bg-red-50 hover:bg-red-100 text-red-700"
                          onClick={() => removeItem(d.id)}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {!visible.length && (
                  <tr><td colSpan="8" className="text-slate-500">Nada por aqui.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------- Modal: selecionar cidadão ---------- */}
      {citOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCitOpen(false)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(680px,94vw)] bg-white border rounded-2xl shadow-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Selecionar cidadão (Eleitores)</h3>
              <button className="btn" onClick={() => setCitOpen(false)}>Fechar</button>
            </div>
            <div className="p-4 space-y-3">
              <input
                className="input w-full"
                placeholder="Digite nome ou cidade…"
                value={citSearch}
                onChange={e=>setCitSearch(e.target.value)}
                autoFocus
              />
              <div className="max-h-80 overflow-auto border rounded-xl">
                <table className="table w-full">
                  <thead>
                    <tr className="text-left">
                      <th>Nome</th>
                      <th style={{width:180}}>Cidade</th>
                      <th style={{width:130}}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {citResults.map(v => (
                      <tr key={v.id} className="border-b border-slate-100">
                        <td className="font-medium">{firstTruthy(v, ['name']) || '—'}</td>
                        <td>{firstTruthy(v, ['city']) || '—'}</td>
                        <td>
                          <button className="btn" onClick={() => pickCidadao(v)}>Escolher</button>
                        </td>
                      </tr>
                    ))}
                    {!citResults.length && (
                      <tr><td colSpan="3" className="text-slate-500">Digite para buscar.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-slate-500">
                Não achou? Cadastre o cidadão na página <strong>Eleitores</strong>.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
