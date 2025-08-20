// src/pages/AdminTools.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { useOrg } from '../context/OrgContext'
import { supabase } from '../lib/supabaseClient'
import { secureAction } from '../lib/secureActions'

export default function AdminTools() {
  const { currentOrgId, currentOrg } = useOrg()
  const isAdminOwner = currentOrg?.role === 'admin' || currentOrg?.role === 'owner'

  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // ======= Dados carregados =======
  const [approvals, setApprovals] = useState([])   // solicitações pendentes
  const [assessors, setAssessors] = useState([])   // membros do gabinete (com nome/email)
  const [alerts, setAlerts] = useState([])         // alertas de segurança

  // ======= Carregamento inicial =======
  useEffect(() => {
    if (!currentOrgId || !isAdminOwner) return
    setErr('')
    Promise.all([loadApprovals(), loadAssessors(), loadAlerts()]).catch((e) => {
      console.error(e)
      setErr(e.message || 'Erro ao carregar dados')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId, isAdminOwner])

  // ========= LOADERS =========
  async function loadApprovals() {
    // lista approvals pendentes da org
    const r = await supabase
      .from('approvals')
      .select('id, requested_by, action, payload, status, created_at, decided_by, decided_at')
      .eq('org_id', currentOrgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100)
    if (r.error) throw new Error(r.error.message)

    // buscar nomes dos usuários envolvidos (requested_by/decided_by)
    const ids = Array.from(
      new Set(
        (r.data || []).flatMap(a => [a.requested_by, a.decided_by].filter(Boolean))
      )
    )
    let byId = new Map()
    if (ids.length) {
      const p = await supabase.from('profiles').select('id, name, email').in('id', ids)
      if (p.error) throw new Error(p.error.message)
      byId = new Map((p.data || []).map(x => [x.id, x]))
    }

    const list = (r.data || []).map(a => ({
      ...a,
      requested_by_name: byId.get(a.requested_by)?.name || '—',
      requested_by_email: byId.get(a.requested_by)?.email || '—',
      decided_by_name: a.decided_by ? (byId.get(a.decided_by)?.name || '—') : null
    }))

    setApprovals(list)
    return list
  }

  async function loadAssessors() {
    // pega todos os memberships da org e junta com profiles
    const m = await supabase
      .from('memberships')
      .select('user_id, role')
      .eq('org_id', currentOrgId)
    if (m.error) throw new Error(m.error.message)

    const ids = Array.from(new Set((m.data || []).map(x => x.user_id)))
    let byId = new Map()
    if (ids.length) {
      const p = await supabase.from('profiles').select('id, name, email').in('id', ids)
      if (p.error) throw new Error(p.error.message)
      byId = new Map((p.data || []).map(x => [x.id, x]))
    }

    // Se quiser mostrar só assessores, filtre por role; aqui mostramos todos, mas
    // destacamos admin/owner e permitimos desfazer para qualquer usuário da org.
    const list = (m.data || [])
      .map(row => ({
        user_id: row.user_id,
        role: row.role,
        name: byId.get(row.user_id)?.name || '(sem nome)',
        email: byId.get(row.user_id)?.email || ''
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    setAssessors(list)
    return list
  }

  async function loadAlerts() {
    try {
      const data = await secureAction('security.alerts.list')
      setAlerts(data || [])
      return data
    } catch (e) {
      // Se a RPC/lista estiver protegida por RLS e não houver alertas, só ignore
      console.warn('alerts:', e.message)
      setAlerts([])
      return []
    }
  }

  // ========= AÇÕES =========
  async function approve(id) {
    if (!id) return
    setBusy(true); setErr('')
    try {
      await secureAction('approvals.decide', { id, decision: 'approved' })
      await loadApprovals()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  async function reject(id) {
    if (!id) return
    const ok = confirm('Tem certeza que deseja REJEITAR esta solicitação?')
    if (!ok) return
    setBusy(true); setErr('')
    try {
      await secureAction('approvals.decide', { id, decision: 'rejected' })
      await loadApprovals()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  async function undoDayFor(userId) {
    const today = new Date().toISOString().slice(0, 10)
    const ok = confirm(`Desfazer todas as ações de HOJE para este usuário?\n\nUsuário: ${userId}\nDia: ${today}`)
    if (!ok) return
    setBusy(true); setErr('')
    try {
      const res = await secureAction('undo-day', { actor: userId, day: today })
      alert('Registros revertidos: ' + (res?.reverted ?? 0))
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  async function ackAlert(id) {
    setBusy(true); setErr('')
    try {
      await secureAction('security.alerts.ack', { id })
      await loadAlerts()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  async function invalidateCache() {
    const ok = confirm('Invalidar o cache deste gabinete agora?')
    if (!ok) return
    setBusy(true); setErr('')
    try {
      const ts = await secureAction('cache.invalidate', { orgId: null }) // usa org do usuário
      alert('Cache invalidado às: ' + ts)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  // ========= GUARDAS =========
  if (!currentOrgId) {
    return (
      <Wrapper>
        <Title role={currentOrg?.role}>Ferramentas de Segurança</Title>
        <Info>Selecione um gabinete para continuar.</Info>
      </Wrapper>
    )
  }
  if (!isAdminOwner) {
    return (
      <Wrapper>
        <Title role={currentOrg?.role}>Ferramentas de Segurança</Title>
        <Error>Acesso negado. Esta página é exclusiva para <b>ADMIN</b> e <b>OWNER</b> do gabinete.</Error>
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <Title role={currentOrg?.role}>Ferramentas de Segurança</Title>
      {err && <Error>{err}</Error>}
      {busy && <Note>Processando…</Note>}

      {/* Linha de ações rápidas */}
      <div className="flex flex-wrap gap-2">
        <button onClick={invalidateCache} className="px-3 py-2 rounded-md border bg-slate-50 hover:bg-slate-100">
          🔄 Invalidar cache do gabinete
        </button>
        <button onClick={() => loadApprovals()} className="px-3 py-2 rounded-md border bg-slate-50 hover:bg-slate-100">
          🔁 Atualizar solicitações
        </button>
        <button onClick={() => loadAssessors()} className="px-3 py-2 rounded-md border bg-slate-50 hover:bg-slate-100">
          👥 Atualizar assessores
        </button>
        <button onClick={() => loadAlerts()} className="px-3 py-2 rounded-md border bg-slate-50 hover:bg-slate-100">
          🛎️ Atualizar alertas
        </button>
      </div>

      {/* Solicitações de aprovação */}
      <Section title="Solicitações de aprovação (pendentes)">
        {approvals.length === 0 ? (
          <Empty>Nenhuma solicitação pendente.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="text-left">
                  <th>Data</th>
                  <th>Solicitante</th>
                  <th>Ação</th>
                  <th>Detalhes</th>
                  <th>Decidir</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map(a => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                    <td>
                      <div className="font-medium">{a.requested_by_name}</div>
                      <div className="text-xs text-slate-600">{a.requested_by_email}</div>
                    </td>
                    <td><code className="bg-slate-100 px-1 rounded">{a.action}</code></td>
                    <td className="max-w-[420px] text-sm">
                      <pre className="bg-slate-50 rounded p-2 overflow-x-auto">{JSON.stringify(a.payload, null, 2)}</pre>
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex gap-2">
                        <button onClick={() => approve(a.id)} className="px-3 py-1 rounded-md border bg-green-50 hover:bg-green-100">Aprovar</button>
                        <button onClick={() => reject(a.id)} className="px-3 py-1 rounded-md border bg-red-50 hover:bg-red-100">Rejeitar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Assessores do gabinete */}
      <Section title="Assessores do gabinete">
        {assessors.length === 0 ? (
          <Empty>Nenhum membro encontrado.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="text-left">
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Papel</th>
                  <th>Undo HOJE</th>
                </tr>
              </thead>
              <tbody>
                {assessors.map(u => (
                  <tr key={u.user_id}>
                    <td className="font-medium">{u.name}</td>
                    <td className="text-slate-600">{u.email || '—'}</td>
                    <td>
                      <span className="px-2 py-0.5 rounded-full text-xs border bg-slate-50">{u.role}</span>
                    </td>
                    <td className="whitespace-nowrap">
                      <button
                        onClick={() => undoDayFor(u.user_id)}
                        className="px-3 py-1 rounded-md border bg-slate-50 hover:bg-slate-100"
                      >
                        Desfazer ações de HOJE
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Alertas de segurança */}
      <Section title="Alertas de segurança">
        {alerts?.length ? (
          <ul className="space-y-1">
            {alerts.map(a => (
              <li key={a.id} className="flex items-center justify-between text-sm bg-slate-50 border rounded-md px-2 py-1">
                <span className="text-slate-700">
                  <code className="bg-slate-100 px-1 rounded mr-1">{a.kind}</code>
                  {new Date(a.created_at).toLocaleString()}
                </span>
                <button onClick={() => ackAlert(a.id)} className="text-blue-600 hover:underline">Dar ACK</button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nenhum alerta listado.</Empty>
        )}
      </Section>
    </Wrapper>
  )
}

/* ======= Subcomponentes visuais ======= */

function Wrapper({ children }) {
  return <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">{children}</div>
}

function Title({ children, role }) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <span role="img" aria-label="shield">🛡️</span> {children}
      </h1>
      {role && (
        <span className="px-3 py-1 rounded-full text-xs bg-slate-100 border text-slate-700 uppercase">
          {role}
        </span>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="bg-white border rounded-2xl shadow-sm">
      <div className="p-4 font-semibold">{title}</div>
      <div className="p-4 border-t">{children}</div>
    </section>
  )
}

function Error({ children }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
      {children}
    </div>
  )
}

function Note({ children }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 text-slate-700 px-3 py-2 text-sm">
      {children}
    </div>
  )
}

function Info({ children }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 text-blue-700 px-3 py-2 text-sm">
      {children}
    </div>
  )
}

function Empty({ children }) {
  return <div className="text-slate-600 text-sm">{children}</div>
}
