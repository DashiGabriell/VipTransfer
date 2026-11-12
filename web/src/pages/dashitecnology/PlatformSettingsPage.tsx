import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getPlatformSettings,
  setPlatformSettings,
  type PlatformFlags,
} from '../../services/platform'

export function PlatformSettingsPage() {
  const { t } = useTranslation()
  const [flags, setFlags] = useState<PlatformFlags>({
    public_maintenance: false,
    block_new_reservations: false,
    banner_message: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const settings = await getPlatformSettings()
        const raw = settings.flags
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const f = raw as PlatformFlags
          if (!cancelled) {
            setFlags({
              public_maintenance: Boolean(f.public_maintenance),
              block_new_reservations: Boolean(f.block_new_reservations),
              banner_message:
                typeof f.banner_message === 'string' ? f.banner_message : '',
            })
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('platform.loadError'))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      await setPlatformSettings('flags', {
        public_maintenance: Boolean(flags.public_maintenance),
        block_new_reservations: Boolean(flags.block_new_reservations),
        banner_message: flags.banner_message ?? '',
      })
      setOk(t('platform.settingsSaved'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('platform.saveError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="platform-page">
      <section className="platform-section">
        <h2>{t('platform.settingsTitle')}</h2>
        <p className="platform-lead">{t('platform.settingsLead')}</p>
        {error ? <p className="platform-error">{error}</p> : null}
        {ok ? <p className="platform-ok">{ok}</p> : null}

        <form className="platform-form" onSubmit={onSave}>
          <label className="platform-check">
            <input
              type="checkbox"
              checked={Boolean(flags.public_maintenance)}
              onChange={(e) =>
                setFlags((f) => ({
                  ...f,
                  public_maintenance: e.target.checked,
                }))
              }
            />
            {t('platform.flagMaintenance')}
          </label>
          <label className="platform-check">
            <input
              type="checkbox"
              checked={Boolean(flags.block_new_reservations)}
              onChange={(e) =>
                setFlags((f) => ({
                  ...f,
                  block_new_reservations: e.target.checked,
                }))
              }
            />
            {t('platform.flagBlockReservations')}
          </label>
          <label>
            {t('platform.bannerMessage')}
            <textarea
              value={flags.banner_message ?? ''}
              onChange={(e) =>
                setFlags((f) => ({ ...f, banner_message: e.target.value }))
              }
              rows={3}
            />
          </label>
          <button type="submit" className="admin-clients__btn is-primary" disabled={busy}>
            {busy ? t('platform.saving') : t('platform.saveSettings')}
          </button>
        </form>
      </section>
    </div>
  )
}
