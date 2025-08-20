// src/pages/Conta.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
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
  let payload = {}
  try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text } }
  if (!r.ok) throw new Error(payload?.error || payload?.raw || 'Erro na API')
  return payload
}

export default function Conta() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { orgs, currentOrgId, setCurrentOrgId, refetchMemberships } = useOrg()

  const [confirm, setConfirm] = useState('')
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [error, setError] = useState('')

  const avatar = user?.user_metadata?.avatar_url
  const nome   = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário'

  // ========= Participar de outro gabinete (por código) =========
  const [joinCode, setJoinCode] = useState('')
  const [joinNote, setJoinNote] = useState('')
  const [joinSubmitting, setJoinSubmitting] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [joinSuccess, setJoinSuccess] = useState('')

  // Minhas solicitações
  const [myReqs, setMyReqs] = useState([])
  const [myReqsLoading, setMyReqsLoading] = useState(true)
  const [myReqsError, setMyReqsError] = useState('')

  async function fetchMyJoinRequests() {
    if (!user) { setMyReqs([]); return }
    setMyReqsError(''); setMyReqsLoading(true)
    try {
      // busca solicitações feitas por mim
      const { data: reqs, error: qErr } = await supabase
        .from('org_join_requests')
        .select('id, org_id, status, note, created_at, decided_at, decided_by')
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false })
      if (qErr) throw qErr

      // enriquece com nome do org (sem depender de FK)
      const ids = Array.from(new Set((reqs || []).map(r => r.org_id).filter(Boolean)))
      let namesById = {}
      if (ids.length) {
        const { data: orgRows, error: oErr } = await supabase
          .from('orgs')
          .select('id, name')
          .in('id', ids)
        if (oErr) throw oErr
        namesById = (orgRows || []).reduce((acc, o) => { acc[o.id] = o.name || 'Gabinete'; return acc }, {})
      }

      setMyReqs((reqs || []).map(r => ({ ...r, org_name: namesById[r.org_id] || r.org_id })))
    } catch (e) {
      setMyReqsError(e.message)
    } finally {
      setMyReqsLoading(false)
    }
  }

  useEffect(() => { fetchMyJoinRequests() }, [user?.id])

  async function submitJoinRequest(e) {
    e.preventDefault()
    setJoinError(''); setJoinSuccess('')
    if (!user) { setJoinError('Você precisa estar logado.'); return }
    const code = joinCode.trim()
    if (!code) { setJoinError('Informe o código do gabinete.'); return }

    setJoinSubmitting(true)
    try {
      // 1) encontra gabinete pelo código
      const { data: org, error: orgErr } = await supabase
        .from('orgs')
        .select('id, name')
        .eq('join_code', code)
        .maybeSingle()
      if (orgErr) throw orgErr
      if (!org?.id) throw new Error('Código inválido ou gabinete não encontrado.')

      // 2) evita duplicidade: já sou membro?
      const alreadyMember = orgs.some(o => o.org_id === org.id)
      if (alreadyMember) throw new Error('Você já participa deste gabinete.')

      // 3) evita duplicidade: já tenho pedido pendente?
      const { data: existing, error: exErr } = await supabase
        .from('org_join_requests')
        .select('id, status')
        .eq('org_id', org.id)
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
      if (exErr) throw exErr
      if (existing?.length && existing[0]?.status === 'pending') {
        throw new Error('Você já tem uma solicitação pendente para este gabinete.')
      }

      // 4) cria a solicitação
      const { error: insErr } = await supabase
        .from('org_join_requests')
        .insert({
          org_id: org.id,
          requester_id: user.id,
          note: joinNote?.trim() || null,
          status: 'pending'
        })
      if (insErr) throw insErr

      setJoinSuccess(`Solicitação enviada para "${org.name}". Aguarde a aprovação do admin.`)
      setJoinCode(''); setJoinNote('')
      fetchMyJoinRequests()
    } catch (e) {
      setJoinError(e.message)
    } finally {
      setJoinSubmitting(false)
    }
  }

  // ========= Excluir conta =========
  async function handleDeleteAccount(e) {
    e.preventDefault()
    setError('')
    if (confirm !== 'EXCLUIR') {
      setError('Digite EXCLUIR exatamente para confirmar.')
      return
    }
    if (!window.confirm('Tem certeza? Esta ação é irreversível.')) return
    setLoadingDelete(true)
    try {
      await api('/api/user-delete-account', { method: 'POST', body: JSON.stringify({}) })
      await signOut()
      Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k))
      alert('Conta excluída. Até breve!')
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingDelete(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Minha Conta</h1>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Perfil */}
      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-4">
          <img
            src={avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(nome)}&background=E5E7EB&color=374151`}
            alt="Avatar"
            className="w-16 h-16 rounded-full border"
          />
          <div>
            <div className="text-lg font-semibold">{nome}</div>
            <div className="text-slate-600">{user?.email}</div>
            <div className="text-xs text-slate-500 mt-1">
              Login via Google.
            </div>
          </div>
        </div>
      </div>

      {/* Participar de outro gabinete (por código) */}
      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <h2 className="font-semibold mb-2">Participar de outro gabinete</h2>
        <p className="text-slate-600 mb-3">
          Informe o <strong>código do gabinete</strong>. O admin do gabinete precisa aprovar sua solicitação.
        </p>

        {joinError && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm mb-3">
            {joinError}
          </div>
        )}
        {joinSuccess && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 px-3 py-2 text-sm mb-3">
            {joinSuccess}
          </div>
        )}

        <form onSubmit={submitJoinRequest} className="grid gap-3 md:grid-cols-3">
          <input
            className="input"
            placeholder="Código do gabinete"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
          />
          <input
            className="input md:col-span-2"
            placeholder="Mensagem opcional (por que deseja entrar?)"
            value={joinNote}
            onChange={e => setJoinNote(e.target.value)}
          />
          <div className="md:col-span-3 flex gap-2">
            <button className="btn-primary" disabled={joinSubmitting}>
              {joinSubmitting ? 'Enviando…' : 'Enviar solicitação'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => { setJoinCode(''); setJoinNote(''); setJoinError(''); setJoinSuccess('') }}
              disabled={joinSubmitting}
            >
              Limpar
            </button>
          </div>
        </form>

        {/* Minhas solicitações */}
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Suas solicitações</h3>
          {myReqsError && (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm mb-3">
              {myReqsError}
            </div>
          )}
          {myReqsLoading ? 'Carregando…' : (
            <div className="table-responsive">
              <table className="table w-full">
                <thead>
                  <tr className="text-left">
                    <th>Gabinete</th>
                    <th className="hidden md:table-cell">Mensagem</th>
                    <th style={{width:140}}>Status</th>
                    <th style={{width:200}} className="hidden md:table-cell">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {myReqs.map(r => (
                    <tr key={r.id}>
                      <td className="font-medium">{r.org_name || r.org_id}</td>
                      <td className="hidden md:table-cell">{r.note || '—'}</td>
                      <td>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs border bg-slate-50">
                          {r.status}
                        </span>
                      </td>
                      <td className="hidden md:table-cell">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {!myReqs.length && (
                    <tr><td colSpan="4" className="text-slate-500">Nenhuma solicitação enviada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Gabinetes do usuário */}
      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Seus gabinetes</h2>
          <span className="text-sm text-slate-500">Total: {orgs.length}</span>
        </div>

        <div className="table-responsive">
          <table className="table w-full">
            <thead>
              <tr className="text-left">
                <th>Nome</th>
                <th className="hidden md:table-cell">Papel</th>
                <th style={{ width: 140 }}></th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(o => (
                <tr key={o.org_id}>
                  <td className="font-medium">{o.name}</td>
                  <td className="hidden md:table-cell">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs border bg-slate-50">
                      {o.role}
                    </span>
                  </td>
                  <td>
                    {currentOrgId === o.org_id ? (
                      <span className="text-sm text-slate-500">Atual</span>
                    ) : (
                      <button
                        className="btn"
                        onClick={() => { setCurrentOrgId(o.org_id); navigate('/') }}
                        title="Entrar neste gabinete"
                      >
                        Entrar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!orgs.length && (
                <tr><td colSpan="3" className="text-slate-500">Você ainda não participa de nenhum gabinete.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Excluir conta */}
      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <h2 className="font-semibold text-red-600 mb-2">Excluir conta</h2>
        <p className="text-slate-600 mb-3">
          Esta ação é <strong>irreversível</strong> e removerá sua conta e dados associados.
        </p>

        <form className="grid gap-3 md:grid-cols-3" onSubmit={handleDeleteAccount}>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Digite <code>EXCLUIR</code> para confirmar</label>
            <input
              className="input w-full"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="EXCLUIR"
            />
          </div>
          <div className="flex items-end">
            <button className="btn-danger w-full" disabled={loadingDelete}>
              {loadingDelete ? 'Excluindo…' : 'Excluir conta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
