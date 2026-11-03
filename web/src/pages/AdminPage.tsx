import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AdminDashboard } from './admin/AdminDashboard'

export function AdminPage() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="admin-shell flex min-h-svh items-center justify-center text-sm">
        Carregando sessão…
      </div>
    )
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(next || '/admin')}`}
        replace
      />
    )
  }

  return (
    <div className="admin-shell">
      <AdminDashboard />
    </div>
  )
}
