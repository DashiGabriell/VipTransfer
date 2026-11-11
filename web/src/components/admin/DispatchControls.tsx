import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  formatMoneyDraft,
  hasOverridePrice,
  initialMoneyDraft,
  parseMoneyDraft,
  sanitizeMoneyTyping,
} from '../../domain/reservationPrice'
import { buildDriverDemandWhatsAppUrl } from '../../domain/whatsapp'
import { driverOffersPageUrl } from '../../lib/siteUrl'
import {
  assignReservationToDriver,
  completeReservationJob,
  dispatchLabel,
  setReservationOverridePrice,
} from '../../services/coreV2'
import type {
  Driver,
  JobAssignment,
  Reservation,
  VehicleCategory,
} from '../../types/database'

type Props = {
  reservation: Reservation
  drivers: Driver[]
  assignments: JobAssignment[]
  categories?: VehicleCategory[]
  onChanged: () => void
  onError: (msg: string) => void
}

function mapPriceError(code: string, t: (k: string) => string): string {
  if (code.includes('PRICE_REQUIRED')) return t('admin.price.requiredToComplete')
  if (code.includes('PRICE_INVALID')) return t('admin.price.invalid')
  if (code.includes('PRICE_TOO_HIGH')) return t('admin.price.tooHigh')
  if (code.includes('ALREADY_LIQUIDATED')) return t('admin.price.alreadyLiquidated')
  if (code.includes('RESERVATION_CLOSED')) return t('admin.price.reservationClosed')
  return code || t('admin.price.saveError')
}

export function DispatchControls({
  reservation,
  drivers,
  assignments,
  categories = [],
  onChanged,
  onError,
}: Props) {
  const { t, i18n } = useTranslation()
  const [driverId, setDriverId] = useState('')
  const [busy, setBusy] = useState(false)
  const [priceDraft, setPriceDraft] = useState(() =>
    initialMoneyDraft(reservation),
  )
  const [savingPrice, setSavingPrice] = useState(false)
  const locale = i18n.language.startsWith('en') ? 'en' : 'pt'
  const waLocale = locale === 'en' ? 'en' : 'pt-BR'
  const priceReady = hasOverridePrice(reservation)

  useEffect(() => {
    setPriceDraft(initialMoneyDraft(reservation))
  }, [reservation.id, reservation.override_price, reservation.estimated_price])

  const label = dispatchLabel(assignments, reservation.id)
  const eligible = useMemo(() => {
    const ready = drivers.filter((d) => d.active && d.profile_complete)
    const wanted = reservation.vehicle_category_id
    if (!wanted) return ready
    // Prefer matching category, but never hide other ready drivers —
    // otherwise dispatch is blocked when the fleet categories differ.
    return [...ready].sort((a, b) => {
      const am = a.vehicle_category_id === wanted ? 0 : 1
      const bm = b.vehicle_category_id === wanted ? 0 : 1
      if (am !== bm) return am - bm
      return a.full_name.localeCompare(b.full_name, 'pt-BR')
    })
  }, [drivers, reservation.vehicle_category_id])

  if (reservation.status !== 'confirmado' && reservation.status !== 'concluido') {
    return null
  }

  function vehicleLabel(): string | null {
    if (!reservation.vehicle_category_id) return null
    const cat = categories.find((c) => c.id === reservation.vehicle_category_id)
    if (!cat) return null
    return (
      (cat.name_i18n as { pt?: string; en?: string })[locale] ||
      cat.name_i18n.pt ||
      cat.code
    )
  }

  function openDriverWhatsApp(driver: Driver) {
    const slotLabel = new Date(reservation.slot_start).toLocaleString(
      waLocale === 'en' ? 'en-US' : 'pt-BR',
      {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    )
    const url = buildDriverDemandWhatsAppUrl(driver.phone, {
      serviceCode: reservation.service_code,
      driverFirstName: driver.full_name.split(/\s+/)[0] ?? driver.full_name,
      origin: reservation.origin_address,
      destination: reservation.destination_address,
      stops: reservation.stops,
      serviceLabel: t(`reserve.services.${reservation.service_type}`),
      vehicleLabel: vehicleLabel(),
      slotLabel,
      distanceKm: reservation.estimated_km,
      hoursRequested: reservation.hours_requested,
      airport: reservation.airport,
      serviceNotes: reservation.service_notes,
      offersUrl: driverOffersPageUrl(),
      locale: waLocale,
    })
    if (!url) {
      onError(t('admin.dispatch.whatsappPhoneInvalid'))
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function onAssign() {
    if (!driverId) {
      onError(t('admin.dispatch.pickDriver'))
      return
    }
    const driver = drivers.find((d) => d.id === driverId)
    if (!driver) {
      onError(t('admin.dispatch.pickDriver'))
      return
    }
    setBusy(true)
    onError('')
    try {
      await assignReservationToDriver(reservation.id, driverId)
      setDriverId('')
      onChanged()
      openDriverWhatsApp(driver)
    } catch (err) {
      onError(err instanceof Error ? err.message : t('admin.dispatch.assignError'))
    } finally {
      setBusy(false)
    }
  }

  async function onSavePrice(e?: FormEvent) {
    e?.preventDefault()
    const n = parseMoneyDraft(priceDraft)
    if (n == null || n <= 0) {
      onError(t('admin.price.invalid'))
      return
    }
    setPriceDraft(formatMoneyDraft(n))
    setSavingPrice(true)
    onError('')
    try {
      await setReservationOverridePrice(reservation.id, n)
      onChanged()
    } catch (err) {
      onError(
        mapPriceError(err instanceof Error ? err.message : '', t),
      )
    } finally {
      setSavingPrice(false)
    }
  }

  async function onComplete() {
    if (!priceReady) {
      onError(t('admin.price.requiredToComplete'))
      return
    }
    setBusy(true)
    onError('')
    try {
      await completeReservationJob(reservation.id)
      onChanged()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      onError(
        msg.includes('PRICE_REQUIRED')
          ? t('admin.price.requiredToComplete')
          : msg || t('admin.dispatch.completeError'),
      )
    } finally {
      setBusy(false)
    }
  }

  const canEditPrice =
    reservation.status === 'confirmado' || reservation.status === 'concluido'

  return (
    <div className="admin-dispatch">
      <span className="admin-dispatch__badge">
        {t(`admin.dispatch.status.${label}`)}
      </span>

      {canEditPrice ? (
        <form className="admin-dispatch__price" onSubmit={(ev) => void onSavePrice(ev)}>
          <label className="admin-dispatch__price-field">
            <span>{t('admin.price.realLabel')}</span>
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
                  if (n != null && n > 0) setPriceDraft(formatMoneyDraft(n))
                }}
                placeholder={t('admin.price.placeholder')}
                aria-label={t('admin.price.realLabel')}
              />
            </div>
          </label>
          <button
            type="submit"
            className="admin-res-actions__confirm"
            disabled={savingPrice || busy}
          >
            {savingPrice ? '…' : t('admin.price.save')}
          </button>
          {!priceReady && reservation.status === 'confirmado' ? (
            <p className="admin-dispatch__price-hint">
              {t('admin.price.requiredHint')}
            </p>
          ) : null}
        </form>
      ) : null}

      {label === 'sem_motorista' && reservation.status === 'confirmado' ? (
        <div className="admin-dispatch__row">
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            disabled={busy || !eligible.length}
          >
            <option value="">
              {eligible.length
                ? t('admin.dispatch.pickDriver')
                : t('admin.dispatch.noDrivers')}
            </option>
            {eligible.map((d) => {
              const matches =
                !reservation.vehicle_category_id ||
                d.vehicle_category_id === reservation.vehicle_category_id
              return (
                <option key={d.id} value={d.id}>
                  {matches
                    ? d.full_name
                    : t('admin.dispatch.driverOtherCategory', {
                        name: d.full_name,
                      })}
                </option>
              )
            })}
          </select>
          <button
            type="button"
            className="admin-res-actions__confirm"
            disabled={busy || !driverId}
            onClick={() => void onAssign()}
          >
            {t('admin.dispatch.send')}
          </button>
        </div>
      ) : null}

      {label === 'aceito' && reservation.status === 'confirmado' ? (
        <button
          type="button"
          className="admin-res-actions__confirm"
          disabled={busy || !priceReady}
          title={!priceReady ? t('admin.price.requiredToComplete') : undefined}
          onClick={() => void onComplete()}
        >
          {t('admin.dispatch.complete')}
        </button>
      ) : null}
    </div>
  )
}
