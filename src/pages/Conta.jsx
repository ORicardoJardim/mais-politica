import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
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
      Authorization: `Bearer ${token}`,
    },
  })
  const text = await r.text()
  let payload = {}
  try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text } }
  if (!r.ok) throw new Error(payload?.error || payload?.raw || 'Erro na API')
  return payload
}

export default function Conta() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loadingPass, setLoadingPass] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [error, setError] = useState('')

  async function handleChangePassword(e) {
    e.preventDefault()
    setError('')
    if (!newPass || newPass.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setLoadingPass(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass })
      if (error) throw new Error(error.message)
      setNewPass('')
      alert('Senha alterada com sucesso!')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingPass(false)
    }
  }

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
      // limpa qualquer token residual
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
    <div className="container py-4">
      <h1 className="h4 mb-3">Minha Conta</h1>
      <p className="text-muted mb-4">Logado como: <strong>{user?.email}</strong></p>
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Trocar senha */}
      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title mb-3">Trocar senha</h5>
          <form className="row g-2 align-items-end" onSubmit={handleChangePassword}>
            <div className="col-md-4">
              <label className="form-label">Nova senha</label>
              <input
                type="password"
                className="form-control"
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>
            <div className="col-md-2">
              <button className="btn btn-primary w-100" disabled={loadingPass}>
                {loadingPass ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Excluir conta */}
      <div className="card">
        <div className="card-body">
          <h5 className="card-title mb-3 text-danger">Excluir conta</h5>
          <p className="text-muted">
            Esta ação é <strong>irreversível</strong> e removerá sua conta e dados associados.
          </p>
          <form className="row g-2 align-items-end" onSubmit={handleDeleteAccount}>
            <div className="col-md-4">
              <label className="form-label">Digite <code>EXCLUIR</code> para confirmar</label>
              <input
                className="form-control"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="EXCLUIR"
              />
            </div>
            <div className="col-md-2">
              <button className="btn btn-outline-danger w-100" disabled={loadingDelete}>
                {loadingDelete ? 'Excluindo...' : 'Excluir conta'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
