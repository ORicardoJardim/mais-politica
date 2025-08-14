import React from 'react'
import { useAuth } from '../context/AuthContext'

export default function AdminDashboard() {
  const { user, profile } = useAuth()
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold">Painel do Administrador</h1>
      <p className="text-sm text-gray-600 mt-2">
        Logado como: {user?.email} • Role: {profile?.role || '(?)'}
      </p>
      <div className="mt-4 text-gray-600">Conteúdo do admin aqui…</div>
    </div>
  )
}
