import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { Reservation } from '../../types/database'
import { ReservationForm } from '../ReservationForm'

type Props = {
  onClose: () => void
  onCreated: (reservation: Reservation) => void
}

export function AdminCreateReservationModal({ onClose, onCreated }: Props) {
  const { t } = useTranslation()
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className="admin-form-modal" role="presentation">
      <button
        type="button"
        className="admin-form-modal__backdrop"
        aria-label={t('admin.closeModal')}
        onClick={onClose}
      />
      <div
        className="admin-form-modal__panel admin-create-reservation"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="admin-form-modal__head">
          <div>
            <h2 id={titleId}>{t('admin.createReservationTitle')}</h2>
            <p>{t('admin.createReservationLead')}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="admin-form-modal__close"
            onClick={onClose}
            aria-label={t('admin.closeModal')}
          >
            ×
          </button>
        </header>

        <ReservationForm variant="admin" onCreated={onCreated} />
      </div>
    </div>,
    document.body,
  )
}
