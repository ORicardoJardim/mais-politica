// src/components/Navbar.jsx
import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const { orgs, currentOrgId, setCurrentOrgId, currentOrg } = useOrg()

  // abre/fecha o menu lateral (overlay)
  const [open, setOpen] = useState(false)

  const isSuper = !!profile?.is_super_admin
  const isAdminOrg = currentOrg?.role === 'admin'
  const isAdminOwner = currentOrg?.role === 'admin' || currentOrg?.role === 'owner' // <-- novo

  const handleLogout = async () => {
    try { await signOut() } finally {
      try {
        Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k))
        localStorage.removeItem('currentOrgId')
      } catch {}
      navigate('/login', { replace: true })
    }
  }

  // link da sidebar
  const Item = ({ to, label, disabled = false, onClick }) => {
    const active = pathname === to
    const base =
      'block w-full text-left px-3 py-2 rounded-xl transition no-underline text-[15px]'
    const styles = disabled
      ? 'opacity-50 cursor-not-allowed'
      : active
        ? 'bg-slate-900 text-white'
        : 'hover:bg-slate-100 text-slate-900'
    return (
      <Link
        to={disabled ? '#' : to}
        onClick={e => {
          if (disabled) e.preventDefault()
          setOpen(false)
          if (onClick) onClick()
        }}
        className={`${base} ${styles}`}
      >
        {label}
      </Link>
    )
  }

  return (
    <>
      {/* TOP BAR bem limpa */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Botão para abrir sidebar (fica à esquerda também no desktop) */}
          <button
            className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={open ? 'true' : 'false'}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>

          {/* Brand */}
          <Link
            to="/"
            className="brand-font text-[20px] md:text-[22px] font-extrabold tracking-tight text-slate-900 no-underline"
          >
            Mais Política
          </Link>

          {/* Seletor de gabinete (se houver) */}
          <div className="flex-1 flex justify-end">
            {user && orgs.length > 0 && (
              <select
                value={currentOrgId || ''}
                onChange={e => setCurrentOrgId(e.target.value || null)}
                className="px-3 py-2 rounded-full border border-slate-200 bg-white max-w-[260px]"
                title="Selecionar gabinete"
              >
                {orgs.map(o => (
                  <option key={o.org_id} value={o.org_id}>
                    {o.name}{o.role === 'admin' ? ' (admin)' : o.role === 'owner' ? ' (owner)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

      {/* OVERLAY + SIDEBAR (sobrepõe o conteúdo; não precisa mexer em outras páginas) */}
      {open && (
        <div className="fixed inset-0 z-50">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* drawer */}
          <aside
            className="absolute left-0 top-0 h-full w-[300px] bg-white border-r border-slate-200 shadow-xl p-4 flex flex-col"
            role="dialog"
            aria-label="Menu de navegação"
          >
            {/* topo do drawer */}
            <div className="flex items-center justify-between mb-3">
              <div className="brand-font text-lg font-extrabold tracking-tight text-slate-900">
                Mais Política
              </div>
              <button
                className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* seletor de gabinete (ocupando toda a largura) */}
            {user && orgs.length > 0 && (
              <div className="mb-3">
                <label className="block text-xs text-slate-500 mb-1">Gabinete</label>
                <select
                  value={currentOrgId || ''}
                  onChange={e => setCurrentOrgId(e.target.value || null)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  title="Selecionar gabinete"
                >
                  {orgs.map(o => (
                    <option key={o.org_id} value={o.org_id}>
                      {o.name}{o.role === 'admin' ? ' (admin)' : o.role === 'owner' ? ' (owner)' : ''}
                    </option>
                  ))}
                </select>
                {currentOrg && (
                  <div className="mt-1 text-xs text-slate-500">
                    Papel: <strong>{currentOrg.role}</strong>
                  </div>
                )}
              </div>
            )}

            {/* links */}
            <nav className="flex-1 flex flex-col gap-1 mt-1">
              {user ? (
                <>
                  <Item to="/" label="Início" disabled={!currentOrgId} />
                  <Item to="/demandas" label="Demandas" disabled={!currentOrgId} />
                  <Item to="/relatorios" label="Relatórios" disabled={!currentOrgId} />
                  <Item to="/eleitores" label="Eleitores" disabled={!currentOrgId} />
                  {user && orgs.length === 0 && <Item to="/join" label="Entrar em Gabinete" />}
                  {/* novo atalho: só admin/owner */}
                  {isAdminOwner && <Item to="/admin-tools" label="Ferramentas de Segurança" disabled={!currentOrgId} />}
                  <Item to="/conta" label="Minha Conta" />
                  {isAdminOrg && <Item to="/admin" label="Admin" />}
                  {isSuper && <Item to="/orgs/new" label="Novo Gabinete" />}
                  {isSuper && <Item to="/super" label="Owner" />}
                </>
              ) : (
                <Item to="/login" label="Entrar" />
              )}
            </nav>

            {/* rodapé do drawer */}
            {user && (
              <div className="pt-3 border-t mt-3">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
                >
                  Sair
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  )
}
