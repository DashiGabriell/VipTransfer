import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import {
  endImpersonation,
  getActiveImpersonation,
  type ActiveImpersonation,
} from '../services/platform'

type ImpersonationContextValue = {
  active: ActiveImpersonation | null
  loading: boolean
  refresh: () => Promise<void>
  stop: () => Promise<void>
}

const ImpersonationContext = createContext<ImpersonationContextValue | null>(
  null,
)

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [active, setActive] = useState<ActiveImpersonation | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setActive(null)
      setLoading(false)
      return
    }
    try {
      const session = await getActiveImpersonation()
      setActive(session)
    } catch {
      setActive(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    void refresh()
  }, [authLoading, refresh])

  const stop = useCallback(async () => {
    await endImpersonation(active?.session.id)
    setActive(null)
  }, [active?.session.id])

  const value = useMemo(
    () => ({ active, loading, refresh, stop }),
    [active, loading, refresh, stop],
  )

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  )
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext)
  if (!ctx) {
    throw new Error('useImpersonation must be used within ImpersonationProvider')
  }
  return ctx
}
