import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useImpersonation } from '../../context/ImpersonationContext'

export function ImpersonationBanner() {
  const { t } = useTranslation()
  const { active, stop } = useImpersonation()

  if (!active) return null

  const name =
    active.target.full_name || active.target.email || active.target.id.slice(0, 8)

  return (
    <div className="platform-impersonation-banner" role="status">
      <p>
        {t('platform.impersonating', {
          name,
          org: active.organization.name,
          reason: active.session.reason,
        })}
      </p>
      <div className="platform-impersonation-banner__actions">
        <Link to="/admin/reservas" className="platform-impersonation-banner__link">
          {t('platform.openAdmin')}
        </Link>
        <button
          type="button"
          className="platform-impersonation-banner__stop"
          onClick={() => void stop()}
        >
          {t('platform.endImpersonation')}
        </button>
      </div>
    </div>
  )
}
