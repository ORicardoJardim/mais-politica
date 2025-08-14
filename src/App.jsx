import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Login from '../pages/Login'
import AdminDashboard from '../pages/AdminDashboard'
import Demandas from '../pages/Demandas' // se ainda não criou, pode remover esta linha/rota
import { useAuth } from '../context/AuthContext'

function Dashboard() {
  return (
    <div className="container-app py-6">
      <h1>Área do Usuário</h1>
      <p className="text-slate-600 mt-2">Seu painel (Agenda, Demandas, etc.).</p>
    </div>
  )
}

function RequireAuth({ children }) {
  const { loading, user } = useAuth()
  if (loading) return <div className="container-app py-6">Carregando…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireGuest({ children }) {
  const { loading, user } = useAuth()
  if (loading) return <div className="container-app py-6">Carregando…</div>
  if (user) return <Navigate to="/" replace />
  return children
}

function RequireAdmin({ children }) {
  const { profile } = useAuth()
  if (!profile) return <div className="container-app py-6">Carregando…</div>
  if (profile.role !== 'admin') return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={
          <RequireGuest><Login /></RequireGuest>
        } />

        <Route path="/" element={
          <RequireAuth><Dashboard /></RequireAuth>
        } />

        <Route path="/admin" element={
          <RequireAuth><RequireAdmin><AdminDashboard /></RequireAdmin></RequireAuth>
        } />

        {/* Remova esta rota se ainda não criou pages/Demandas.jsx */}
        <Route path="/demandas" element={
          <RequireAuth><Demandas /></RequireAuth>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
