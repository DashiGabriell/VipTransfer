import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getPlatformSettings,
  setPlatformSettings,
  type PlatformFlags,
} from '../../services/platform'

const DEFAULT_FLAGS: PlatformFlags = {
  public_maintenance: false,
  block_new_reservations: false,
  banner_message: '',
  public_signup_enabled: true,
}

export function PlatformSettingsPage() {
  const { t } = useTranslation()
  const [flags, setFlags] = useState<PlatformFlags>(DEFAULT_FLAGS)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

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
              public_signup_enabled: f.public_signup_enabled !== false,
            })
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('platform.loadError'))
        }
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  async function persist(next: PlatformFlags) {
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      await setPlatformSettings('flags', {
        public_maintenance: Boolean(next.public_maintenance),
        block_new_reservations: Boolean(next.block_new_reservations),
        banner_message: next.banner_message ?? '',
        public_signup_enabled: next.public_signup_enabled !== false,
      })
      setOk(t('platform.settingsSaved'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('platform.saveError'))
      throw err
    } finally {
      setBusy(false)
    }
  }

  async function onToggleSignup() {
    const next = {
      ...flags,
      public_signup_enabled: !flags.public_signup_enabled,
    }
    const previous = flags
    setFlags(next)
    try {
      await persist(next)
    } catch {
      setFlags(previous)
    }
  }

  async function onSaveMaintenance(e: FormEvent) {
    e.preventDefault()
    try {
      await persist(flags)
    } catch {
      /* error already set */
    }
  }

  const signupOn = flags.public_signup_enabled !== false

  return (
    <div className="platform-page">
      <section className="platform-section">
        <h2>{t('platform.signupControlTitle')}</h2>
        <p className="platform-lead">{t('platform.signupControlLead')}</p>
        {error ? <p className="platform-error">{error}</p> : null}
        {ok ? <p className="platform-ok">{ok}</p> : null}

        <div className="platform-access-card">
          <div className="platform-access-card__copy">
            <h3>{t('platform.signupToggleLabel')}</h3>
            <p>{t('platform.signupToggleHelp')}</p>
            <span
              className={`platform-status ${signupOn ? 'is-active' : 'is-paused'}`}
            >
              {signupOn
                ? t('platform.signupVisible')
                : t('platform.signupHidden')}
            </span>
          </div>
          <button
            type="button"
            className={`platform-switch${signupOn ? ' is-on' : ''}`}
            role="switch"
            aria-checked={signupOn}
            aria-label={t('platform.signupToggleLabel')}
            disabled={!loaded || busy}
            onClick={() => void onToggleSignup()}
          >
            <span className="platform-switch__knob" aria-hidden="true" />
            <span className="platform-switch__text">
              {signupOn ? t('platform.on') : t('platform.off')}
            </span>
          </button>
        </div>
      </section>

      <section className="platform-section">
        <h2>{t('platform.settingsTitle')}</h2>
        <p className="platform-lead">{t('platform.settingsLead')}</p>

        <form className="platform-form" onSubmit={onSaveMaintenance}>
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
          <button
            type="submit"
            className="admin-clients__btn is-primary"
            disabled={busy}
          >
            {busy ? t('platform.saving') : t('platform.saveSettings')}
          </button>
        </form>
      </section>
    </div>
  )
}
