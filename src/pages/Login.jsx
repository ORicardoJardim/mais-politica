// src/pages/Login.jsx
import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const afterLogin = () => {
    const to = state?.from || '/'
    navigate(to, { replace: true })
  }

  async function onPasswordLogin(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { error } = await signIn(email, password)
      if (error) throw error
      afterLogin()
    } catch (e) {
      setError(e.message || 'Falha no login')
    } finally {
      setLoading(false)
    }
  }

  async function onGoogle() {
    setError('')
    const redirectTo = window.location.href
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
      })
    } catch (e) {
      setError(e.message || 'Falha ao redirecionar para o Google')
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-3xl bg-white border rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-center mb-1">Entrar</h1>
        <p className="text-center text-slate-600 mb-6">
          Acesse com e-mail e senha ou usando sua conta do Google.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Bloco: Email e senha */}
          <form onSubmit={onPasswordLogin} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">E-mail</label>
              <input
                type="email"
                className="input w-full"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="voce@email.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Senha</label>
              <input
                type="password"
                className="input w-full"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          {/* Divider (mobile) */}
          <div className="md:hidden flex items-center justify-center">
            <span className="text-xs text-slate-500">ou</span>
          </div>

          {/* Bloco: Google */}
          <div className="flex flex-col justify-center">
            <button
              onClick={onGoogle}
              className="w-full px-3 py-2 rounded-xl border hover:bg-slate-50 transition flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.873 33.325 29.369 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"/>
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.817C14.655 16.108 19.01 13 24 13c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                <path fill="#4CAF50" d="M24 44c5.305 0 10.139-2.034 13.773-5.343l-6.356-5.371C29.31 34.463 26.787 35.5 24 35.5c-5.336 0-9.824-3.605-11.441-8.494l-6.6 5.086C8.238 39.517 15.557 44 24 44z"/>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.297 3.242-3.86 5.83-7.586 7.203l.006.004 6.356 5.371C36.063 41.82 40 38 40 24c0-1.341-.138-2.651-.389-3.917z"/>
              </svg>
              Entrar com Google
            </button>

            <p className="text-xs text-slate-500 text-center mt-3">
              Certifique-se de que o seu e-mail do Google está habilitado no sistema (convite do gabinete).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
