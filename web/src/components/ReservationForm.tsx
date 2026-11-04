import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useTenant } from '../context/TenantContext'
import type { DaySlot } from '../domain/agenda'
import { formatSlotLabel } from '../domain/agenda'
import {
  formatBrazilPhoneInput,
  isValidBrazilPhone,
  isValidEmail,
  isValidFullName,
} from '../domain/customerFields'
import { calculateFreightEstimate } from '../domain/freight'
import { formatCurrencyBRL } from '../domain/slots'
import { buildWhatsAppUrl } from '../domain/whatsapp'
import {
  buildRouteWaypoints,
  DistanceError,
  measureDrivingDistanceKm,
} from '../services/distance'
import {
  createReservationWithHold,
  notifyReservationWebhook,
  SlotUnavailableError,
} from '../services/reservations'
import { pickFreightRule } from '../services/tenantCatalog'
import type { AirportCode, ServiceType } from '../types/database'
import { SlotAgenda } from './SlotAgenda'

const SERVICE_TYPES: ServiceType[] = [
  'aeroporto',
  'corporativo',
  'horas_a_disposicao',
  'viagem',
]

const AIRPORTS: AirportCode[] = ['GRU', 'CGH', 'VCP']
const MAX_STOPS = 8
const DISTANCE_DEBOUNCE_MS = 700

function localizedName(
  name: { pt?: string; en?: string },
  locale: string,
): string {
  if (locale.startsWith('en')) return name.en || name.pt || '—'
  return name.pt || name.en || '—'
}

type DistanceState =
  | { status: 'idle' }
  | { status: 'need_addresses' }
  | { status: 'loading' }
  | { status: 'ready'; km: number }
  | { status: 'error'; code: string }

export function ReservationForm() {
  const { t, i18n } = useTranslation()
  const tenant = useTenant()
  const locale = i18n.language.startsWith('en') ? 'en' : 'pt-BR'
  const waDigits = tenant.whatsapp.replace(/\D/g, '') || '5511949247258'

  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [stops, setStops] = useState<string[]>([])
  const [serviceType, setServiceType] = useState<ServiceType | ''>('')
  const [airport, setAirport] = useState<AirportCode | ''>('')
  const [hours, setHours] = useState('4')
  const [vehicleId, setVehicleId] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<DaySlot | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [distance, setDistance] = useState<DistanceState>({ status: 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackError, setFeedbackError] = useState(false)
  const [agendaKey, setAgendaKey] = useState(0)

  function addStop() {
    if (stops.length >= MAX_STOPS) return
    setStops((prev) => [...prev, ''])
  }

  function updateStop(index: number, value: string) {
    setStops((prev) => prev.map((s, i) => (i === index ? value : s)))
  }

  function removeStop(index: number) {
    setStops((prev) => prev.filter((_, i) => i !== index))
  }

  const vehicles = tenant.catalog?.vehicles ?? []
  const freightRules = tenant.catalog?.freightRules ?? []
  const airportFees = tenant.catalog?.airportFees ?? []
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId)

  const freightRule = useMemo(
    () =>
      pickFreightRule(freightRules, {
        vehicleCategoryId: vehicleId || null,
        serviceType: serviceType || null,
      }),
    [freightRules, vehicleId, serviceType],
  )

  const airportFee = useMemo(() => {
    if (!airport) return 0
    return airportFees.find((f) => f.airport === airport)?.flat_fee ?? 0
  }, [airport, airportFees])

  const routeKm = distance.status === 'ready' ? distance.km : 0

  const estimate = useMemo(() => {
    if (!serviceType || !freightRule || distance.status !== 'ready') return null
    return calculateFreightEstimate({
      km: routeKm,
      pricePerKm: Number(freightRule.price_per_km),
      minimumFare: Number(freightRule.minimum_fare),
      pricePerHour: freightRule.price_per_hour
        ? Number(freightRule.price_per_hour)
        : 0,
      hours: Number(hours) || 0,
      airportFlatFee: airportFee,
      serviceType,
    })
  }, [serviceType, freightRule, routeKm, hours, airportFee, distance.status])

  const waypointsKey = useMemo(() => {
    const points = buildRouteWaypoints({
      origin,
      stops,
      destination,
      airport: serviceType === 'aeroporto' ? airport : null,
    })
    return points.join('||')
  }, [origin, stops, destination, serviceType, airport])

  useEffect(() => {
    const points = waypointsKey.split('||').filter(Boolean)
    if (points.length < 2) {
      setDistance({ status: 'need_addresses' })
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setDistance({ status: 'loading' })
      void measureDrivingDistanceKm(points, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return
          setDistance({ status: 'ready', km: result.km })
        })
        .catch((err) => {
          if (controller.signal.aborted) return
          if (err instanceof DOMException && err.name === 'AbortError') return
          const code =
            err instanceof DistanceError ? err.message : 'DISTANCE_FAILED'
          setDistance({ status: 'error', code })
        })
    }, DISTANCE_DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [waypointsKey])

  function distanceMessage(): string {
    switch (distance.status) {
      case 'loading':
        return t('reserve.distanceCalculating')
      case 'ready':
        return t('reserve.distanceReady', { km: distance.km })
      case 'need_addresses':
        return t('reserve.distanceNeedAddresses')
      case 'error':
        return t('reserve.distanceError')
      default:
        return ''
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFeedback(null)
    setFeedbackError(false)

    if (distance.status !== 'ready') {
      setFeedbackError(true)
      setFeedback(t('reserve.distanceRequired'))
      return
    }

    if (!serviceType || !selectedSlot || !estimate) {
      setFeedbackError(true)
      setFeedback(t('agenda.pickSlot'))
      return
    }

    if (!tenant.organizationId) {
      setFeedbackError(true)
      setFeedback(
        tenant.loading
          ? 'Carregando organização…'
          : 'Organização não disponível.',
      )
      return
    }

    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    const trimmedEmail = email.trim()

    if (!isValidFullName(trimmedName)) {
      setFeedbackError(true)
      setFeedback(t('reserve.nameInvalid'))
      return
    }
    if (!isValidBrazilPhone(trimmedPhone)) {
      setFeedbackError(true)
      setFeedback(t('reserve.phoneInvalid'))
      return
    }
    if (!isValidEmail(trimmedEmail)) {
      setFeedbackError(true)
      setFeedback(t('reserve.emailInvalid'))
      return
    }

    const vehicleLabel = selectedVehicle
      ? localizedName(selectedVehicle.name_i18n, locale)
      : '—'

    setSubmitting(true)
    try {
      const cleanedStops = stops.map((s) => s.trim()).filter(Boolean)

      const reservation = await createReservationWithHold({
        organization_id: tenant.organizationId,
        customer_name: trimmedName,
        customer_phone: trimmedPhone,
        customer_email: trimmedEmail,
        origin_address: origin,
        destination_address: destination,
        stops: cleanedStops,
        service_type: serviceType,
        vehicle_category_id: vehicleId || null,
        airport: serviceType === 'aeroporto' ? airport || null : null,
        slot_start: selectedSlot.slot_start,
        slot_end: selectedSlot.slot_end,
        hours_requested:
          serviceType === 'horas_a_disposicao' ? Number(hours) || null : null,
        estimated_km: distance.km,
        estimated_price: estimate.total,
        locale,
        source: 'web',
      })

      void notifyReservationWebhook(reservation)

      const estimateLabel = formatCurrencyBRL(estimate.total, locale)
      const holdLabel = reservation.hold_expires_at
        ? new Date(reservation.hold_expires_at).toLocaleString(locale)
        : ''
      const slotLabel = new Date(selectedSlot.slot_start).toLocaleString(locale)

      const url = buildWhatsAppUrl(waDigits, {
        name: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        origin,
        destination,
        stops: cleanedStops,
        serviceLabel: t(`reserve.services.${serviceType}`),
        vehicleLabel,
        slotLabel: `${slotLabel} (hold até ${holdLabel})`,
        estimateLabel,
        distanceKm: distance.km,
        locale,
      })
      window.open(url, '_blank', 'noopener,noreferrer')

      setFeedback(
        locale === 'en'
          ? `Reservation held until ${holdLabel}.`
          : `Reserva em hold até ${holdLabel}.`,
      )
      setSelectedSlot(null)
      setStops([])
      setAgendaKey((k) => k + 1)
    } catch (err) {
      setFeedbackError(true)
      if (err instanceof SlotUnavailableError) {
        setFeedback(t('agenda.slotTaken'))
        setAgendaKey((k) => k + 1)
        setSelectedSlot(null)
      } else {
        setFeedback(err instanceof Error ? err.message : 'Falha ao reservar')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="itinerary" id="cotacao" onSubmit={onSubmit} noValidate>
      <div className="itinerary-row">
        <label htmlFor="origem">{t('reserve.origin')}</label>
        <input
          id="origem"
          name="origem"
          type="text"
          placeholder="Endereço ou hotel"
          autoComplete="street-address"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          required
        />
      </div>

      {stops.map((stop, index) => (
        <div className="itinerary-row itinerary-row--stop" key={`stop-${index}`}>
          <label htmlFor={`parada-${index}`}>
            {t('reserve.stop', { n: index + 1 })}
          </label>
          <div className="itinerary-stop-field">
            <input
              id={`parada-${index}`}
              name={`parada-${index}`}
              type="text"
              placeholder={t('reserve.stopPlaceholder')}
              value={stop}
              onChange={(e) => updateStop(index, e.target.value)}
              required
            />
            <button
              type="button"
              className="itinerary-stop-remove"
              onClick={() => removeStop(index)}
              aria-label={t('reserve.removeStop')}
            >
              {t('reserve.removeStop')}
            </button>
          </div>
        </div>
      ))}

      {stops.length < MAX_STOPS && (
        <div className="itinerary-stop-actions">
          <button
            type="button"
            className="itinerary-add-stop"
            onClick={addStop}
          >
            {t('reserve.addStop')}
          </button>
        </div>
      )}

      <div className="itinerary-row">
        <label htmlFor="destino">{t('reserve.destination')}</label>
        <input
          id="destino"
          name="destino"
          type="text"
          placeholder="GRU, CGH, VCP ou endereço"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          required
        />
      </div>

      <div className="itinerary-row">
        <label htmlFor="servico">{t('reserve.serviceType')}</label>
        <select
          id="servico"
          name="servico"
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value as ServiceType | '')}
          required
        >
          <option value="" disabled>
            Escolha o tipo
          </option>
          {SERVICE_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`reserve.services.${type}`)}
            </option>
          ))}
        </select>
      </div>

      {serviceType === 'aeroporto' && (
        <div className="itinerary-row">
          <label htmlFor="aeroporto">{t('reserve.airport')}</label>
          <select
            id="aeroporto"
            value={airport}
            onChange={(e) => setAirport(e.target.value as AirportCode | '')}
            required
          >
            <option value="" disabled>
              {t('reserve.airport')}
            </option>
            {AIRPORTS.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      )}

      {serviceType === 'horas_a_disposicao' && (
        <div className="itinerary-row">
          <label htmlFor="horas">{t('reserve.hours')}</label>
          <input
            id="horas"
            type="number"
            min={1}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            required
          />
        </div>
      )}

      <div className="itinerary-row">
        <label htmlFor="veiculo">{t('reserve.vehicle')}</label>
        <select
          id="veiculo"
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
        >
          <option value="">
            {vehicles.length ? t('reserve.vehicle') : t('reserve.vehicleEmpty')}
          </option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {localizedName(vehicle.name_i18n, locale)}
              {vehicle.is_armored ? ' · blindado' : ''}
            </option>
          ))}
        </select>
      </div>

      <p
        className={`form-note itinerary-distance${
          distance.status === 'error' ? ' is-error' : ''
        }${distance.status === 'ready' ? ' is-ok' : ''}`}
        role="status"
        aria-live="polite"
      >
        <strong>{t('reserve.distance')}:</strong> {distanceMessage()}
      </p>

      <SlotAgenda
        key={agendaKey}
        organizationId={tenant.organizationId}
        selectedStart={selectedSlot?.slot_start ?? null}
        onSelect={setSelectedSlot}
        mode="book"
      />
      {selectedSlot && (
        <p className="agenda-selected">
          {t('agenda.selected')}:{' '}
          {new Date(selectedSlot.slot_start).toLocaleString(locale)} (
          {formatSlotLabel(selectedSlot.slot_start, locale)})
        </p>
      )}

      <div className="itinerary-row">
        <label htmlFor="nome">{t('reserve.name')}</label>
        <input
          id="nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          minLength={3}
          pattern="\S+(\s+\S+)+"
          title={t('reserve.nameInvalid')}
          required
        />
      </div>
      <div className="itinerary-row">
        <label htmlFor="telefone">{t('reserve.phone')}</label>
        <input
          id="telefone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={t('reserve.phonePlaceholder')}
          value={phone}
          onChange={(e) => setPhone(formatBrazilPhoneInput(e.target.value))}
          pattern="\(\d{2}\)\s?\d{4,5}-?\d{4}"
          title={t('reserve.phoneInvalid')}
          required
        />
      </div>
      <div className="itinerary-row">
        <label htmlFor="email">{t('reserve.email')}</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          pattern="[^\s@]+@[^\s@]+\.[^\s@]{2,}"
          title={t('reserve.emailInvalid')}
          required
        />
      </div>

      {estimate && (
        <p className="form-note">
          {t('reserve.estimate')}: {formatCurrencyBRL(estimate.total, locale)} —{' '}
          {t('reserve.estimateHint')}
        </p>
      )}

      <div className="itinerary-actions">
        <button
          className="btn-primary"
          type="submit"
          disabled={
            submitting ||
            tenant.loading ||
            !selectedSlot ||
            distance.status !== 'ready'
          }
        >
          {submitting ? '…' : t('reserve.submit')}
        </button>
        <a
          className="btn-ghost"
          href={`https://wa.me/${waDigits}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </a>
      </div>
      <p className="form-note">{t('reserve.holdHint')}</p>
      <p
        className={`form-status${feedback ? (feedbackError ? ' is-error' : ' is-ok') : ''}`}
        role="status"
        aria-live="polite"
      >
        {feedback}
      </p>
    </form>
  )
}
