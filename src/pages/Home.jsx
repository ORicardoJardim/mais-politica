// src/pages/Home.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrg } from '../context/OrgContext'

// ---------- helpers ----------
const isoDate = (d = new Date()) => new Date(d).toISOString().slice(0, 10)
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function endOfDay(d)   { const x = new Date(d); x.setHours(23,59,59,999); return x }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x }
function monthKey(d)   { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
function ageFromBirthdate(b) {
  if (!b) return null
  const d = new Date(b)
  if (isNaN(d)) return null
  const t = new Date()
  let a = t.getFullYear() - d.getFullYear()
  const m = t.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--
  return a
}

export default function Home() {
  const { currentOrgId, currentOrg } = useOrg()

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // cards
  const [votersTotal, setVotersTotal] = useState(0)
  const [birthdaysToday, setBirthdaysToday] = useState(0)
  const [demandsTotal, setDemandsTotal] = useState(0)
  const [demandsDueToday, setDemandsDueToday] = useState(0)
  const [demandsLateCount, setDemandsLateCount] = useState(0)

  // listas
  const [birthdaysList, setBirthdaysList] = useState([]) // aniversariantes de hoje
  const [dueTodayList, setDueTodayList] = useState([])    // demandas que vencem hoje
  const [lateList, setLateList] = useState([])            // demandas atrasadas
  const [nextDemands, setNextDemands] = useState([])      // próximos 7 dias
  const [rank, setRank] = useState([])                    // ranking (assessores por cadastros)

  // série simples para “últimos 6 meses”
  const [votersByMonth, setVotersByMonth] = useState({})

  // modais
  const [modal, setModal] = useState(null) // 'birthdays' | 'dueToday' | 'late' | null

  useEffect(() => {
    let alive = true
    async function load() {
      setErr('')
      setLoading(true)
      try {
        if (!currentOrgId) {
          setVotersTotal(0)
          setBirthdaysToday(0)
          setDemandsTotal(0)
          setDemandsDueToday(0)
          setDemandsLateCount(0)
          setBirthdaysList([])
          setDueTodayList([])
          setLateList([])
          setNextDemands([])
          setRank([])
          setVotersByMonth({})
          return
        }

        // ---------------- ELEITORES TOTAIS ----------------
        {
          const r = await supabase
            .from('voters')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', currentOrgId)
          if (r.error) throw new Error(r.error.message)
          if (alive) setVotersTotal(r.count ?? 0)
        }

        // ---------------- ANIVERSARIANTES HOJE ----------------
        {
          const r = await supabase
            .from('voters')
            .select('id, name, birthdate, city, phone, email')
            .eq('org_id', currentOrgId)
          if (r.error) throw new Error(r.error.message)

          const today = new Date()
          const MM = String(today.getMonth()+1).padStart(2,'0')
          const DD = String(today.getDate()).padStart(2,'0')

          const list = (r.data || []).filter(row => {
            const v = row.birthdate
            if (!v) return false
            const s = typeof v === 'string' ? v : String(v)
            if (s.length >= 10 && s[4] === '-' && s[7] === '-') {
              return s.slice(5,7) === MM && s.slice(8,10) === DD
            }
            const d = new Date(s)
            return !isNaN(d) &&
              (d.getMonth()+1 === Number(MM)) &&
              (d.getDate() === Number(DD))
          }).map(v => ({
            id: v.id,
            name: v.name || '—',
            age: ageFromBirthdate(v.birthdate),
            city: v.city || '—',
            contact: v.phone || v.email || '—'
          })).sort((a,b) => a.name.localeCompare(b.name))

          if (alive) {
            setBirthdaysToday(list.length)
            setBirthdaysList(list)
          }
        }

        // ------------- CADASTROS (últimos 6 meses) -------------
        {
          const since = addDays(new Date(), -180)
          const r = await supabase
            .from('voters')
            .select('id, created_at')
            .eq('org_id', currentOrgId)
            .gte('created_at', since.toISOString())
          if (r.error) throw new Error(r.error.message)
          const buckets = {}
          ;(r.data || []).forEach(row => {
            const d = new Date(row.created_at)
            const k = monthKey(d)
            buckets[k] = (buckets[k] || 0) + 1
          })
          if (alive) setVotersByMonth(buckets)
        }

        // ---------------- DEMANDAS (tabela: demandas) ----------------
        {
          const r = await supabase
            .from('demandas')
            .select('id, protocolo, tema, cidadao, responsavel, status, prazo, data_abertura')
            .eq('org_id', currentOrgId)
          if (r.error) throw new Error(r.error.message)

          const rows = r.data || []
          if (alive) setDemandsTotal(rows.length)

          const todayStr = isoDate()
          const todayStartStr = isoDate(startOfDay(new Date()))
          const todayEndStr = isoDate(endOfDay(new Date()))
          const endIn7 = endOfDay(addDays(new Date(), 7))
          const endIn7Str = isoDate(endIn7)

          const isOpen = (st) => {
            const s = String(st || '').toLowerCase()
            return !(s.startsWith('resolvid') || s.includes('fech') || s.includes('cancel'))
          }

          // vence hoje
          const dueToday = rows
            .filter(d => {
              const p = (d.prazo || '').slice(0,10)
              return p && isOpen(d.status) && p >= todayStartStr && p <= todayEndStr
            })
            .sort((a,b) => (a.prazo || '').localeCompare(b.prazo || ''))

          // atrasadas
          const late = rows
            .filter(d => {
              const p = (d.prazo || '').slice(0,10)
              return p && isOpen(d.status) && p < todayStr
            })
            .sort((a,b) => (a.prazo || '').localeCompare(b.prazo || ''))

          // próximas 7 dias (comparação por string YYYY-MM-DD)
          const upcoming = rows
            .filter(d => {
              const p = (d.prazo || '').slice(0,10)
              return p && isOpen(d.status) && p > todayStr && p <= endIn7Str
            })
            .sort((a,b) => (a.prazo || '').localeCompare(b.prazo || ''))
            .slice(0, 10)

          if (alive) {
            setDemandsDueToday(dueToday.length)
            setDueTodayList(dueToday)
            setDemandsLateCount(late.length)
            setLateList(late)
            setNextDemands(upcoming)
          }
        }

        // ---------------- RANKING (voters.created_by) ----------------
        {
          const r = await supabase
            .from('voters')
            .select('id, created_by')
            .eq('org_id', currentOrgId)
          if (r.error) throw new Error(r.error.message)

          const counts = new Map()
          ;(r.data || []).forEach(row => {
            const u = row.created_by || null
            if (!u) return
            counts.set(u, (counts.get(u) || 0) + 1)
          })

          const ids = Array.from(counts.keys())
          let profiles = []
          if (ids.length) {
            const p = await supabase
              .from('profiles')
              .select('id,name,email')
              .in('id', ids)
            if (p.error) throw new Error(p.error.message)
            profiles = p.data || []
          }

          const byId = new Map(profiles.map(pr => [pr.id, pr]))
          const list = ids.map(id => ({
            id,
            name: byId.get(id)?.name || '(sem nome)',
            email: byId.get(id)?.email || '',
            total: counts.get(id) || 0,
          })).sort((a,b) => b.total - a.total)

          if (alive) setRank(list)
        }

      } catch (e) {
        console.error('[Home] erro:', e)
        if (alive) setErr(e.message || 'Erro ao carregar painel')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [currentOrgId])

  // série em ordem p/ 6 meses
  const monthSeries = useMemo(() => {
    const arr = []
    const base = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
      const k = monthKey(d)
      arr.push({ key: k, label: k, value: votersByMonth[k] || 0 })
    }
    return arr
  }, [votersByMonth])

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span role="img" aria-label="dashboard">📊</span> Painel do Gabinete
        </h1>
        {currentOrg?.role === 'admin' && (
          <span className="px-3 py-1 rounded-full text-xs bg-slate-100 border text-slate-700">ADMIN</span>
        )}
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {err}
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {/* não clicáveis */}
        <Card title="Eleitores" value={votersTotal} icon="👥" clickable={false} />
        <Card
          title="Aniversariantes hoje"
          value={birthdaysToday}
          icon="🎂"
          onClick={() => birthdaysToday ? setModal('birthdays') : null}
          clickable
        />
        {/* não clicável */}
        <Card title="Demandas" value={demandsTotal} icon="🗂️" clickable={false} />
        <Card
          title="Demandas vencem hoje"
          value={demandsDueToday}
          icon="⚠️"
          onClick={() => demandsDueToday ? setModal('dueToday') : null}
          clickable
        />
        <Card
          title="Demandas atrasadas"
          value={demandsLateCount}
          icon="⏳"
          onClick={() => demandsLateCount ? setModal('late') : null}
          clickable
          valueClass={demandsLateCount > 0 ? 'text-red-600' : undefined}
        />
      </div>

      {/* Demandas próximas */}
      <section className="bg-white border rounded-2xl shadow-sm">
        <div className="p-4 font-semibold flex items-center gap-2">
          <span>📌</span> Demandas próximas (7 dias)
        </div>
        <div className="p-4 border-t">
          {loading ? 'Carregando…' : (
            nextDemands.length ? (
              <div className="table-responsive">
                <table className="table w-full">
                  <thead>
                    <tr className="text-left">
                      <th style={{width:140}}>Protocolo</th>
                      <th>Tema</th>
                      <th>Cidadão</th>
                      <th>Responsável</th>
                      <th style={{width:120}}>Prazo</th>
                      <th style={{width:140}}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nextDemands.map(d => (
                      <tr key={d.id}>
                        <td className="font-mono text-xs">{d.protocolo || '—'}</td>
                        <td className="font-medium">{d.tema || d.title || '(sem título)'}</td>
                        <td>{d.cidadao || '—'}</td>
                        <td>{d.responsavel || d.assignee_name || '—'}</td>
                        <td>{d.prazo ? new Date(d.prazo).toLocaleDateString() : (d.due ? d.due.toLocaleDateString() : '—')}</td>
                        <td>{d.status || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="text-slate-600">Nada para os próximos dias.</div>
          )}
        </div>
      </section>

      {/* Ranking */}
      <section className="bg-white border rounded-2xl shadow-sm">
        <div className="p-4 font-semibold flex items-center gap-2">
          <span>🏆</span> Ranking de cadastros
        </div>
        <div className="p-4 border-t">
          {loading ? 'Carregando…' : (
            rank.length ? (
              <div className="table-responsive">
                <table className="table w-full">
                  <thead>
                    <tr className="text-left">
                      <th>#</th>
                      <th>Usuário</th>
                      <th>E-mail</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rank.map((r, idx) => (
                      <tr key={r.id}>
                        <td>{idx + 1}</td>
                        <td>{r.name}</td>
                        <td className="text-slate-600">{r.email}</td>
                        <td><strong>{r.total}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="text-slate-600">Sem dados.</div>
          )}
        </div>
      </section>

      {/* Cadastros (últimos 6 meses) — com mini gráfico de barras */}
      <section className="bg-white border rounded-2xl shadow-sm">
        <div className="p-4 font-semibold flex items-center gap-2">
          <span>📈</span> Cadastros de eleitores (últimos 6 meses)
        </div>
        <div className="p-4 border-t">
          {loading ? 'Carregando…' : (
            monthSeries.length ? (
              <BarMini data={monthSeries} />
            ) : <div className="text-slate-600">Sem dados.</div>
          )}
        </div>
      </section>

      {/* Modais */}
      {modal === 'birthdays' && (
        <Modal title="🎂 Aniversariantes de hoje" onClose={() => setModal(null)}>
          {birthdaysList.length ? (
            <div className="table-responsive">
              <table className="table w-full">
                <thead>
                  <tr className="text-left">
                    <th>Nome</th>
                    <th style={{width:100}}>Idade</th>
                    <th style={{width:180}}>Cidade</th>
                    <th style={{width:220}}>Contato</th>
                  </tr>
                </thead>
                <tbody>
                  {birthdaysList.map(v => (
                    <tr key={v.id}>
                      <td className="font-medium">{v.name}</td>
                      <td>{v.age ?? '—'}</td>
                      <td>{v.city}</td>
                      <td>{v.contact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="text-slate-600">Sem aniversariantes hoje.</div>}
        </Modal>
      )}

      {modal === 'dueToday' && (
        <Modal title="⚠️ Demandas que vencem hoje" onClose={() => setModal(null)}>
          <DemandasTable items={dueTodayList} emptyMsg="Nenhuma demanda vence hoje." />
        </Modal>
      )}

      {modal === 'late' && (
        <Modal title="⏳ Demandas atrasadas" onClose={() => setModal(null)}>
          <DemandasTable items={lateList} emptyMsg="Nenhuma demanda atrasada." />
        </Modal>
      )}
    </div>
  )
}

function Card({ title, value, icon, muted = false, onClick, clickable = false, valueClass }) {
  const Wrapper = clickable ? 'button' : 'div'
  const baseClass = [
    'text-left bg-white border rounded-2xl shadow-sm p-4 w-full',
    muted ? 'opacity-70' : '',
    clickable ? 'hover:bg-slate-50 transition cursor-pointer' : ''
  ].join(' ')
  const extraProps = clickable ? { type:'button', onClick } : {}
  return (
    <Wrapper className={baseClass} {...extraProps}>
      <div className="text-sm text-slate-600 flex items-center gap-2">
        <span>{icon}</span> {title}
      </div>
      <div className={['text-3xl font-bold mt-1', valueClass || ''].join(' ')}>{value}</div>
    </Wrapper>
  )
}

function Placeholder({ title, subtitle }) {
  return (
    <section className="bg-white border rounded-2xl shadow-sm">
      <div className="p-4 font-semibold">{title}</div>
      <div className="p-4 border-t text-slate-500 italic">{subtitle}</div>
    </section>
  )
}

/** Mini gráfico de barras, sem libs externas */
function BarMini({ data }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div className="w-full">
      <div className="h-44 md:h-48 w-full flex items-end gap-4">
        {data.map(d => {
          const pct = Math.round((d.value / max) * 100)
          return (
            <div key={d.key} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-slate-100 rounded-xl relative h-36 md:h-40 overflow-hidden border">
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t-xl"
                  style={{
                    height: `${pct}%`,
                    background:
                      'linear-gradient(180deg, rgba(59,130,246,0.95) 0%, rgba(59,130,246,0.75) 100%)'
                  }}
                />
              </div>
              <div className="text-sm font-semibold">{d.value}</div>
              <div className="text-[11px] text-slate-600">{d.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Tabela reusável de demandas */
function DemandasTable({ items, emptyMsg }) {
  if (!items?.length) return <div className="text-slate-600">{emptyMsg}</div>
  return (
    <div className="table-responsive">
      <table className="table w-full">
        <thead>
          <tr className="text-left">
            <th style={{width:140}}>Protocolo</th>
            <th>Tema</th>
            <th>Cidadão</th>
            <th>Responsável</th>
            <th style={{width:120}}>Prazo</th>
            <th style={{width:140}}>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map(d => (
            <tr key={d.id}>
              <td className="font-mono text-xs">{d.protocolo || '—'}</td>
              <td className="font-medium">{d.tema || '—'}</td>
              <td>{d.cidadao || '—'}</td>
              <td>{d.responsavel || '—'}</td>
              <td>{d.prazo ? new Date(d.prazo).toLocaleDateString() : '—'}</td>
              <td>{d.status || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Modal simples */
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(900px,95vw)] bg-white border rounded-2xl shadow-xl">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button className="btn" onClick={onClose}>Fechar</button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  )
}
