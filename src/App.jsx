import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import Demandas from './pages/Demandas'
import Conta from './pages/Conta'
import { useAuth } from './context/AuthContext'
import AcceptInvite from './pages/AcceptInvite'
import AdminInvites from './pages/AdminInvites'
import Onboarding from './pages/Onboarding'
import InvitePage from './pages/InvitePage'
import RequireOrg from './components/RequireOrg'
import SuperAdminOrgs from './pages/SuperAdminOrgs'


function Dashboard() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold">Área do Usuário</h1>
      <p className="text-gray-600 mt-2">Se você está vendo isto, a app está renderizando ✅</p>
    </div>
  )
}

// Guards locais (não importar de outro arquivo para evitar duplicação)
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
        {/* público (somente deslogado) */}
        <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />

        {/* privado */}
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/demandas" element={<RequireAuth><Demandas /></RequireAuth>} />
        <Route path="/conta" element={<RequireAuth><Conta /></RequireAuth>} />

        {/* admin */}
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

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />

        <Route path="/convidar" element={<RequireAuth><InvitePage /></RequireAuth>} />

        <Route path="/accept-invite" element={<AcceptInvite />} />

        <Route
          path="/admin/convites"
            element={
              <RequireAuth>
                 <RequireAdmin>
                  <AdminInvites />
                 </RequireAdmin>
              </RequireAuth>
            }
        />
        <Route
          path="/onboarding"
            element={
              <RequireAuth>
               <Onboarding />
              </RequireAuth>
          }
        />
        <Route path="/" element={
  <RequireAuth>
    <RequireOrg>
      <Dashboard />
    </RequireOrg>
  </RequireAuth>
} />

<Route path="/demandas" element={
  <RequireAuth>
    <RequireOrg>
      <Demandas />
    </RequireOrg>
  </RequireAuth>
} />

<Route path="/admin" element={
  <RequireAuth>
    <RequireOrg>
      <RequireAdmin>
        <AdminDashboard />
      </RequireAdmin>
    </RequireOrg>
  </RequireAuth>
} />

<Route
  path="/super/orgs"
  element={
    <RequireAuth>
      <SuperAdminOrgs />
    </RequireAuth>
  }
/>


      </Routes>
    </>
  )
}
