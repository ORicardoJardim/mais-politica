import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Login from '../pages/Login'
import AdminDashboard from '../pages/AdminDashboard'
import { useAuth } from '../context/AuthContext'

// Sua “home” de usuário — coloque sua UI aqui
function UserHome() {
  return (
    <div className="container-app py-6">
      <h1>Área do Usuário</h1>
      <p className="text-slate-600 mt-2">Seu painel (Agenda, Demandas, etc.).</p>

      <div className="grid gap-4 mt-6 md:grid-cols-2">
        <div className="card"><div className="card-body">
          <h2>Agenda</h2>
          <p className="text-slate-600 mt-1">Próximos compromissos…</p>
        </div></div>

        <div className="card"><div className="card-body">
          <h2>Demandas</h2>
          <p className="text-slate-600 mt-1">Suas demandas ativas…</p>
        </div></div>
      </div>
    </div>
  )
}


function RequireAuth({ children }) {
  const { loading, user } = useAuth()
  if (loading) return <div className="p-6">Carregando...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireGuest({ children }) {
  const { loading, user } = useAuth()
  if (loading) return <div className="p-6">Carregando...</div>
  if (user) return <Navigate to="/" replace />
  return children
}

function RequireAdmin({ children }) {
  const { profile } = useAuth()
  if (!profile) return <div className="p-6">Carregando...</div>
  if (profile.role !== 'admin') return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route
          path="/login"
          element={
            <RequireGuest>
              <Login />
            </RequireGuest>
          }
        />

        <Route
          path="/"
          element={
            <RequireAuth>
              <UserHome />
            </RequireAuth>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAuth>
              <RequireAdmin>
                <AdminDashboard />
              </RequireAdmin>
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
