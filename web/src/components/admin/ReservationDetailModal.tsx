import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  formatMoneyDraft,
  formatReservationMoney,
  hasOverridePrice,
  initialMoneyDraft,
  parseMoneyDraft,
  sanitizeMoneyTyping,
} from '../../domain/reservationPrice'
import { setReservationOverridePrice } from '../../services/coreV2'
import type {
  Driver,
  JobAssignment,
  Reservation,
  VehicleCategory,
} from '../../types/database'
import { DispatchControls } from './DispatchControls'
import { RouteNavPicker, ViewRouteButton } from './RouteNavPicker'

type Props = {
  reservation: Reservation
  busyId: string | null
  drivers: Driver[]
  assignments: JobAssignment[]
  categories: VehicleCategory[]
  onClose: () => void
  onConfirm: (id: string) => void
  onCancel: (id: string) => void
  onDispatchChanged: () => void
  onError: (msg: string) => void
}

function localeFromLang(lang: string): string {
  return lang.startsWith('en') ? 'en-US' : 'pt-BR'
}

export function ReservationDetailModal({
  reservation: r,
  busyId,
  drivers,
  assignments,
  categories,
  onClose,
  onConfirm,
  onCancel,
  onDispatchChanged,
  onError,
}: Props) {
  const { t, i18n } = useTranslation()
  const locale = localeFromLang(i18n.language)
  const lang = i18n.language.startsWith('en') ? 'en' : 'pt'
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [routeOpen, setRouteOpen] = useState(false)
  const [priceDraft, setPriceDraft] = useState(() => initialMoneyDraft(r))
  const [savingPrice, setSavingPrice] = useState(false)
  const busy = busyId === r.id
  const canEditPrice =
    r.status !== 'cancelado' &&
    r.status !== 'hold_expirado' &&
    r.status !== 'confirmado' &&
    r.status !== 'concluido'

  const category = categories.find((c) => c.id === r.vehicle_category_id)
  const categoryLabel = category
    ? (category.name_i18n as { pt?: string; en?: string })[lang] ||
      category.name_i18n.pt ||
      category.code
    : '—'

  useEffect(() => {
    setPriceDraft(initialMoneyDraft(r))
  }, [r.id, r.override_price, r.estimated_price])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (routeOpen) {
          setRouteOpen(false)
          return
        }
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, routeOpen])

  async function onSavePrice(e: FormEvent) {
    e.preventDefault()
    const n = parseMoneyDraft(priceDraft)
    if (n == null || n <= 0) {
      onError(t('admin.price.invalid'))
      return
    }
    setPriceDraft(formatMoneyDraft(n))
    setSavingPrice(true)
    onError('')
    try {
      await setReservationOverridePrice(r.id, n)
      onDispatchChanged()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('PRICE_INVALID')) onError(t('admin.price.invalid'))
      else if (msg.includes('ALREADY_LIQUIDATED'))
        onError(t('admin.price.alreadyLiquidated'))
      else if (msg.includes('RESERVATION_CLOSED'))
        onError(t('admin.price.reservationClosed'))
      else onError(msg || t('admin.price.saveError'))
    } finally {
      setSavingPrice(false)
    }
  }

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
              {t('admin.reservationDetailTitle')}
            </h2>
            <p className="agenda-slot-modal__meta">
              <span className="service-code">{r.service_code}</span>
              {' · '}
              {new Date(r.slot_start).toLocaleString(locale)} ·{' '}
              {t(`admin.status.${r.status}`)}
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

        <div className="agenda-slot-modal__card agenda-slot-modal__body">
          <dl className="agenda-slot-modal__fields">
            <div>
              <dt>{t('admin.serviceCode')}</dt>
              <dd>
                <span className="service-code">{r.service_code}</span>
              </dd>
            </div>
            <div>
              <dt>{t('reserve.name')}</dt>
              <dd>{r.customer_name}</dd>
            </div>
            <div>
              <dt>{t('reserve.phone')}</dt>
              <dd>{r.customer_phone}</dd>
            </div>
            <div>
              <dt>{t('reserve.email')}</dt>
              <dd>{r.customer_email}</dd>
            </div>
            <div>
              <dt>{t('admin.colService', { defaultValue: 'Serviço' })}</dt>
              <dd>{t(`reserve.services.${r.service_type}`)}</dd>
            </div>
            <div>
              <dt>{t('admin.drivers.category')}</dt>
              <dd>{categoryLabel}</dd>
            </div>
            {r.airport ? (
              <div>
                <dt>{t('reserve.airport')}</dt>
                <dd>{r.airport}</dd>
              </div>
            ) : null}
            {r.hours_requested != null ? (
              <div>
                <dt>{t('reserve.hours')}</dt>
                <dd>{r.hours_requested}h</dd>
              </div>
            ) : null}
            <div>
              <dt>{t('admin.routeLegOrigin')}</dt>
              <dd>{r.origin_address}</dd>
            </div>
            {(r.stops ?? []).filter(Boolean).map((stop, i) => (
              <div key={`${r.id}-d-stop-${i}`}>
                <dt>{t('admin.routeLegStop', { n: i + 1 })}</dt>
                <dd>{stop}</dd>
              </div>
            ))}
            {r.destination_address ? (
              <div>
                <dt>{t('admin.routeLegDestination')}</dt>
                <dd>{r.destination_address}</dd>
              </div>
            ) : null}
            {r.estimated_km != null ? (
              <div>
                <dt>{t('admin.colDistance', { defaultValue: 'Distância' })}</dt>
                <dd>{r.estimated_km} km</dd>
              </div>
            ) : null}
            <div>
              <dt>{t('admin.price.suggestedLabel')}</dt>
              <dd>
                {r.estimated_price != null
                  ? formatReservationMoney(r.estimated_price, locale)
                  : t('admin.price.suggestedWhatsapp')}
              </dd>
            </div>
            <div>
              <dt>{t('admin.price.realLabel')}</dt>
              <dd>
                {hasOverridePrice(r)
                  ? formatReservationMoney(r.override_price, locale)
                  : t('admin.price.realMissing')}
              </dd>
            </div>
            {canEditPrice ? (
              <div className="agenda-slot-modal__price-edit">
                <form onSubmit={(ev) => void onSavePrice(ev)}>
                  <label>
                    <span>{t('admin.price.realField')}</span>
                    <div className="admin-dispatch__money">
                      <span aria-hidden="true">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={priceDraft}
                        disabled={savingPrice || busy}
                        onChange={(e) =>
                          setPriceDraft(sanitizeMoneyTyping(e.target.value))
                        }
                        onBlur={() => {
                          const n = parseMoneyDraft(priceDraft)
                          if (n != null && n > 0)
                            setPriceDraft(formatMoneyDraft(n))
                        }}
                        placeholder={t('admin.price.placeholder')}
                      />
                    </div>
                  </label>
                  <button
                    type="submit"
                    className="agenda-slot-modal__btn is-primary"
                    disabled={savingPrice || busy}
                  >
                    {savingPrice ? '…' : t('admin.price.save')}
                  </button>
                </form>
              </div>
            ) : null}
            {r.service_notes ? (
              <div>
                <dt>{t('admin.drivers.notes')}</dt>
                <dd>{r.service_notes}</dd>
              </div>
            ) : null}
            {r.hold_expires_at && r.status === 'hold' ? (
              <div>
                <dt>Hold</dt>
                <dd>
                  {t('admin.holdExpires', {
                    time: new Date(r.hold_expires_at).toLocaleString(locale),
                  })}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="agenda-slot-modal__actions">
            <ViewRouteButton
              className="agenda-slot-modal__btn"
              places={{
                origin: r.origin_address,
                destination: r.destination_address,
                stops: r.stops,
              }}
              onOpen={() => setRouteOpen(true)}
            />
            {(r.status === 'hold' || r.status === 'hold_expirado') && (
              <button
                type="button"
                className="agenda-slot-modal__btn is-primary"
                disabled={busy}
                onClick={() => onConfirm(r.id)}
              >
                {t('admin.confirm')}
              </button>
            )}
            {r.status !== 'cancelado' && r.status !== 'concluido' && (
              <button
                type="button"
                className="agenda-slot-modal__btn"
                disabled={busy}
                onClick={() => onCancel(r.id)}
              >
                {t('admin.cancel')}
              </button>
            )}
          </div>

          <div style={{ marginTop: '0.85rem' }}>
            <DispatchControls
              reservation={r}
              drivers={drivers}
              assignments={assignments}
              categories={categories}
              onChanged={onDispatchChanged}
              onError={onError}
            />
          </div>
        </div>
      </div>

      {routeOpen ? (
        <RouteNavPicker
          places={{
            origin: r.origin_address,
            destination: r.destination_address,
            stops: r.stops,
          }}
          onClose={() => setRouteOpen(false)}
        />
      ) : null}
    </div>,
    document.body,
  )
}
