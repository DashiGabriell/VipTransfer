import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTenant } from '../context/TenantContext'
import { canOperate, listMyMemberships } from '../services/admin'
import {
  ensureDriverProfileForSignup,
  getMyDriverProfile,
} from '../services/coreV2'
import { getMyPlatformRole } from '../services/platform'

export function AdminPage() {
  const { user, loading } = useAuth()
  const tenant = useTenant()
  const location = useLocation()
  const [gate, setGate] = useState<'loading' | 'admin' | 'driver'>('loading')

  useEffect(() => {
    if (loading) return
    if (!user) {
      setGate('loading')
      return
    }

    let cancelled = false
    void (async () => {
      const orgId = tenant.organizationId
      if (!orgId) {
        if (!cancelled) setGate('admin')
        return
      }
      try {
        const platformRole = await getMyPlatformRole()
        if (platformRole) {
          if (!cancelled) setGate('admin')
          return
        }
        const memberships = await listMyMemberships()
        const membership = memberships.find((m) => m.organization_id === orgId)
        if (membership && canOperate(membership.role)) {
          if (!cancelled) setGate('admin')
          return
        }
        // Contas novas pela login viram motorista — nunca owner.
        const ensured = await ensureDriverProfileForSignup(orgId)
        if (ensured) {
          if (!cancelled) setGate('driver')
          return
        }
        const driver = await getMyDriverProfile(orgId)
        if (!cancelled) setGate(driver ? 'driver' : 'admin')
      } catch {
        if (!cancelled) setGate('admin')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loading, user, tenant.organizationId])

  if (loading || (user && gate === 'loading')) {
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

  if (gate === 'driver') {
    return <Navigate to="/motorista" replace />
  }

  return (
    <div className="admin-shell">
      <Outlet />
    </div>
  )
}
