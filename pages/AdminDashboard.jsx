import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const { user, signOut } = useAuth();

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Painel do Administrador</h1>
      <p>Bem-vindo, {user?.email}</p>
      <button
        onClick={signOut}
        className="mt-4 p-2 text-white bg-red-500 rounded hover:bg-red-600"
      >
        Sair
      </button>
    </div>
  );
}
