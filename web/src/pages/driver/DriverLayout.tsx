import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageToggle } from '../../components/LanguageToggle'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import {
  getDriverJobDetail,
  getMyDriverProfile,
  listMyDriverAssignments,
} from '../../services/coreV2'
import type {
  Driver,
  DriverJobDetail,
  JobAssignment,
} from '../../types/database'
import {
  DriverAppContext,
  IconBriefcase,
  IconCheck,
  IconMore,
  IconUser,
} from './driverShared'

export function DriverLayout() {
  const { t, i18n } = useTranslation()
  const { user, loading: authLoading, signOut } = useAuth()
  const tenant = useTenant()
  const location = useLocation()
  const locale = i18n.language.startsWith('en') ? 'en-US' : 'pt-BR'

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const loadErrorRef = useRef(t('driver.loadError'))
  loadErrorRef.current = t('driver.loadError')

  const [driver, setDriver] = useState<Driver | null>(null)
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [details, setDetails] = useState<Record<string, DriverJobDetail>>({})
  const [bootstrapping, setBootstrapping] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestSeq = useRef(0)

  const orgId = tenant.organizationId
  const userId = user?.id ?? null

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!orgId || !userId) return
      const silent = opts?.silent === true
      const seq = ++requestSeq.current

      if (silent) setRefreshing(true)
      else setBootstrapping(true)
      setError(null)

      try {
        const me = await getMyDriverProfile(orgId)
        if (seq !== requestSeq.current) return
        setDriver(me)
        if (!me) {
          setAssignments([])
          setDetails({})
          return
        }
        const rows = await listMyDriverAssignments(orgId)
        if (seq !== requestSeq.current) return
        setAssignments(rows)
        const map: Record<string, DriverJobDetail> = {}
        await Promise.all(
          rows.map(async (row) => {
            try {
              map[row.id] = await getDriverJobDetail(row.id)
            } catch {
              /* skip detail errors per row */
            }
          }),
        )
        if (seq !== requestSeq.current) return
        setDetails(map)
      } catch (err) {
        if (seq !== requestSeq.current) return
        setError(
          err instanceof Error ? err.message : loadErrorRef.current,
        )
      } finally {
        if (seq !== requestSeq.current) return
        setBootstrapping(false)
        setRefreshing(false)
      }
    },
    [orgId, userId],
  )

  useEffect(() => {
    if (!orgId || !userId) {
      setBootstrapping(false)
      return
    }
    void refresh({ silent: false })
  }, [orgId, userId, refresh])

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const offeredCount = useMemo(
    () => assignments.filter((a) => a.status === 'oferecido').length,
    [assignments],
  )

  const silentRefresh = useCallback(
    () => refresh({ silent: true }),
    [refresh],
  )

  const ctx = useMemo(
    () => ({
      driver,
      assignments,
      details,
      loading: bootstrapping,
      refreshing,
      error,
      setError,
      offeredCount,
      refresh: silentRefresh,
      locale,
    }),
    [
      driver,
      assignments,
      details,
      bootstrapping,
      refreshing,
      error,
      offeredCount,
      silentRefresh,
      locale,
    ],
  )

  if (authLoading) {
    return (
      <div className="driver-app">
        <div className="driver-app__loading">{t('auth.loading')}</div>
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname || '/motorista')}`}
        replace
      />
    )
  }

  return (
    <DriverAppContext.Provider value={ctx}>
      <div className="driver-app">
        <header className="driver-app__top">
          <Link to="/motorista/ofertas" className="driver-app__brand">
            <img src="/logo-1.png" alt="" width={32} height={32} />
            <div className="driver-app__brand-copy">
              <p className="driver-app__brand-name">JMD</p>
              <p className="driver-app__brand-sub">{t('driver.appBadge')}</p>
            </div>
          </Link>

          <div className="driver-app__top-actions" ref={menuRef}>
            <button
              type="button"
              className="driver-app__icon-btn"
              aria-expanded={menuOpen}
              aria-label={t('driver.menu')}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <IconMore />
            </button>
            {menuOpen ? (
              <div className="driver-app__menu" role="menu">
                <div className="driver-app__lang">
                  <LanguageToggle variant="admin" />
                </div>
                <Link
                  to="/"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                >
                  {t('admin.site')}
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    void signOut()
                  }}
                >
                  {t('admin.signOut')}
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main className="driver-app__main">
          <Outlet />
        </main>

        <nav className="driver-app__nav" aria-label={t('driver.navLabel')}>
          <NavLink
            to="/motorista/ofertas"
            className={({ isActive }) =>
              `driver-app__nav-btn${isActive ? ' is-active' : ''}`
            }
          >
            <span
              className={offeredCount ? 'driver-app__nav-badge' : undefined}
              data-count={offeredCount || undefined}
            >
              <IconBriefcase />
            </span>
            {t('driver.navOffers')}
          </NavLink>
          <NavLink
            to="/motorista/aceitas"
            className={({ isActive }) =>
              `driver-app__nav-btn${isActive ? ' is-active' : ''}`
            }
          >
            <IconCheck />
            {t('driver.navAccepted')}
          </NavLink>
          <NavLink
            to="/motorista/perfil"
            className={({ isActive }) =>
              `driver-app__nav-btn${isActive ? ' is-active' : ''}`
            }
          >
            <IconUser />
            {t('driver.navProfile')}
          </NavLink>
        </nav>
      </div>
    </DriverAppContext.Provider>
  )
}
