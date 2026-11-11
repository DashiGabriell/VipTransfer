import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type StaffNotification,
} from '../../services/admin'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

type Props = {
  onError: (msg: string) => void
  /** Compact layout when embedded inside profile. */
  compact?: boolean
}

export function NotificationsInbox({ onError, compact = false }: Props) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<StaffNotification[]>([])
  const [loading, setLoading] = useState(true)
  const localeFmt = i18n.language.startsWith('en') ? 'en-US' : 'pt-BR'

  const refresh = useCallback(async () => {
    const rows = await listMyNotifications(80)
    setNotifications(rows)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        await refresh()
      } catch (err) {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : t('admin.notif.loadError'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [onError, refresh, t])

  useEffect(() => {
    const userId = user?.id
    const client = supabase
    if (!userId || !client || !isSupabaseConfigured) return

    const channel = client
      .channel(`staff-notifications-inbox:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh().catch(() => undefined)
        },
      )
      .subscribe()

    return () => {
      void client.removeChannel(channel)
    }
  }, [user?.id, refresh])

  async function onMarkRead(id: string) {
    try {
      await markNotificationRead(id)
      await refresh()
    } catch (err) {
      onError(err instanceof Error ? err.message : t('admin.notif.markReadError'))
    }
  }

  async function onMarkAll() {
    try {
      await markAllNotificationsRead()
      await refresh()
    } catch (err) {
      onError(err instanceof Error ? err.message : t('admin.notif.markAllError'))
    }
  }

  function eventLabel(type: StaffNotification['event_type']): string {
    return t(`admin.notif.event.${type}`)
  }

  const unread = notifications.filter((n) => !n.read_at).length

  if (loading) {
    return (
      <p className="text-sm text-text-secondary-light">{t('agenda.loading')}</p>
    )
  }

  return (
    <section
      className={`admin-panel-enter space-y-4 rounded-2xl border border-border-light bg-surface-light p-5${
        compact ? '' : ' lg:col-span-2'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-primary">
            {t('admin.notif.inboxTitle')}
          </h2>
          <p className="mt-1 text-sm text-text-secondary-light">
            {t('admin.notif.inboxLead', { count: unread })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-border-light px-3 py-1.5 text-xs uppercase tracking-wide"
            onClick={() => void refresh()}
          >
            {t('admin.refresh')}
          </button>
          <button
            type="button"
            className="rounded border border-border-light px-3 py-1.5 text-xs uppercase tracking-wide disabled:opacity-50"
            disabled={unread === 0}
            onClick={() => void onMarkAll()}
          >
            {t('admin.notif.markAllRead')}
          </button>
        </div>
      </div>

      <ul className="divide-y divide-border-light/70">
        {notifications.map((item) => (
          <li
            key={item.id}
            className={`flex flex-wrap items-start justify-between gap-3 py-3 ${
              item.read_at ? 'opacity-70' : ''
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {!item.read_at && (
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-[var(--bronze,#b08d57)]"
                    aria-hidden="true"
                  />
                )}
                <strong className="text-sm text-primary">{item.title}</strong>
                <span className="rounded bg-background-light px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-secondary-light">
                  {eventLabel(item.event_type)}
                </span>
              </div>
              {item.body && (
                <p className="mt-1 text-sm text-text-secondary-light">
                  {item.body}
                </p>
              )}
              <p className="mt-1 text-[11px] text-text-secondary-light">
                {new Date(item.created_at).toLocaleString(localeFmt)}
              </p>
            </div>
            {!item.read_at && (
              <button
                type="button"
                className="rounded border border-border-light px-2 py-1 text-xs"
                onClick={() => void onMarkRead(item.id)}
              >
                {t('admin.notif.markRead')}
              </button>
            )}
          </li>
        ))}
        {!notifications.length && (
          <li className="py-6 text-sm text-text-secondary-light">
            {t('admin.notif.empty')}
          </li>
        )}
      </ul>
    </section>
  )
}
