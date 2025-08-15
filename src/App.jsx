import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import { useAuth } from './context/AuthContext'
import Demandas from './pages/Demandas'
import Conta from './pages/Conta'
import AdminInvites from './pages/AdminInvites'
import SuperAdminOrgs from './pages/SuperAdminOrgs'
import AcceptInvite from './pages/AcceptInvite'
import { useOrg } from './context/OrgContext'

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
  const { loading } = useAuth();          // ainda usamos loading da auth
  const { currentOrg } = useOrg();        // papel agora vem do org atual

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-6">Carregando…</div>;
  }
  // sem org selecionado -> volta
  if (!currentOrg) {
    return <Navigate to="/" replace />;
  }
  // não é admin do org atual -> volta
  if (currentOrg.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/demandas" element={<RequireAuth><Demandas /></RequireAuth>} />
        <Route path="/conta" element={<RequireAuth><Conta /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth><RequireAdmin><AdminDashboard /></RequireAdmin></RequireAuth>}/>
        <Route path="/admin/convites" element={<RequireAuth><RequireAdmin><AdminInvites /></RequireAdmin></RequireAuth>} />
        <Route path="/super/orgs" element={<RequireAuth><SuperAdminOrgs /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/accept-invite" element={<RequireAuth><AcceptInvite /></RequireAuth>} />
      </Routes>
    </>
  )
}
