import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <p className="p-8 text-center text-slate-500">Carregando…</p>
  return user ? <Outlet /> : <Navigate to="/entrar" replace />
}
