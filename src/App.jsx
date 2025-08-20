import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import { useAuth } from './context/AuthContext'
import Demandas from './pages/Demandas'
import Conta from './pages/Conta'
import AdminInvites from './pages/AdminInvites'
import AcceptInvite from './pages/AcceptInvite'
import { useOrg } from './context/OrgContext'
import SuperDashboard from './pages/SuperDashboard'
import CreateOrg from './pages/CreateOrg'
import Eleitores from './pages/Eleitores'
import Relatorios from './pages/Relatorios'
import Home from './pages/Home'
import AdminTools from './pages/AdminTools'
import Join from './pages/Join'




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
  {/* Públicas */}
  <Route
    path="/login"
    element={<RequireGuest><Login /></RequireGuest>}
  />

  {/* Protegidas */}
  <Route
    path="/"
    element={<RequireAuth><Home /></RequireAuth>}
  />
  <Route
    path="/demandas"
    element={<RequireAuth><Demandas /></RequireAuth>}
  />
  <Route
    path="/eleitores"
    element={<RequireAuth><Eleitores /></RequireAuth>}
  />
  <Route
    path="/relatorios"
    element={<RequireAuth><Relatorios /></RequireAuth>}
  />
  <Route
    path="/conta"
    element={<RequireAuth><Conta /></RequireAuth>}
  />
  <Route
    path="/admin"
    element={<RequireAuth><RequireAdmin><AdminDashboard /></RequireAdmin></RequireAuth>}
  />
  <Route
    path="/admin/convites"
    element={<RequireAuth><RequireAdmin><AdminInvites /></RequireAdmin></RequireAuth>}
  />
  <Route
    path="/super"
    element={<RequireAuth><SuperDashboard /></RequireAuth>}
  />
  <Route
    path="/orgs/new"
    element={<RequireAuth><CreateOrg /></RequireAuth>}
  />
  <Route
    path="/accept-invite"
    element={<RequireAuth><AcceptInvite /></RequireAuth>}
  />

  {/* Fallback */}
  <Route path="*" element={<Navigate to="/" replace />} />

<Route path="/admin-tools" element={<AdminTools />} />

<Route path="/join" element={<Join />} />


</Routes>

    </>
  )
}