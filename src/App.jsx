import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import { useAuth } from './context/AuthContext'
import Demandas from './pages/Demandas'



function Dashboard() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold">Área do Usuário</h1>
      <p className="text-gray-600 mt-2">Se você está vendo isto, a app está renderizando ✅</p>
    </div>
  )
}

function RequireAuth({ children }) {
  const { loading, user } = useAuth()
  if (loading) return <div className="max-w-7xl mx-auto px-4 py-6">Carregando…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireGuest({ children }) {
  const { loading, user } = useAuth()
  if (loading) return <div className="max-w-7xl mx-auto px-4 py-6">Carregando…</div>
  if (user) return <Navigate to="/" replace />
  return children
}

function RequireAdmin({ children }) {
  const { profile } = useAuth()
  if (!profile) return <div className="max-w-7xl mx-auto px-4 py-6">Carregando…</div>
  if (profile.role !== 'admin') return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/admin" element={
          <RequireAuth><RequireAdmin><AdminDashboard /></RequireAdmin></RequireAuth>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
     
        <Route path="/demandas" element={
          <RequireAuth><Demandas /></RequireAuth>
        }/>  

        <Route path="/conta" element={<RequireAuth><Conta /></RequireAuth>} />

      </Routes>
    </>
  )
}
