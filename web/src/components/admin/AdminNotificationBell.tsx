import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStaffNotificationBadge } from '../../hooks/useStaffNotificationBadge'

export function AdminNotificationBell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { unreadCount } = useStaffNotificationBadge()
  const badge =
    unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : null

  return (
    <button
      type="button"
      className="admin-notif-bell"
      aria-label={
        unreadCount > 0
          ? t('admin.notif.bellAriaUnread', { count: unreadCount })
          : t('admin.notif.bellAria')
      }
      onClick={() => navigate('/admin/notificacoes')}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-notif-bell__icon">
        <path
          d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4.2 1.5 5.8 2 6.5H4.5c.5-.7 2-2.3 2-6.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M10 18.5a2 2 0 0 0 4 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
      {badge ? (
        <span className="admin-notif-bell__badge" aria-hidden="true">
          {badge}
        </span>
      ) : null}
    </button>
  )
}
