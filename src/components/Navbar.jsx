import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async (e) => {
    e.preventDefault()
    try {
      await signOut() // encerra sessão no Supabase
    } finally {
      // limpa qualquer token residual do Supabase no navegador
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith('sb-'))
          .forEach((k) => localStorage.removeItem(k))
      } catch {}
      navigate('/login', { replace: true }) // volta para o login
    }
  }

  return (
    <header className="w-full border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-lg font-semibold">
          Mais Política
        </Link>

        <nav className="flex items-center gap-2">
          {user && (
            <Link className="px-3 py-2 rounded-xl border hover:bg-gray-50" to="/">
              Início
            </Link>
          )}

          {user && (
            <Link className="px-3 py-2 rounded-xl border hover:bg-gray-50" to="/demandas">
              Demandas
            </Link>
          )}

          {user && profile?.role === 'admin' && (
            <Link className="px-3 py-2 rounded-xl border hover:bg-gray-50" to="/admin">
              Admin
            </Link>
          )}

          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl border hover:bg-gray-50"
            >
              Sair
            </button>
          ) : (
            <Link className="px-3 py-2 rounded-xl border hover:bg-gray-50" to="/login">
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

