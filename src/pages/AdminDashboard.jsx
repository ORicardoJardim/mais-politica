// src/pages/AdminDashboard.jsx
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

// Base das rotas de API:
// - Produção ou `vercel dev`: pode ficar vazio (usa o mesmo host).
// - Vite (`npm run dev`): defina VITE_API_BASE no .env apontando para seu deploy Vercel.
const API_BASE = import.meta.env.VITE_API_BASE || ''

async function api(path, options = {}) {
  // pega o token atual do usuário logado
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
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    // resposta não-JSON (ex.: HTML de erro). Mantém text para mensagem.
    payload = { raw: text }
  }

  if (!r.ok) {
    const msg = payload?.error || payload?.raw || 'Erro na API'
    throw new Error(msg)
  }

  return payload
}

export default function AdminDashboard() {
  const { user, profile } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createForm, setCreateForm] = useState({ name:'', email:'', password:'', role:'user' })
  const [pwd, setPwd] = useState({ id:'', pass:'' }) // reset senha

  async function fetchUsers() {
    setError(''); setLoading(true)
    try {
      const j = await api('/api/admin-list-users')
      setList(j.users || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  async function createUser(e) {
    e.preventDefault()
    setError('')
    try {
      await api('/api/admin-create-user', {
        method: 'POST',
        body: JSON.stringify(createForm),
      })
      setCreateForm({ name:'', email:'', password:'', role:'user' })
      await fetchUsers()
      alert('Usuário criado com sucesso!')
    } catch (e) {
      setError(e.message)
    }
  }

  async function changeRole(id, role) {
    setError('')
    try {
      await api('/api/admin-update-user', {
        method: 'POST',
        body: JSON.stringify({ id, role }),
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
      await api('/api/admin-reset-password', {
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
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return
    setError('')
    try {
      await api('/api/admin-delete-user', {
        method: 'POST',
        body: JSON.stringify({ id }),
      })
      await fetchUsers()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="container py-4">
      <h1 className="h4 mb-3">Painel do Administrador</h1>
      <p className="text-muted mb-4">
        Logado como: <strong>{user?.email}</strong> • Role: <strong>{profile?.role}</strong>
      </p>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Criar usuário */}
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
              <label className="form-label">Papel</label>
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

      {/* Reset de senha */}
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

      {/* Tabela de usuários */}
      <div className="card">
        <div className="card-body">
          <h5 className="card-title mb-3">Usuários</h5>
          {loading ? (
            <div>Carregando…</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Role</th>
                    <th>Criado em</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(u => (
                    <tr key={u.id}>
                      <td className="text-truncate" style={{maxWidth:180}} title={u.id}>{u.id}</td>
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
                      <td>{new Date(u.created_at).toLocaleString()}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => deleteUser(u.id)}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!list.length && (
                    <tr>
                      <td colSpan="6" className="text-muted">Nenhum usuário.</td>
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
