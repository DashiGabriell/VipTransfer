import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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
        to={`/login?next=${encodeURIComponent(next || '/admin/reservas')}`}
        replace
      />
    )
  }

  return (
    <div className="admin-shell">
      <Outlet />
    </div>
  )
}
