import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { PlatformRole } from '../../types/database'

const NAV = [
  { id: '', labelKey: 'platform.navOverview', end: true },
  { id: 'orgs', labelKey: 'platform.navOrgs' },
  { id: 'users', labelKey: 'platform.navUsers' },
  { id: 'audit', labelKey: 'platform.navAudit' },
  { id: 'ops', labelKey: 'platform.navOps' },
  { id: 'settings', labelKey: 'platform.navSettings' },
] as const

type Props = {
  collapsed: boolean
  email?: string | null
  role?: PlatformRole | null
  onToggleCollapsed: () => void
  onSignOut: () => void
}

export function PlatformSidebar({
  collapsed,
  email,
  role,
  onToggleCollapsed,
  onSignOut,
}: Props) {
  const { t } = useTranslation()

  return (
    <aside
      className="admin-sidebar platform-sidebar"
      aria-label={t('platform.title')}
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div className="admin-sidebar__brand">
        <div className="admin-sidebar__mark" aria-hidden="true">
          <span className="platform-sidebar__mark-text">DT</span>
        </div>
        <div className="admin-sidebar__titles">
          <strong>Dashi Technology</strong>
          <span>{t('platform.panel')}</span>
        </div>
      </div>

      <div className="platform-sidebar__ribbon" aria-hidden="true">
        DASHITECHNOLOGY
      </div>

      <nav className="admin-sidebar__nav">
        {NAV.map((item) => {
          const label = t(item.labelKey)
          const to = item.id
            ? `/dashitecnology/${item.id}`
            : '/dashitecnology'
          return (
            <NavLink
              key={item.id || 'overview'}
              to={to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                `admin-sidebar__item${isActive ? ' is-active' : ''}`
              }
              title={collapsed ? label : undefined}
            >
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
        >
          <span className="admin-sidebar__label">
            {collapsed ? t('admin.expand') : t('admin.collapse')}
          </span>
        </button>

        <NavLink to="/admin/reservas" className="admin-sidebar__link">
          <span className="admin-sidebar__label">{t('platform.toAdmin')}</span>
        </NavLink>

        <button
          type="button"
          className="admin-sidebar__signout"
          onClick={onSignOut}
        >
          <span className="admin-sidebar__label">{t('admin.signOut')}</span>
        </button>
      </div>
    </aside>
  )
}
