import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null // ou um spinner

  if (!user) {
    // guarda a rota que tentou acessar para redirecionar depois do login
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
