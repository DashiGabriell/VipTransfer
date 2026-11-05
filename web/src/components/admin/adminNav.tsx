import type { ReactNode } from 'react'

export type AdminNavId =
  | 'reservas'
  | 'agenda'
  | 'frota'
  | 'frete'
  | 'clientes'
  | 'motoristas'
  | 'financeiro'
  | 'perfil'

export const ADMIN_NAV_IDS: AdminNavId[] = [
  'reservas',
  'agenda',
  'frota',
  'frete',
  'clientes',
  'motoristas',
  'financeiro',
  'perfil',
]

export function isAdminNavId(value: string | undefined): value is AdminNavId {
  return ADMIN_NAV_IDS.includes(value as AdminNavId)
}

export type AdminNavIconName =
  | 'list'
  | 'calendar'
  | 'car'
  | 'tag'
  | 'users'
  | 'wheel'
  | 'wallet'
  | 'user'

export type AdminNavItem = {
  id: AdminNavId
  labelKey: string
  icon: AdminNavIconName
}

export const ADMIN_NAV: AdminNavItem[] = [
  { id: 'reservas', labelKey: 'admin.navReservas', icon: 'list' },
  { id: 'agenda', labelKey: 'admin.navAgenda', icon: 'calendar' },
  { id: 'frota', labelKey: 'admin.navFrota', icon: 'car' },
  { id: 'frete', labelKey: 'admin.navFrete', icon: 'tag' },
  { id: 'clientes', labelKey: 'admin.navClientes', icon: 'users' },
  { id: 'motoristas', labelKey: 'admin.navMotoristas', icon: 'wheel' },
  { id: 'financeiro', labelKey: 'admin.navFinanceiro', icon: 'wallet' },
  { id: 'perfil', labelKey: 'admin.navPerfil', icon: 'user' },
]

export function AdminNavIcon({
  name,
}: {
  name: AdminNavIconName
}): ReactNode {
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
        <rect x="3" y="5" width="18" height="16" rx="2" />
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
  if (name === 'users') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 19c1.2-2.4 2.8-3.5 5-3.5s3.8 1.1 5 3.5" />
        <circle cx="17" cy="9" r="2.4" />
        <path d="M14 19c.7-1.6 1.8-2.4 3.2-2.4 1.5 0 2.6.8 3.3 2.4" />
      </svg>
    )
  }
  if (name === 'wheel') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="2.2" />
        <path d="M12 4v3.5M12 16.5V20M4 12h3.5M16.5 12H20" />
      </svg>
    )
  }
  if (name === 'wallet') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18M16 14.5h2" />
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
