import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  fetchPlatformOps,
  runExpireHolds,
  type PlatformOpsSnapshot,
} from '../../services/platform'

export function PlatformOpsPage() {
  const { t, i18n } = useTranslation()
  const [data, setData] = useState<PlatformOpsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const snapshot = await fetchPlatformOps()
    setData(snapshot)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await refresh()
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

  async function onExpireHolds() {
    if (!window.confirm(t('platform.confirmExpireHolds'))) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await runExpireHolds()
      setMessage(
        t('platform.expireHoldsDone', { count: result.expired_count }),
      )
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('platform.saveError'))
    } finally {
      setBusy(false)
    }
  }

  const locale = i18n.language.startsWith('en') ? 'en-US' : 'pt-BR'

  if (error && !data) {
    return <p className="platform-error">{error}</p>
  }

  if (!data) {
    return <p className="platform-muted">{t('platform.loading')}</p>
  }

  return (
    <div className="platform-page">
      <section className="platform-section">
        <h2>{t('platform.opsTitle')}</h2>
        <p className="platform-lead">{t('platform.opsLead')}</p>
        {error ? <p className="platform-error">{error}</p> : null}
        {message ? <p className="platform-ok">{message}</p> : null}

        <div className="platform-metrics">
          <div className="platform-metric">
            <span>{t('platform.openHolds')}</span>
            <strong>{data.open_holds}</strong>
          </div>
          <div className="platform-metric">
            <span>{t('platform.holdsPastExpiry')}</span>
            <strong>{data.holds_past_expiry}</strong>
          </div>
          <div className="platform-metric">
            <span>{t('platform.chargesOpen')}</span>
            <strong>{data.payment_charges_open}</strong>
          </div>
          <div className="platform-metric">
            <span>{t('platform.chargesFailed')}</span>
            <strong>{data.payment_charges_failed_7d}</strong>
          </div>
        </div>

        {data.is_dev ? (
          <button
            type="button"
            className="admin-clients__btn is-primary"
            disabled={busy}
            onClick={() => void onExpireHolds()}
          >
            {t('platform.runExpireHolds')}
          </button>
        ) : (
          <p className="platform-muted">{t('platform.opsDevOnly')}</p>
        )}
      </section>

      <section className="platform-section">
        <h2>{t('platform.recentWebhooks')}</h2>
        {data.recent_webhooks.length === 0 ? (
          <p className="platform-muted">{t('platform.noWebhooks')}</p>
        ) : (
          <ul className="platform-list">
            {data.recent_webhooks.map((w) => (
              <li key={w.id}>
                <code>{w.event}</code>
                <span className="platform-muted">
                  {' '}
                  · {w.checkout_id ?? '—'} ·{' '}
                  {new Date(w.processed_at).toLocaleString(locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
