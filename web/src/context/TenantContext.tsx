import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { resolveTenantSlug } from '../lib/tenant'
import {
  loadTenantCatalog,
  type TenantCatalog,
} from '../services/tenantCatalog'

export type TenantInfo = {
  slug: string
  name: string
  whatsapp: string
  contactEmail: string
  organizationId: string | null
  catalog: TenantCatalog | null
  loading: boolean
  error: string | null
}

const TenantContext = createContext<TenantInfo | null>(null)

function settingsString(
  settings: TenantCatalog['organization']['settings'],
  key: string,
  fallback = '',
): string {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return fallback
  }
  const value = (settings as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : fallback
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const slug = useMemo(() => resolveTenantSlug(), [])
  const [catalog, setCatalog] = useState<TenantCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)
      try {
        const data = await loadTenantCatalog(slug)
        if (!cancelled) {
          setCatalog(data)
          if (!data) {
            setError(`Organização "${slug}" não encontrada`)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setCatalog(null)
          setError(err instanceof Error ? err.message : 'Falha ao carregar tenant')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [slug])

  const value = useMemo<TenantInfo>(() => {
    if (catalog) {
      return {
        slug: catalog.organization.slug,
        name: catalog.organization.name,
        whatsapp: settingsString(catalog.organization.settings, 'whatsapp', ''),
        contactEmail: settingsString(
          catalog.organization.settings,
          'contactEmail',
          '',
        ),
        organizationId: catalog.organization.id,
        catalog,
        loading,
        error,
      }
    }

    return {
      slug,
      name: slug === 'jmd' ? 'JMD Transfer' : slug.toUpperCase(),
      whatsapp: '5511999999999',
      contactEmail: 'contato@jmdtransfer.com.br',
      organizationId: null,
      catalog: null,
      loading,
      error,
    }
  }, [catalog, error, loading, slug])

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
