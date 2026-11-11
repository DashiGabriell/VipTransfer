import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { countMyUnreadNotifications } from '../services/admin'

/**
 * Unread staff notification count with Supabase Realtime updates.
 */
export function useStaffNotificationBadge() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(Boolean(userId))

  const refresh = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      setUnreadCount(0)
      setLoading(false)
      return
    }
    try {
      const count = await countMyUnreadNotifications()
      setUnreadCount(count)
    } catch {
      /* keep last known count */
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const client = supabase
    if (!userId || !client) return

    const channel = client
      .channel(`staff-notifications-badge:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh()
        },
      )
      .subscribe()

    return () => {
      void client.removeChannel(channel)
    }
  }, [userId, refresh])

  return { unreadCount, loading, refresh }
}
