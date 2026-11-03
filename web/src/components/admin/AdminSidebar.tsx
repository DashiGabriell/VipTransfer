import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ADMIN_NAV,
  AdminNavIcon,
  type AdminNavId,
  ADMIN_NAV_IDS,
  isAdminNavId,
} from './adminNav'

export type { AdminNavId }
export { ADMIN_NAV_IDS, isAdminNavId }

type Props = {
  collapsed: boolean
  brand: string
  email?: string | null
  role?: string | null
  onToggleCollapsed: () => void
  onSignOut: () => void
}

export function AdminSidebar({
  collapsed,
  brand,
  email,
  role,
  onToggleCollapsed,
  onSignOut,
}: Props) {
  const { t } = useTranslation()

  return (
    <aside
      className="admin-sidebar"
      aria-label={t('admin.title')}
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div className="admin-sidebar__brand">
        <div className="admin-sidebar__mark" aria-hidden="true">
          <img
            className="admin-sidebar__logo"
            src="/logo-1.png"
            alt=""
            width={40}
            height={40}
          />
        </div>
        <div className="admin-sidebar__titles">
          <strong>{brand}</strong>
          <span>{t('admin.panel')}</span>
        </div>
      </div>

      <nav className="admin-sidebar__nav">
        {ADMIN_NAV.map((item) => {
          const label = t(item.labelKey)
          return (
            <NavLink
              key={item.id}
              to={`/admin/${item.id}`}
              className={({ isActive }) =>
                `admin-sidebar__item${isActive ? ' is-active' : ''}`
              }
              title={collapsed ? label : undefined}
              end
            >
              <span className="admin-sidebar__icon">
                <AdminNavIcon name={item.icon} />
              </span>
              <span className="admin-sidebar__label">{label}</span>
            </NavLink>
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

        <NavLink to="/" className="admin-sidebar__link" title={t('admin.site')}>
          <span className="admin-sidebar__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 12h16M10 6l-6 6 6 6" />
            </svg>
          </span>
          <span>{t('admin.site')}</span>
        </NavLink>

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
