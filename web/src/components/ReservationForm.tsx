import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useTenant } from '../context/TenantContext'
import type { DaySlot } from '../domain/agenda'
import { formatSlotLabel } from '../domain/agenda'
import { calculateFreightEstimate } from '../domain/freight'
import { formatCurrencyBRL } from '../domain/slots'
import { buildWhatsAppUrl } from '../domain/whatsapp'
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

function localizedName(
  name: { pt?: string; en?: string },
  locale: string,
): string {
  if (locale.startsWith('en')) return name.en || name.pt || '—'
  return name.pt || name.en || '—'
}

export function ReservationForm() {
  const { t, i18n } = useTranslation()
  const tenant = useTenant()
  const locale = i18n.language.startsWith('en') ? 'en' : 'pt-BR'
  const waDigits = tenant.whatsapp.replace(/\D/g, '') || '5511999999999'

  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [serviceType, setServiceType] = useState<ServiceType | ''>('')
  const [airport, setAirport] = useState<AirportCode | ''>('')
  const [hours, setHours] = useState('4')
  const [vehicleId, setVehicleId] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<DaySlot | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [demoKm, setDemoKm] = useState('25')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackError, setFeedbackError] = useState(false)
  const [agendaKey, setAgendaKey] = useState(0)

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

  const estimate = useMemo(() => {
    if (!serviceType || !freightRule) return null
    return calculateFreightEstimate({
      km: Number(demoKm) || 0,
      pricePerKm: Number(freightRule.price_per_km),
      minimumFare: Number(freightRule.minimum_fare),
      pricePerHour: freightRule.price_per_hour
        ? Number(freightRule.price_per_hour)
        : 0,
      hours: Number(hours) || 0,
      airportFlatFee: airportFee,
      serviceType,
    })
  }, [serviceType, freightRule, demoKm, hours, airportFee])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFeedback(null)
    setFeedbackError(false)

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

    const vehicleLabel = selectedVehicle
      ? localizedName(selectedVehicle.name_i18n, locale)
      : '—'

    setSubmitting(true)
    try {
      const reservation = await createReservationWithHold({
        organization_id: tenant.organizationId,
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
        origin_address: origin,
        destination_address: destination,
        service_type: serviceType,
        vehicle_category_id: vehicleId || null,
        airport: serviceType === 'aeroporto' ? airport || null : null,
        slot_start: selectedSlot.slot_start,
        slot_end: selectedSlot.slot_end,
        hours_requested:
          serviceType === 'horas_a_disposicao' ? Number(hours) || null : null,
        estimated_km: Number(demoKm) || null,
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
        name,
        phone,
        email,
        origin,
        destination,
        serviceLabel: t(`reserve.services.${serviceType}`),
        vehicleLabel,
        slotLabel: `${slotLabel} (hold até ${holdLabel})`,
        estimateLabel,
        locale,
      })
      window.open(url, '_blank', 'noopener,noreferrer')

      setFeedback(
        locale === 'en'
          ? `Reservation held until ${holdLabel}.`
          : `Reserva em hold até ${holdLabel}.`,
      )
      setSelectedSlot(null)
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
          required
        />
      </div>
      <div className="itinerary-row">
        <label htmlFor="telefone">{t('reserve.phone')}</label>
        <input
          id="telefone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </div>
      <div className="itinerary-row">
        <label htmlFor="email">{t('reserve.email')}</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="itinerary-row">
        <label htmlFor="km">Km (temp.)</label>
        <input
          id="km"
          type="number"
          min={1}
          step={0.1}
          value={demoKm}
          onChange={(e) => setDemoKm(e.target.value)}
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
          disabled={submitting || tenant.loading || !selectedSlot}
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
