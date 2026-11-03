import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import type { AppLang } from '../../lib/lang'
import { writeStoredLang } from '../../lib/lang'
import {
  getMyNotificationPreferences,
  getMyProfile,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateMyNotificationPreferences,
  updateMyProfile,
  type NotificationPreferences,
  type StaffNotification,
} from '../../services/admin'
import { DevicePermissionsCard } from './DevicePermissionsCard'

type Props = {
  onError: (msg: string) => void
}

type PrefKey = keyof Omit<NotificationPreferences, 'user_id' | 'updated_at'>

const CHANNEL_KEYS: PrefKey[] = [
  'email_enabled',
  'in_app_enabled',
  'whatsapp_enabled',
]

const EVENT_KEYS: PrefKey[] = [
  'event_reservation_hold',
  'event_reservation_confirmed',
  'event_reservation_cancelled',
  'event_hold_expired',
]

export function ProfilePanel({ onError }: Props) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [fullName, setFullName] = useState('')
  const [locale, setLocale] = useState<AppLang>(
    i18n.language.startsWith('en') ? 'en' : 'pt-BR',
  )
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [notifications, setNotifications] = useState<StaffNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [ok, setOk] = useState<string | null>(null)
  const [prefsOk, setPrefsOk] = useState<string | null>(null)

  const refreshNotifications = useCallback(async () => {
    const rows = await listMyNotifications()
    setNotifications(rows)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [profile, notificationPrefs, inbox] = await Promise.all([
          getMyProfile(),
          getMyNotificationPreferences(),
          listMyNotifications(),
        ])
        if (cancelled) return
        setFullName(profile?.full_name ?? user?.email ?? '')
        const pref =
          profile?.preferred_locale === 'en' ||
          profile?.preferred_locale === 'pt-BR'
            ? profile.preferred_locale
            : i18n.language.startsWith('en')
              ? 'en'
              : 'pt-BR'
        setLocale(pref)
        setPrefs(notificationPrefs)
        setNotifications(inbox)
      } catch (err) {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : 'Profile load failed')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [i18n.language, onError, user?.email])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setOk(null)
    try {
      await updateMyProfile({ full_name: fullName, preferred_locale: locale })
      await i18n.changeLanguage(locale)
      writeStoredLang(locale)
      setOk(t('admin.profileSaved'))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Profile save failed')
    } finally {
      setSaving(false)
    }
  }

  async function togglePref(key: PrefKey) {
    if (!prefs) return
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSavingPrefs(true)
    setPrefsOk(null)
    try {
      const saved = await updateMyNotificationPreferences({
        email_enabled: next.email_enabled,
        in_app_enabled: next.in_app_enabled,
        whatsapp_enabled: next.whatsapp_enabled,
        event_reservation_hold: next.event_reservation_hold,
        event_reservation_confirmed: next.event_reservation_confirmed,
        event_reservation_cancelled: next.event_reservation_cancelled,
        event_hold_expired: next.event_hold_expired,
      })
      setPrefs(saved)
      setPrefsOk(t('admin.notifPrefsSaved'))
    } catch (err) {
      setPrefs(prefs)
      onError(err instanceof Error ? err.message : 'Notification prefs failed')
    } finally {
      setSavingPrefs(false)
    }
  }

  async function onMarkRead(id: string) {
    try {
      await markNotificationRead(id)
      await refreshNotifications()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Mark read failed')
    }
  }

  async function onMarkAll() {
    try {
      await markAllNotificationsRead()
      await refreshNotifications()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Mark all failed')
    }
  }

  function prefLabel(key: PrefKey): string {
    return t(`admin.notif.${key}`)
  }

  function eventLabel(type: StaffNotification['event_type']): string {
    return t(`admin.notif.event.${type}`)
  }

  if (loading) {
    return (
      <p className="text-sm text-text-secondary-light">{t('agenda.loading')}</p>
    )
  }

  const unread = notifications.filter((n) => !n.read_at).length
  const localeFmt = i18n.language.startsWith('en') ? 'en-US' : 'pt-BR'

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={onSave}
        className="admin-panel-enter space-y-4 rounded-2xl border border-border-light bg-surface-light p-5"
      >
        <div>
          <h2 className="font-semibold text-primary">{t('admin.profileTitle')}</h2>
          <p className="mt-1 text-sm text-text-secondary-light">
            {t('admin.profileLead')}
          </p>
        </div>

        <label className="block text-sm">
          {t('admin.emailReadonly')}
          <input
            className="mt-1 w-full rounded-lg border border-border-light bg-background-light px-3 py-2"
            value={user?.email ?? ''}
            readOnly
          />
        </label>

        <label className="block text-sm">
          {t('admin.fullName')}
          <input
            className="mt-1 w-full rounded-lg border border-border-light px-3 py-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </label>

        <label className="block text-sm">
          {t('admin.preferredLocale')}
          <select
            className="mt-1 w-full rounded-lg border border-border-light px-3 py-2"
            value={locale}
            onChange={(e) => setLocale(e.target.value as AppLang)}
          >
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en">English</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-text-primary-dark disabled:opacity-60"
        >
          {saving ? '…' : t('admin.saveProfile')}
        </button>

        {ok && <p className="text-sm text-emerald-700">{ok}</p>}
      </form>

      <section className="admin-panel-enter space-y-4 rounded-2xl border border-border-light bg-surface-light p-5">
        <div>
          <h2 className="font-semibold text-primary">
            {t('admin.notif.title')}
          </h2>
          <p className="mt-1 text-sm text-text-secondary-light">
            {t('admin.notif.lead')}
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-secondary-light uppercase">
            {t('admin.notif.channels')}
          </h3>
          <ul className="space-y-2">
            {CHANNEL_KEYS.map((key) => (
              <li key={key}>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border-light px-3 py-2 text-sm">
                  <span>{prefLabel(key)}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--bronze,#b08d57)]"
                    checked={Boolean(prefs?.[key])}
                    disabled={savingPrefs || !prefs}
                    onChange={() => void togglePref(key)}
                  />
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-secondary-light uppercase">
            {t('admin.notif.events')}
          </h3>
          <ul className="space-y-2">
            {EVENT_KEYS.map((key) => (
              <li key={key}>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border-light px-3 py-2 text-sm">
                  <span>{prefLabel(key)}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--bronze,#b08d57)]"
                    checked={Boolean(prefs?.[key])}
                    disabled={savingPrefs || !prefs}
                    onChange={() => void togglePref(key)}
                  />
                </label>
              </li>
            ))}
          </ul>
        </div>

        {prefsOk && <p className="text-sm text-emerald-700">{prefsOk}</p>}
      </section>

      <DevicePermissionsCard onError={onError} />

      <section className="admin-panel-enter space-y-4 rounded-2xl border border-border-light bg-surface-light p-5 lg:col-span-2">
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
              onClick={() => void refreshNotifications()}
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
    </div>
  )
}
