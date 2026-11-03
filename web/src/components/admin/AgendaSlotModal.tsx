import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { DaySlot } from '../../domain/agenda'
import type { Reservation } from '../../types/database'

type Props = {
  slot: DaySlot
  reservations: Reservation[]
  busyId: string | null
  onClose: () => void
  onConfirm: (id: string) => void
  onCancel: (id: string) => void
}

function localeFromLang(lang: string): string {
  return lang.startsWith('en') ? 'en-US' : 'pt-BR'
}

function formatMoney(price: number | null | undefined) {
  if (price == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price)
}

export function AgendaSlotModal({
  slot,
  reservations,
  busyId,
  onClose,
  onConfirm,
  onCancel,
}: Props) {
  const { t, i18n } = useTranslation()
  const locale = localeFromLang(i18n.language)
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const slotLabel = new Date(slot.slot_start).toLocaleString(locale)

  return createPortal(
    <div className="agenda-slot-modal" role="presentation">
      <button
        type="button"
        className="agenda-slot-modal__backdrop"
        aria-label={t('admin.closeModal')}
        onClick={onClose}
      />
      <div
        className="agenda-slot-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="agenda-slot-modal__head">
          <div>
            <h2 id={titleId} className="agenda-slot-modal__title">
              {t('admin.slotReservations')}
            </h2>
            <p className="agenda-slot-modal__meta">
              {slotLabel} ·{' '}
              {t('admin.slotMeta', {
                occupied: slot.occupied,
                capacity: slot.capacity,
                available: slot.available,
              })}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="agenda-slot-modal__close"
            onClick={onClose}
            aria-label={t('admin.closeModal')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <ul className="agenda-slot-modal__list">
          {reservations.map((r) => (
            <li key={r.id} className="agenda-slot-modal__card">
              <div className="agenda-slot-modal__card-top">
                <strong>
                  {r.customer_name} · {t(`admin.status.${r.status}`)}
                </strong>
                <span>
                  {r.customer_phone}
                  {r.customer_email ? ` · ${r.customer_email}` : ''}
                </span>
              </div>

              <dl className="agenda-slot-modal__fields">
                <div>
                  <dt>{t('admin.detailRoute')}</dt>
                  <dd>
                    {r.origin_address}
                    <span className="agenda-slot-modal__arrow"> → </span>
                    {r.destination_address}
                  </dd>
                </div>
                <div>
                  <dt>{t('reserve.serviceType')}</dt>
                  <dd>
                    {t(`reserve.services.${r.service_type}`, {
                      defaultValue: r.service_type,
                    })}
                    {r.airport ? ` · ${r.airport}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>{t('admin.detailSlot')}</dt>
                  <dd>
                    {new Date(r.slot_start).toLocaleString(locale)}
                    {' – '}
                    {new Date(r.slot_end).toLocaleTimeString(locale, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </dd>
                </div>
                {r.hours_requested != null && (
                  <div>
                    <dt>{t('admin.detailHours')}</dt>
                    <dd>{r.hours_requested}h</dd>
                  </div>
                )}
                {r.estimated_km != null && (
                  <div>
                    <dt>{t('admin.detailKm')}</dt>
                    <dd>{r.estimated_km} km</dd>
                  </div>
                )}
                <div>
                  <dt>{t('admin.detailPrice')}</dt>
                  <dd>{formatMoney(r.estimated_price)}</dd>
                </div>
                {r.hold_expires_at && r.status === 'hold' && (
                  <div>
                    <dt>{t('admin.detailHold')}</dt>
                    <dd>
                      {new Date(r.hold_expires_at).toLocaleString(locale)}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>{t('admin.detailCreated')}</dt>
                  <dd>
                    {new Date(r.created_at).toLocaleString(locale)}
                    {r.source ? ` · ${r.source}` : ''}
                  </dd>
                </div>
              </dl>

              {(r.status === 'hold' || r.status === 'hold_expirado') && (
                <div className="agenda-slot-modal__actions">
                  <button
                    type="button"
                    className="agenda-slot-modal__btn is-primary"
                    disabled={busyId === r.id}
                    onClick={() => void onConfirm(r.id)}
                  >
                    {t('admin.confirm')}
                  </button>
                  <button
                    type="button"
                    className="agenda-slot-modal__btn"
                    disabled={busyId === r.id}
                    onClick={() => void onCancel(r.id)}
                  >
                    {t('admin.cancel')}
                  </button>
                </div>
              )}
            </li>
          ))}
          {!reservations.length && (
            <li className="agenda-slot-modal__empty">{t('admin.slotEmpty')}</li>
          )}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
