import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { ImpersonationBanner } from '../../components/dashitecnology/ImpersonationBanner'
import { PlatformSidebar } from '../../components/dashitecnology/PlatformSidebar'
import { LanguageToggle } from '../../components/LanguageToggle'
import {
  getMyPlatformRole,
} from '../../services/platform'
import type { PlatformRole } from '../../types/database'

const SIDEBAR_KEY = 'jmd.platform.sidebarCollapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

export function PlatformPage() {
  const { t } = useTranslation()
  const { user, loading, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [role, setRole] = useState<PlatformRole | null>(null)
  const [gate, setGate] = useState<'loading' | 'ok' | 'denied'>('loading')
  const [collapsed, setCollapsed] = useState(readCollapsed)

  useEffect(() => {
    if (loading) return
    if (!user) {
      setGate('loading')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const r = await getMyPlatformRole()
        if (cancelled) return
        setRole(r)
        setGate(r ? 'ok' : 'denied')
      } catch {
        if (!cancelled) setGate('denied')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loading, user])

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  if (loading || (user && gate === 'loading')) {
    return (
      <div className="admin-shell flex min-h-svh items-center justify-center text-sm">
        {t('platform.loading')}
      </div>
    )
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(next || '/dashitecnology')}`}
        replace
      />
    )
  }

  if (gate === 'denied') {
    return <Navigate to="/admin/reservas" replace />
  }

  const layoutClass = [
    'admin-layout',
    'platform-layout',
    collapsed ? 'is-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={layoutClass}>
      <PlatformSidebar
        collapsed={collapsed}
        email={user.email}
        role={role}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        onSignOut={() => {
          void signOut().then(() => navigate('/login', { replace: true }))
        }}
      />
      <div className="admin-main">
        <ImpersonationBanner />
        <header className="admin-topbar">
          <div className="admin-topbar__left">
            <div>
              <h1>{t('platform.title')}</h1>
              <p>dashitecnology · {role}</p>
            </div>
          </div>
          <div className="admin-topbar__actions">
            <LanguageToggle variant="admin" />
          </div>
        </header>
        <main className="admin-content platform-content">
          <Outlet context={{ role }} />
        </main>
      </div>
    </div>
  )
}

export type PlatformOutletContext = {
  role: PlatformRole | null
}
