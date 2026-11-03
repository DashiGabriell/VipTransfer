import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { resolveTenantSlug } from '../lib/tenant'

export type TenantInfo = {
  slug: string
  name: string
  whatsapp: string
  contactEmail: string
}

const TenantContext = createContext<TenantInfo | null>(null)

const FALLBACK_BY_SLUG: Record<string, TenantInfo> = {
  jmd: {
    slug: 'jmd',
    name: 'JMD Transfer',
    whatsapp: '5511999999999',
    contactEmail: 'contato@jmdtransfer.com.br',
  },
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => {
    const slug = resolveTenantSlug()
    return (
      FALLBACK_BY_SLUG[slug] ?? {
        slug,
        name: slug.toUpperCase(),
        whatsapp: '',
        contactEmail: '',
      }
    )
  }, [])

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  )
}

export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) {
    throw new Error('useTenant must be used within TenantProvider')
  }
  return ctx
}
