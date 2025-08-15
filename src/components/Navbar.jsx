// src/components/Navbar.jsx
import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
{profile?.is_super_admin && item('/super/orgs', 'Super')}

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { orgs, currentOrgId, setCurrentOrgId, currentOrg } = useOrg()

  const handleLogout = async () => {
    try {
      await signOut()
    } finally {
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('sb-'))
          .forEach(k => localStorage.removeItem(k))
        localStorage.removeItem('currentOrgId')
      } catch {}
      navigate('/login', { replace: true })
    }
  }

  const item = (to, label, disabled = false) => (
    <Link
      to={disabled ? '#' : to}
      onClick={e => disabled && e.preventDefault()}
      className={[
        'px-3 py-2 rounded-full border transition no-underline',
        disabled
          ? 'opacity-50 cursor-not-allowed border-slate-200'
          : pathname === to
            ? 'bg-slate-900 text-white border-slate-900'
            : 'hover:bg-slate-50 border-slate-200'
      ].join(' ')}
    >
      {label}
    </Link>
  )

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        <Link
          to="/"
          className="brand-font text-[22px] font-extrabold tracking-tight text-slate-900 no-underline"
        >
          Mais Política
        </Link>

        <nav className="flex gap-2 items-center">
          {user ? (
            <>
              {/* Se o usuário AINDA NÃO tem gabinetes, oferece onboarding */}
              {orgs.length === 0 ? (
                <>
                  <Link
                    to="/onboarding"
                    className="px-3 py-2 rounded-full border border-slate-200 hover:bg-slate-50 transition no-underline"
                  >
                    Criar gabinete
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-2 rounded-full border border-slate-200 hover:bg-slate-50 transition"
                  >
                    Sair
                  </button>
                </>
              ) : (
                <>
                  {/* Seletor de gabinete */}
                  <select
                    value={currentOrgId || ''}
                    onChange={e => setCurrentOrgId(e.target.value || null)}
                    className="px-3 py-2 rounded-full border border-slate-200 bg-white"
                    title="Selecionar gabinete"
                  >
                    {orgs.map(o => (
                      <option key={o.org_id} value={o.org_id}>
                        {o.name}{o.role === 'admin' ? ' (admin)' : ''}
                      </option>
                    ))}
                  </select>

                  {item('/', 'Início', !currentOrgId)}
                  {item('/demandas', 'Demandas', !currentOrgId)}
                  {item('/conta', 'Minha Conta')}
                  {currentOrg?.role === 'admin' && item('/admin', 'Admin')}

                  <button
                    onClick={handleLogout}
                    className="px-3 py-2 rounded-full border border-slate-200 hover:bg-slate-50 transition"
                  >
                    Sair
                  </button>
                </>
              )}
            </>
          ) : (
            item('/login', 'Entrar')
          )}
        </nav>
      </div>
    </header>
  )
}
