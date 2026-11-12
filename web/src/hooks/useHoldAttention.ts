import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { listReservations } from '../services/admin'

export type HoldToastInfo = {
  title: string
  body: string | null
  reservationId: string | null
  customerName: string | null
}

type Options = {
  organizationId: string | null
  enabled?: boolean
  /** When true, skip toast (e.g. admin just created the hold). */
  suppressToast?: boolean
  onHoldAppeared?: () => void
}

/**
 * Hold count for the "Em espera" chip + discreet toast when a new hold notification arrives.
 */
export function useHoldAttention({
  organizationId,
  enabled = true,
  suppressToast = false,
  onHoldAppeared,
}: Options) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [holdCount, setHoldCount] = useState(0)
  const [toast, setToast] = useState<HoldToastInfo | null>(null)
  const suppressRef = useRef(suppressToast)
  const onHoldAppearedRef = useRef(onHoldAppeared)

  useEffect(() => {
    suppressRef.current = suppressToast
  }, [suppressToast])

  useEffect(() => {
    onHoldAppearedRef.current = onHoldAppeared
  }, [onHoldAppeared])

  const refreshHoldCount = useCallback(async () => {
    if (!organizationId || !enabled) {
      setHoldCount(0)
      return 0
    }
    try {
      const rows = await listReservations(organizationId, 'hold')
      setHoldCount(rows.length)
      return rows.length
    } catch {
      return 0
    }
  }, [organizationId, enabled])

  useEffect(() => {
    if (!enabled || !organizationId) {
      setHoldCount(0)
      return
    }
    void refreshHoldCount()
    const timer = window.setInterval(() => {
      void refreshHoldCount()
    }, 25_000)
    return () => window.clearInterval(timer)
  }, [enabled, organizationId, refreshHoldCount])

  useEffect(() => {
    const client = supabase
    if (!enabled || !userId || !client || !isSupabaseConfigured) return

    const channel = client
      .channel(`admin-hold-attention:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as {
            event_type?: string
            title?: string
            body?: string | null
            payload?: Record<string, unknown>
          }
          if (row.event_type !== 'reservation_hold') return

          void refreshHoldCount()
          onHoldAppearedRef.current?.()

          if (suppressRef.current) return

          const data = row.payload ?? {}
          const reservationId =
            typeof data.reservation_id === 'string' ? data.reservation_id : null
          const customerName =
            typeof data.customer_name === 'string' ? data.customer_name : null

          setToast({
            title: row.title || 'Nova reserva em espera',
            body: row.body ?? null,
            reservationId,
            customerName,
          })
        },
      )
      .subscribe()

    return () => {
      void client.removeChannel(channel)
    }
  }, [enabled, userId, refreshHoldCount])

  const dismissToast = useCallback(() => setToast(null), [])

  return {
    holdCount,
    toast,
    dismissToast,
    refreshHoldCount,
  }
}
