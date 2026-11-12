import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  fetchPlatformOverview,
  type PlatformOverview,
} from '../../services/platform'

export function PlatformOverviewPage() {
  const { t, i18n } = useTranslation()
  const [data, setData] = useState<PlatformOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const overview = await fetchPlatformOverview()
        if (!cancelled) setData(overview)
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

  const locale = i18n.language.startsWith('en') ? 'en-US' : 'pt-BR'

  if (error) {
    return <p className="platform-error">{error}</p>
  }

  if (!data) {
    return <p className="platform-muted">{t('platform.loading')}</p>
  }

  const cards = [
    { label: t('platform.metricOrgsActive'), value: data.orgs_active },
    { label: t('platform.metricOrgsPaused'), value: data.orgs_paused },
    { label: t('platform.metricHolds24h'), value: data.holds_24h },
    { label: t('platform.metricConfirmed24h'), value: data.confirmed_24h },
    { label: t('platform.metricConfirmed7d'), value: data.confirmed_7d },
    { label: t('platform.metricDrivers'), value: data.drivers_active },
    { label: t('platform.metricPayErrors'), value: data.payment_errors_7d },
  ]

  return (
    <div className="platform-page">
      <section className="platform-section">
        <h2>{t('platform.overviewTitle')}</h2>
        <p className="platform-lead">{t('platform.overviewLead')}</p>
        <div className="platform-metrics">
          {cards.map((c) => (
            <div key={c.label} className="platform-metric">
              <span>{c.label}</span>
              <strong>{c.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="platform-section">
        <h2>{t('platform.problemOrgs')}</h2>
        {data.problem_orgs.length === 0 ? (
          <p className="platform-muted">{t('platform.noProblems')}</p>
        ) : (
          <ul className="platform-list">
            {data.problem_orgs.map((org) => (
              <li key={org.id}>
                <Link to={`/dashitecnology/orgs/${org.id}`}>
                  {org.name} ({org.slug})
                </Link>
                <span className="platform-muted">
                  {' '}
                  · {org.status}
                  {org.owners === 0 ? ` · ${t('platform.noOwner')}` : ''}
                  {org.holds_expiring_soon > 0
                    ? ` · ${t('platform.holdsExpiring', { count: org.holds_expiring_soon })}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="platform-section">
        <div className="platform-section__head">
          <h2>{t('platform.recentAudit')}</h2>
          <Link to="/dashitecnology/audit">{t('platform.viewAll')}</Link>
        </div>
        <ul className="platform-list">
          {data.recent_audit.map((row) => (
            <li key={row.id}>
              <code>{row.action}</code>
              <span className="platform-muted">
                {' '}
                · {row.entity_type}
                {row.impersonator_id ? ` · ${t('platform.viaImpersonation')}` : ''}
                {' · '}
                {new Date(row.created_at).toLocaleString(locale)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
