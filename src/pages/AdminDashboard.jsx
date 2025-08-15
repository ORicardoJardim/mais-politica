// src/pages/AdminDashboard.jsx
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Link } from 'react-router-dom'
import { useOrg } from '../context/OrgContext'

// Base de API (prod usa host atual)
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
      Authorization: `Bearer ${token}`,
    },
  })
  const text = await r.text()
  let payload = {}
  try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text } }
  if (!r.ok) throw new Error(payload?.error || payload?.raw || 'Erro na API')
  return payload
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const { currentOrgId, currentOrg } = useOrg()

  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // criação direta (a gente recomenda convites, mas deixamos aqui)
  const [createForm, setCreateForm] = useState({ name:'', email:'', password:'', role:'user' })
  const [pwd, setPwd] = useState({ id:'', pass:'' }) // reset de senha (super admin)

  async function fetchUsers() {
    setError(''); setLoading(true)
    try {
      if (!currentOrgId) { setList([]); return }
      const j = await api(`/api/admin?action=list&org_id=${currentOrgId}`)
      setList(j.users || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [currentOrgId])

  async function createUser(e) {
    e.preventDefault()
    setError('')
    try {
      await api('/api/admin?action=create', {
        method: 'POST',
        body: JSON.stringify({ ...createForm, org_id: currentOrgId }),
      })
      setCreateForm({ name:'', email:'', password:'', role:'user' })
      await fetchUsers()
      alert('Usuário criado e vinculado ao gabinete!')
    } catch (e) {
      setError(e.message)
    }
  }

  async function changeRole(id, role) {
    setError('')
    try {
      await api('/api/admin?action=update', {
        method: 'POST',
        body: JSON.stringify({ id, role, org_id: currentOrgId }),
      })
      await fetchUsers()
    } catch (e) {
      setError(e.message)
    }
  }

  async function resetPassword(e) {
    e.preventDefault()
    if (!pwd.id || !pwd.pass) return
    setError('')
    try {
      await api('/api/admin?action=reset', {
        method: 'POST',
        body: JSON.stringify({ id: pwd.id, password: pwd.pass }),
      })
      setPwd({ id:'', pass:'' })
      alert('Senha atualizada!')
    } catch (e) {
      setError(e.message)
    }
  }

  async function deleteUser(id) {
    if (!confirm('Remover este usuário do gabinete?')) return
    setError('')
    try {
      await api('/api/admin?action=remove', {
        method: 'POST',
        body: JSON.stringify({ id, org_id: currentOrgId }),
      })
      await fetchUsers()
    } catch (e) {
      setError(e.message)
    }
  }

  if (!currentOrgId) {
    return (
      <div className="container py-4">
        <h1 className="h4 mb-3">Painel do Administrador</h1>
        <div className="alert alert-warning">
          Selecione um gabinete no topo para gerenciar usuários.
        </div>
      </div>
    )
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">Painel do Administrador</h1>
        <Link to="/admin/convites" className="btn btn-primary">
          Gerenciar convites
        </Link>
      </div>

      <p className="text-muted mb-4">
        Gabinete atual: <strong>{currentOrg?.name}</strong>
      </p>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Criar usuário diretamente (alternativa aos convites) */}
      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title mb-3">Criar novo usuário</h5>
          <form className="row g-2 align-items-end" onSubmit={createUser}>
            <div className="col-md-3">
              <label className="form-label">Nome</label>
              <input
                className="form-control"
                value={createForm.name}
                onChange={e=>setCreateForm({...createForm, name:e.target.value})}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">E-mail</label>
              <input
                type="email"
                className="form-control"
                value={createForm.email}
                onChange={e=>setCreateForm({...createForm, email:e.target.value})}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Senha inicial</label>
              <input
                type="password"
                className="form-control"
                value={createForm.password}
                onChange={e=>setCreateForm({...createForm, password:e.target.value})}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Papel (no gabinete)</label>
              <select
                className="form-select"
                value={createForm.role}
                onChange={e=>setCreateForm({...createForm, role:e.target.value})}
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div className="col-md-2">
              <button className="btn btn-primary w-100">Criar</button>
            </div>
          </form>
        </div>
      </div>

      {/* Reset de senha (somente super admin no backend) */}
      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title mb-3">Resetar senha</h5>
          <form className="row g-2 align-items-end" onSubmit={resetPassword}>
            <div className="col-md-4">
              <label className="form-label">Usuário (ID)</label>
              <input
                className="form-control"
                placeholder="cole o ID do usuário"
                value={pwd.id}
                onChange={e=>setPwd({...pwd, id:e.target.value})}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Nova senha</label>
              <input
                type="password"
                className="form-control"
                value={pwd.pass}
                onChange={e=>setPwd({...pwd, pass:e.target.value})}
              />
            </div>
            <div className="col-md-2">
              <button className="btn btn-warning w-100">Resetar</button>
            </div>
          </form>
          <small className="text-muted">Dica: copie o ID na tabela abaixo.</small>
        </div>
      </div>

      {/* Tabela de usuários (membership do gabinete atual) */}
      <div className="card">
        <div className="card-body">
          <h5 className="card-title mb-3">Usuários do gabinete</h5>
          {loading ? (
            <div>Carregando…</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Função</th>
                    <th>Criado em</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(u => (
                    <tr key={u.id}>
                      <td>{u.name || '—'}</td>
                      <td>{u.email}</td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={u.role || 'user'}
                          onChange={e => changeRole(u.id, e.target.value)}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td>{u.created_at ? new Date(u.created_at).toLocaleString() : '—'}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => deleteUser(u.id)}
                        >
                          Remover do gabinete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!list.length && (
                    <tr>
                      <td colSpan="5" className="text-muted">Nenhum usuário neste gabinete.</td>
                    </tr>
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
