import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import { supabase } from '../lib/supabaseClient'

function calcPrazo(dataAbertura, slaDias) {
  if (!dataAbertura || !slaDias) return null
  const d = new Date(dataAbertura)
  d.setDate(d.getDate() + Number(slaDias))
  return d.toISOString().slice(0, 10)
}

export default function Demandas() {
  const { user } = useAuth()
  const { currentOrgId, currentOrg } = useOrg()

  const [q, setQ] = useState('')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    protocolo: '', data_abertura: '', cidadao: '',
    contato: '', cidade: '', tema: '', orgao: '',
    sla_dias: '7', status: 'Aberta', solucao: '',
    responsavel: '', obs: ''
  })

  async function fetchData() {
    if (!user || !currentOrgId) {
      setList([]); setLoading(false); return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('demandas')
      .select('id, protocolo, data_abertura, cidadao, contato, cidade, tema, orgao, sla_dias, status, solucao, responsavel, obs, prazo, user_id, org_id, created_at')
      .eq('org_id', currentOrgId)
      .order('created_at', { ascending: false })
    if (!error) setList(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [user, currentOrgId])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return list
    return list.filter(d =>
      (d.protocolo + ' ' + d.cidadao + ' ' + d.cidade + ' ' + d.tema + ' ' + d.status)
        .toLowerCase().includes(s)
    )
  }, [list, q])

  const add = async () => {
    if (!currentOrgId) return alert('Selecione um gabinete no topo.')
    if (!form.data_abertura || !form.cidadao || !form.tema) {
      alert('Data, Cidadão e Tema são obrigatórios'); return
    }
    const prazo = calcPrazo(form.data_abertura, form.sla_dias)
    setSaving(true)
    const { error } = await supabase
      .from('demandas')
      .insert([{ ...form, prazo, user_id: user.id, org_id: currentOrgId }])
    setSaving(false)
    if (error) return alert(error.message)
    setForm({
      protocolo:'', data_abertura:'', cidadao:'', contato:'',
      cidade:'', tema:'', orgao:'', sla_dias:'7', status:'Aberta',
      solucao:'', responsavel:'', obs:''
    })
    fetchData()
  }

  const removeItem = async (id) => {
    if (!confirm('Remover esta demanda?')) return
    const { error } = await supabase
      .from('demandas')
      .delete()
      .eq('id', id)
      .eq('org_id', currentOrgId) // garante segurança por org
    if (error) return alert(error.message)
    fetchData()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="bg-white border rounded-2xl shadow-sm">
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Demandas</h1>
            <span className="px-3 py-1 rounded-full text-xs bg-slate-100 border text-slate-700">
              {currentOrg ? currentOrg.name : 'Selecione um gabinete'}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <input className="input" placeholder="Protocolo" value={form.protocolo} onChange={e=>setForm({...form, protocolo:e.target.value})}/>
            <input className="input" type="date" value={form.data_abertura} onChange={e=>setForm({...form, data_abertura:e.target.value})}/>
            <input className="input" placeholder="Cidadão" value={form.cidadao} onChange={e=>setForm({...form, cidadao:e.target.value})}/>
            <input className="input" placeholder="Contato" value={form.contato} onChange={e=>setForm({...form, contato:e.target.value})}/>
            <input className="input" placeholder="Cidade" value={form.cidade} onChange={e=>setForm({...form, cidade:e.target.value})}/>
            <input className="input" placeholder="Tema" value={form.tema} onChange={e=>setForm({...form, tema:e.target.value})}/>
            <input className="input" placeholder="Órgão" value={form.orgao} onChange={e=>setForm({...form, orgao:e.target.value})}/>
            <input className="input" type="number" min={1} placeholder="SLA (dias)" value={form.sla_dias} onChange={e=>setForm({...form, sla_dias:e.target.value})}/>
            <select className="input" value={form.status} onChange={e=>setForm({...form, status:e.target.value})}>
              <option>Aberta</option><option>Em andamento</option><option>Resolvida</option><option>Arquivada</option>
            </select>
            <input className="input" placeholder="Responsável" value={form.responsavel} onChange={e=>setForm({...form, responsavel:e.target.value})}/>
            <input className="input md:col-span-2" placeholder="Solução / Observações" value={form.solucao} onChange={e=>setForm({...form, solucao:e.target.value})}/>
            <button className="btn-primary md:col-span-1" onClick={add} disabled={!currentOrgId || saving}>
              {saving ? 'Adicionando…' : 'Adicionar'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm">
        <div className="p-5">
          <input className="input" placeholder="Buscar por protocolo/cidadão/cidade/tema/status" value={q} onChange={e=>setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div>Carregando…</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(d => {
            const hoje = new Date().toISOString().slice(0,10)
            const atrasada = d.status !== 'Resolvida' && d.prazo && d.prazo < hoje
            return (
              <div key={d.id} className={`bg-white border rounded-2xl shadow-sm ${atrasada?'border-red-300': d.status==='Resolvida'?'border-green-300':''}`}>
                <div className="p-5 space-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{d.tema}</h2>
                      <div className="text-sm text-slate-600">{d.cidadao} — {d.cidade}</div>
                    </div>
                    <button className="btn" onClick={()=>removeItem(d.id)}>Excluir</button>
                  </div>
                  <div className="text-sm">Status: <span className="font-medium">{d.status}</span></div>
                  <div className="text-xs text-slate-500">
                    Abertura: {d.data_abertura} • SLA: {d.sla_dias}d • Prazo: {d.prazo || '—'}
                  </div>
                  {d.responsavel && <div className="text-xs text-slate-500">Resp.: {d.responsavel}</div>}
                  {d.solucao && <div className="text-xs">{d.solucao}</div>}
                </div>
              </div>
            )
          })}
          {!filtered.length && <div className="text-slate-500">Nenhuma demanda.</div>}
        </div>
      )}
    </div>
  )
}
