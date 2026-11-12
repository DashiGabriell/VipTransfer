import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { HoldToastInfo } from '../../hooks/useHoldAttention'

type Props = {
  toast: HoldToastInfo
  onDismiss: () => void
  onView: () => void
}

const AUTO_DISMISS_MS = 9000

export function AdminHoldToast({ toast, onDismiss, onView }: Props) {
  const { t } = useTranslation()

  useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [toast, onDismiss])

  return createPortal(
    <div className="admin-hold-toast" role="status" aria-live="polite">
      <div className="admin-hold-toast__pulse" aria-hidden="true" />
      <div className="admin-hold-toast__body">
        <p className="admin-hold-toast__title">{t('admin.holdToastTitle')}</p>
        <p className="admin-hold-toast__text">
          {toast.customerName
            ? t('admin.holdToastBodyNamed', { name: toast.customerName })
            : toast.body || t('admin.holdToastBody')}
        </p>
      </div>
      <div className="admin-hold-toast__actions">
        <button
          type="button"
          className="admin-hold-toast__view"
          onClick={onView}
        >
          {t('admin.holdToastView')}
        </button>
        <button
          type="button"
          className="admin-hold-toast__close"
          onClick={onDismiss}
          aria-label={t('admin.closeModal')}
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  )
}
