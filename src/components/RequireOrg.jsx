// src/components/RequireOrg.jsx
import React from 'react'
import { Navigate } from 'react-router-dom'
import { useOrg } from '../context/OrgContext'

export default function RequireOrg({ children }) {
  const { loading, orgs, currentOrgId } = useOrg()

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-6">Carregando…</div>

  // Se não tem nenhum gabinete ainda, manda para onboarding
  if (!orgs.length) return <Navigate to="/onboarding" replace />

  // Se tem gabinetes mas nenhum selecionado (caso raro), só renderiza mesmo assim
  return children
}
