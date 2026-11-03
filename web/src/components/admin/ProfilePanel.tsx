import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import type { AppLang } from '../../lib/lang'
import { writeStoredLang } from '../../lib/lang'
import { getMyProfile, updateMyProfile } from '../../services/admin'

type Props = {
  onError: (msg: string) => void
}

export function ProfilePanel({ onError }: Props) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [fullName, setFullName] = useState('')
  const [locale, setLocale] = useState<AppLang>(
    i18n.language.startsWith('en') ? 'en' : 'pt-BR',
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const profile = await getMyProfile()
        if (cancelled) return
        setFullName(profile?.full_name ?? user?.email ?? '')
        const pref =
          profile?.preferred_locale === 'en' || profile?.preferred_locale === 'pt-BR'
            ? profile.preferred_locale
            : i18n.language.startsWith('en')
              ? 'en'
              : 'pt-BR'
        setLocale(pref)
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

  if (loading) {
    return <p className="text-sm text-text-secondary-light">{t('agenda.loading')}</p>
  }

  return (
    <form
      onSubmit={onSave}
      className="admin-panel-enter max-w-lg space-y-4 rounded-2xl border border-border-light bg-surface-light p-5"
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
          className="mt-1 w-full rounded-lg border border-border-light px-3 py-2 bg-background-light"
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
          <option value="pt-BR">🇧🇷 Português (Brasil)</option>
          <option value="en">🇺🇸 English</option>
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
  )
}
