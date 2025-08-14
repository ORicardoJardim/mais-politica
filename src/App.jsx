import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Login from '../pages/Login'
import { useAuth } from '../context/AuthContext'

function UserHome() {
  return (
    <div className="container-app py-6">
      <h1>Área do Usuário</h1>
      <p className="text-slate-600 mt-2">Se você está vendo isso, está LOGADO 👍</p>
    </div>
  )
}

function RequireAuth({ children }) {
  const { loading, user } = useAuth()
  if (loading) return <div className="container-app py-6">Carregando sessão…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireGuest({ children }) {
  const { loading, user } = useAuth()
  if (loading) return <div className="container-app py-6">Carregando…</div>
  if (user) return <Navigate to="/" replace />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
