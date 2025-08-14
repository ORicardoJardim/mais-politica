import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError(error.message)
    else navigate('/')
  }

  return (
    <div className="min-h-[calc(100vh-64px)] grid place-items-center bg-[var(--brand-100)] px-4">
      <div className="card w-full max-w-md">
        <div className="card-body space-y-4">
          <div className="flex items-center justify-between">
            <h1>Entrar</h1>
            <span className="pill">Versão MVP</span>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-sm text-slate-600">Email</label>
              <input
                className="input mt-1"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-slate-600">Senha</label>
              <input
                className="input mt-1"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
              />
            </div>

            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-xs text-slate-500">
            Dica: se ainda não tem usuário, peça ao administrador para criar seu acesso.
          </p>
        </div>
      </div>
    </div>
  )
}
