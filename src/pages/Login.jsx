import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { error } = await signIn(email, password)
      if (error) throw new Error(error.message)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || 'Falha ao entrar')
    } finally {
      setLoading(false)
    }
  }

  async function loginWithGoogle() {
    setError('')
    // redireciona e volta no /auth/v1/callback configurado no Supabase
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin // volta para o site após o callback
      }
    })
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-slate-50 to-white flex items-center">
      <div className="w-full">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-100">
            <h1 className="text-center text-2xl font-bold text-slate-900 mb-6">Entrar</h1>

            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ...campos Email/Senha e botão Entrar (mantém como está)... */}
            </form>

            {/* separador */}
            <div className="flex items-center gap-3 my-5">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-xs text-slate-400">ou</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>

            {/* Botão Google */}
            <button
              onClick={loginWithGoogle}
              className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition font-semibold flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.783 33.659 29.273 37 24 37c-7.18 0-13-5.82-13-13s5.82-13 13-13c3.312 0 6.332 1.236 8.627 3.273l5.657-5.657C34.676 5.089 29.566 3 24 3 12.955 3 4 11.955 4 23s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"/>
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.817C14.35 16.155 18.77 13 24 13c3.312 0 6.332 1.236 8.627 3.273l5.657-5.657C34.676 5.089 29.566 3 24 3 16.318 3 9.656 7.337 6.306 14.691z"/>
                <path fill="#4CAF50" d="M24 43c5.192 0 9.86-1.993 13.39-5.243l-6.19-5.238C29.927 34.674 27.152 36 24 36c-5.243 0-9.671-3.355-11.297-8.017l-6.54 5.036C9.47 39.553 16.21 43 24 43z"/>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.339 3.859-5.001 7-11.303 7-5.243 0-9.671-3.355-11.297-8.017l-6.54 5.036C9.47 39.553 16.21 43 24 43c11.045 0 20-8.955 20-20 0-1.341-.138-2.651-.389-3.917z"/>
              </svg>
              Entrar com Google
            </button>

          </div>
        </div>
      </div>
    </div>
  )
}
