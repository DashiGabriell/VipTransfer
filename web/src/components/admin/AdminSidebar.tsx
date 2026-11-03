import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export type AdminNavId =
  | 'reservas'
  | 'agenda'
  | 'frota'
  | 'frete'
  | 'perfil'

type NavItem = {
  id: AdminNavId
  labelKey: string
  icon: 'list' | 'calendar' | 'car' | 'tag' | 'user'
}

const NAV: NavItem[] = [
  { id: 'reservas', labelKey: 'admin.navReservas', icon: 'list' },
  { id: 'agenda', labelKey: 'admin.navAgenda', icon: 'calendar' },
  { id: 'frota', labelKey: 'admin.navFrota', icon: 'car' },
  { id: 'frete', labelKey: 'admin.navFrete', icon: 'tag' },
  { id: 'perfil', labelKey: 'admin.navPerfil', icon: 'user' },
]

type Props = {
  collapsed: boolean
  mobileOpen: boolean
  active: AdminNavId
  brand: string
  email?: string | null
  role?: string | null
  onNavigate: (id: AdminNavId) => void
  onToggleCollapsed: () => void
  onCloseMobile: () => void
  onSignOut: () => void
}

function NavIcon({ name }: { name: NavItem['icon'] }) {
  if (name === 'list') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    )
  }
  if (name === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="1" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    )
  }
  if (name === 'car') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 13h18l-1.5-4.5A2 2 0 0 0 17.6 7H6.4a2 2 0 0 0-1.9 1.5L3 13Z" />
        <path d="M5 17h2M17 17h2M5 13v4M19 13v4" />
      </svg>
    )
  }
  if (name === 'user') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 19c1.8-3.2 4-4.5 7-4.5s5.2 1.3 7 4.5" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

export function AdminSidebar({
  collapsed,
  mobileOpen,
  active,
  brand,
  email,
  role,
  onNavigate,
  onToggleCollapsed,
  onCloseMobile,
  onSignOut,
}: Props) {
  const { t } = useTranslation()

  return (
    <aside
      className="admin-sidebar"
      aria-label={t('admin.title')}
      data-collapsed={collapsed ? 'true' : 'false'}
      data-mobile-open={mobileOpen ? 'true' : 'false'}
    >
      <div className="admin-sidebar__brand">
        <div className="admin-sidebar__mark" aria-hidden="true">
          JMD
        </div>
        <div className="admin-sidebar__titles">
          <strong>{brand}</strong>
          <span>{t('admin.panel')}</span>
        </div>
      </div>

      <nav className="admin-sidebar__nav">
        {NAV.map((item) => {
          const label = t(item.labelKey)
          return (
            <button
              key={item.id}
              type="button"
              className={`admin-sidebar__item${active === item.id ? ' is-active' : ''}`}
              onClick={() => {
                onNavigate(item.id)
                onCloseMobile()
              }}
              title={collapsed ? label : undefined}
              aria-current={active === item.id ? 'page' : undefined}
            >
              <span className="admin-sidebar__icon">
                <NavIcon name={item.icon} />
              </span>
              <span className="admin-sidebar__label">{label}</span>
            </button>
          )
        })}
      </nav>

      <div className="admin-sidebar__foot">
        <div className="admin-sidebar__meta" title={email ?? undefined}>
          {email ?? '—'}
          {role ? ` · ${role}` : ''}
        </div>

        <button
          type="button"
          className="admin-sidebar__toggle"
          onClick={onToggleCollapsed}
          aria-pressed={collapsed}
          title={collapsed ? t('admin.expand') : t('admin.collapse')}
        >
          <span className="admin-sidebar__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              {collapsed ? (
                <path d="M9 6l6 6-6 6" />
              ) : (
                <path d="M15 6l-6 6 6 6" />
              )}
            </svg>
          </span>
          <span>{collapsed ? t('admin.expand') : t('admin.collapse')}</span>
        </button>

        <Link
          to="/"
          className="admin-sidebar__link"
          onClick={onCloseMobile}
          title={t('admin.site')}
        >
          <span className="admin-sidebar__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 12h16M10 6l-6 6 6 6" />
            </svg>
          </span>
          <span>{t('admin.site')}</span>
        </Link>

        <button
          type="button"
          className="admin-sidebar__signout"
          onClick={onSignOut}
          title={t('admin.signOut')}
        >
          <span className="admin-sidebar__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M10 17l5-5-5-5M15 12H3M21 4v16" />
            </svg>
          </span>
          <span>{t('admin.signOut')}</span>
        </button>
      </div>
    </aside>
  )
}
