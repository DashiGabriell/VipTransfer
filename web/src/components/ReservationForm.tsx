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
import {
  SERVICE_TYPES,
  type AirportCode,
  type ServiceType,
} from '../types/database'
import { SlotAgenda } from './SlotAgenda'

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
  | { status: 'skipped' }
  | { status: 'loading' }
  | { status: 'ready'; km: number }
  | { status: 'error'; code: string }

function needsRouteDistance(service: ServiceType | ''): boolean {
  return service === 'ponto_a_b'
}

function mayMeasureDistance(service: ServiceType | ''): boolean {
  return service === 'ponto_a_b' || service === 'a_disposicao'
}

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
  const [serviceNotes, setServiceNotes] = useState('')
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
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId)

  const showStops = serviceType === 'ponto_a_b'
  const showDestination =
    serviceType === 'ponto_a_b' || serviceType === 'a_disposicao'
  const destinationRequired = serviceType === 'ponto_a_b'
  const showAirport = serviceType === 'ponto_a_b'
  const showHours = serviceType === 'a_disposicao'
  const showNotes = serviceType === 'concierge'

  const waypointsKey = useMemo(() => {
    if (!mayMeasureDistance(serviceType)) return ''
    const points = buildRouteWaypoints({
      origin,
      stops: showStops ? stops : [],
      destination,
      airport: showAirport ? airport : null,
    })
    return points.join('||')
  }, [origin, stops, destination, serviceType, airport, showStops, showAirport])

  useEffect(() => {
    if (!mayMeasureDistance(serviceType)) {
      setDistance({ status: 'skipped' })
      return
    }

    const points = waypointsKey.split('||').filter(Boolean)
    if (points.length < 2) {
      setDistance(
        needsRouteDistance(serviceType)
          ? { status: 'need_addresses' }
          : { status: 'skipped' },
      )
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
  }, [waypointsKey, serviceType])

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
      case 'skipped':
        return t('reserve.distanceNotRequired')
      default:
        return ''
    }
  }

  function distanceOkForSubmit(): boolean {
    if (needsRouteDistance(serviceType)) {
      return distance.status === 'ready'
    }
    if (serviceType === 'a_disposicao') {
      return distance.status === 'ready' || distance.status === 'skipped'
    }
    return true
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFeedback(null)
    setFeedbackError(false)

    if (!serviceType || !selectedSlot) {
      setFeedbackError(true)
      setFeedback(t('agenda.pickSlot'))
      return
    }

    if (!distanceOkForSubmit()) {
      setFeedbackError(true)
      setFeedback(t('reserve.distanceRequired'))
      return
    }

    if (serviceType === 'a_disposicao' && !(Number(hours) > 0)) {
      setFeedbackError(true)
      setFeedback(t('reserve.hoursInvalid'))
      return
    }

    if (serviceType === 'concierge' && !serviceNotes.trim()) {
      setFeedbackError(true)
      setFeedback(t('reserve.notesRequired'))
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
      const cleanedStops = showStops
        ? stops.map((s) => s.trim()).filter(Boolean)
        : []
      const dest = destination.trim()
      const notes = serviceNotes.trim()
      const km = distance.status === 'ready' ? distance.km : null

      const reservation = await createReservationWithHold({
        organization_id: tenant.organizationId,
        customer_name: trimmedName,
        customer_phone: trimmedPhone,
        customer_email: trimmedEmail,
        origin_address: origin.trim(),
        destination_address: dest,
        stops: cleanedStops,
        service_type: serviceType,
        vehicle_category_id: vehicleId || null,
        airport: showAirport && airport ? airport : null,
        slot_start: selectedSlot.slot_start,
        slot_end: selectedSlot.slot_end,
        hours_requested:
          serviceType === 'a_disposicao' ? Number(hours) || null : null,
        estimated_km: km,
        estimated_price: null,
        service_notes: notes || null,
        locale,
        source: 'web',
      })

      void notifyReservationWebhook(reservation)

      const holdLabel = reservation.hold_expires_at
        ? new Date(reservation.hold_expires_at).toLocaleString(locale)
        : ''
      const slotLabel = new Date(selectedSlot.slot_start).toLocaleString(locale)

      const url = buildWhatsAppUrl(waDigits, {
        name: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        origin: origin.trim(),
        destination: dest,
        stops: cleanedStops,
        serviceLabel: t(`reserve.services.${serviceType}`),
        vehicleLabel,
        slotLabel: `${slotLabel} (hold até ${holdLabel})`,
        distanceKm: km,
        hoursRequested:
          serviceType === 'a_disposicao' ? Number(hours) || null : null,
        airport: showAirport && airport ? airport : null,
        serviceNotes: notes || null,
        locale,
      })
      window.open(url, '_blank', 'noopener,noreferrer')

      setFeedback(
        locale === 'en'
          ? `Request held until ${holdLabel}. Fare will be confirmed on WhatsApp.`
          : `Solicitação em hold até ${holdLabel}. O valor será combinado no WhatsApp.`,
      )
      setSelectedSlot(null)
      setStops([])
      setServiceNotes('')
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
        <label htmlFor="servico">{t('reserve.serviceType')}</label>
        <select
          id="servico"
          name="servico"
          value={serviceType}
          onChange={(e) => {
            const next = e.target.value as ServiceType | ''
            setServiceType(next)
            if (next !== 'ponto_a_b') {
              setStops([])
              setAirport('')
            }
            if (next === 'concierge') {
              setDestination('')
            }
          }}
          required
        >
          <option value="" disabled>
            {t('reserve.servicePlaceholder')}
          </option>
          {SERVICE_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`reserve.services.${type}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="itinerary-row">
        <label htmlFor="origem">
          {serviceType === 'concierge'
            ? t('reserve.originConcierge')
            : t('reserve.origin')}
        </label>
        <input
          id="origem"
          name="origem"
          type="text"
          placeholder={
            serviceType === 'concierge'
              ? t('reserve.originConciergePlaceholder')
              : t('reserve.originPlaceholder')
          }
          autoComplete="street-address"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          required
        />
      </div>

      {showStops &&
        stops.map((stop, index) => (
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

      {showStops && stops.length < MAX_STOPS && (
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

      {showDestination && (
        <div className="itinerary-row">
          <label htmlFor="destino">
            {destinationRequired
              ? t('reserve.destination')
              : t('reserve.destinationOptional')}
          </label>
          <input
            id="destino"
            name="destino"
            type="text"
            placeholder={t('reserve.destinationPlaceholder')}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            required={destinationRequired}
          />
        </div>
      )}

      {showAirport && (
        <div className="itinerary-row">
          <label htmlFor="aeroporto">{t('reserve.airportOptional')}</label>
          <select
            id="aeroporto"
            value={airport}
            onChange={(e) => setAirport(e.target.value as AirportCode | '')}
          >
            <option value="">{t('reserve.airportNone')}</option>
            {AIRPORTS.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      )}

      {showHours && (
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

      {showNotes && (
        <div className="itinerary-row">
          <label htmlFor="notas">{t('reserve.notes')}</label>
          <textarea
            id="notas"
            name="notas"
            rows={3}
            placeholder={t('reserve.notesPlaceholder')}
            value={serviceNotes}
            onChange={(e) => setServiceNotes(e.target.value)}
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

      {mayMeasureDistance(serviceType) && (
        <p
          className={`form-note itinerary-distance${
            distance.status === 'error' ? ' is-error' : ''
          }${distance.status === 'ready' ? ' is-ok' : ''}`}
          role="status"
          aria-live="polite"
        >
          <strong>{t('reserve.distance')}:</strong> {distanceMessage()}
        </p>
      )}

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

      <p className="form-note">{t('reserve.priceWhatsappHint')}</p>

      <div className="itinerary-actions">
        <button
          className="btn-primary"
          type="submit"
          disabled={
            submitting ||
            tenant.loading ||
            !selectedSlot ||
            !distanceOkForSubmit()
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
