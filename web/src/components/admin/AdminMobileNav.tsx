import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AdminNavIcon, type AdminNavId } from './adminNav'

type SideItem = {
  id: AdminNavId
  labelKey: string
  icon: 'list' | 'calendar' | 'car' | 'user'
}

/** Side tabs + elevated center FAB (matches native tab-bar pattern). */
const SIDE_LEFT: SideItem[] = [
  { id: 'reservas', labelKey: 'admin.navReservas', icon: 'list' },
  { id: 'agenda', labelKey: 'admin.navAgenda', icon: 'calendar' },
]

const SIDE_RIGHT: SideItem[] = [
  { id: 'frota', labelKey: 'admin.navFrota', icon: 'car' },
  { id: 'perfil', labelKey: 'admin.navPerfil', icon: 'user' },
]

const CENTER_ID: AdminNavId = 'frete'

export function AdminMobileNav() {
  const { t } = useTranslation()
  const location = useLocation()
  const innerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const [indicator, setIndicator] = useState({ x: 0, w: 0, ready: false })

  const activeId = (() => {
    const match = location.pathname.match(/^\/admin\/([^/]+)/)
    return match?.[1] ?? 'reservas'
  })()

  const measure = useCallback(() => {
    const el = itemRefs.current[activeId]
    const parent = innerRef.current
    if (!el || !parent) return
    const parentBox = parent.getBoundingClientRect()
    const box = el.getBoundingClientRect()
    setIndicator({
      x: box.left - parentBox.left,
      w: box.width,
      ready: true,
    })
  }, [activeId])

  useLayoutEffect(() => {
    measure()
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [measure, location.pathname])

  function setItemRef(id: string) {
    return (node: HTMLAnchorElement | null) => {
      itemRefs.current[id] = node
    }
  }

  return (
    <nav className="admin-tabbar" aria-label={t('admin.title')}>
      <div className="admin-tabbar__inner" ref={innerRef}>
        <span
          className={`admin-tabbar__indicator${indicator.ready ? ' is-ready' : ''}`}
          style={{
            transform: `translate3d(${indicator.x}px, 0, 0)`,
            width: `${indicator.w}px`,
          }}
          aria-hidden="true"
        />

        {SIDE_LEFT.map((item) => (
          <NavLink
            key={item.id}
            ref={setItemRef(item.id)}
            to={`/admin/${item.id}`}
            className={({ isActive }) =>
              `admin-tabbar__item${isActive ? ' is-active' : ''}`
            }
            end
          >
            <span className="admin-tabbar__icon">
              <AdminNavIcon name={item.icon} />
            </span>
            <span className="admin-tabbar__label">{t(item.labelKey)}</span>
          </NavLink>
        ))}

        <NavLink
          ref={setItemRef(CENTER_ID)}
          to={`/admin/${CENTER_ID}`}
          className={({ isActive }) =>
            `admin-tabbar__fab${isActive ? ' is-active' : ''}`
          }
          aria-label={t('admin.navFrete')}
          end
        >
          <span className="admin-tabbar__fab-disc">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span className="admin-tabbar__label">{t('admin.navFrete')}</span>
        </NavLink>

        {SIDE_RIGHT.map((item) => (
          <NavLink
            key={item.id}
            ref={setItemRef(item.id)}
            to={`/admin/${item.id}`}
            className={({ isActive }) =>
              `admin-tabbar__item${isActive ? ' is-active' : ''}`
            }
            end
          >
            <span className="admin-tabbar__icon">
              <AdminNavIcon name={item.icon} />
            </span>
            <span className="admin-tabbar__label">{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
