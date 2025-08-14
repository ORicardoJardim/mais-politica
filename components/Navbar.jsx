import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
{user && <Link className="btn" to="/demandas">Demandas</Link>}
{user && <Link className="btn" to="/">Início</Link>}
{profile?.role === 'admin' && <Link className="btn" to="/admin">Admin</Link>}
{user && <Link className="btn" to="/demandas">Demandas</Link>}


export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const onLogout = async () => { await signOut(); navigate('/login') }

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="brand">Mais Política</Link>

        <nav className="flex items-center gap-2">
          {user && <Link className="btn" to="/">Início</Link>}
          {profile?.role === 'admin' && (
            <Link className="btn" to="/admin">Admin</Link>
          )}
          {user ? (
            <button className="btn" onClick={onLogout}>Sair</button>
          ) : (
            <Link className="btn" to="/login">Entrar</Link>
          )}
        </nav>
      </div>
    </header>
  )
}
