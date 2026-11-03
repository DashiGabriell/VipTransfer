import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useTenant } from '../context/TenantContext'
import { calculateFreightEstimate } from '../domain/freight'
import { buildSlotRange, formatCurrencyBRL } from '../domain/slots'
import { buildWhatsAppUrl } from '../domain/whatsapp'
import {
  createReservationWithHold,
  notifyReservationWebhook,
  SlotUnavailableError,
} from '../services/reservations'
import { pickFreightRule } from '../services/tenantCatalog'
import type { AirportCode, ServiceType } from '../types/database'

const SERVICE_TYPES: ServiceType[] = [
  'aeroporto',
  'corporativo',
  'horas_a_disposicao',
  'viagem',
]

const AIRPORTS: AirportCode[] = ['GRU', 'CGH', 'VCP']

type Props = {
  className?: string
}

function localizedName(
  name: { pt?: string; en?: string },
  locale: string,
): string {
  if (locale.startsWith('en')) return name.en || name.pt || '—'
  return name.pt || name.en || '—'
}

export function ReservationForm({ className = '' }: Props) {
  const { t, i18n } = useTranslation()
  const tenant = useTenant()
  const locale = i18n.language.startsWith('en') ? 'en' : 'pt-BR'

  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [serviceType, setServiceType] = useState<ServiceType | ''>('')
  const [airport, setAirport] = useState<AirportCode | ''>('')
  const [hours, setHours] = useState('4')
  const [vehicleId, setVehicleId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [demoKm, setDemoKm] = useState('25')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackError, setFeedbackError] = useState(false)

  const vehicles = tenant.catalog?.vehicles ?? []
  const freightRules = tenant.catalog?.freightRules ?? []
  const airportFees = tenant.catalog?.airportFees ?? []
  const slotMinutes = tenant.catalog?.capacity?.slot_minutes ?? 30

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

    if (!serviceType || !date || !time || !estimate) return

    if (!tenant.organizationId) {
      setFeedbackError(true)
      setFeedback(
        tenant.loading
          ? 'Carregando organização…'
          : 'Organização não disponível. Verifique o Supabase.',
      )
      return
    }

    const { slotStart, slotEnd } = buildSlotRange(date, time, slotMinutes)
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
        slot_start: slotStart.toISOString(),
        slot_end: slotEnd.toISOString(),
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

      if (tenant.whatsapp) {
        const url = buildWhatsAppUrl(tenant.whatsapp, {
          name,
          phone,
          email,
          origin,
          destination,
          serviceLabel: t(`reserve.services.${serviceType}`),
          vehicleLabel,
          slotLabel: `${slotStart.toLocaleString(locale)} (hold até ${holdLabel})`,
          estimateLabel,
          locale,
        })
        window.open(url, '_blank', 'noopener,noreferrer')
      }

      setFeedback(
        locale === 'en'
          ? `Reservation held until ${holdLabel}.`
          : `Reserva em hold até ${holdLabel}.`,
      )
    } catch (err) {
      setFeedbackError(true)
      if (err instanceof SlotUnavailableError) {
        setFeedback(
          locale === 'en'
            ? 'This time slot is unavailable. Please choose another.'
            : 'Horário indisponível. Escolha outro período.',
        )
      } else {
        setFeedback(err instanceof Error ? err.message : 'Falha ao reservar')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const fieldClass =
    'w-full border-0 border-b border-border-light bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-primary focus:ring-0 placeholder:text-text-secondary-light'

  return (
    <div
      className={`w-full max-w-md rounded-3xl bg-surface-light p-6 shadow-2xl md:p-8 ${className}`}
    >
      <div className="mb-6 border-b border-border-light pb-4">
        <h3 className="text-xl font-bold text-primary">{t('reserve.title')}</h3>
        <p className="mt-1 text-xs text-text-secondary-light">
          {t('reserve.subtitle')}
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <input
          className={fieldClass}
          placeholder={t('reserve.origin')}
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          required
        />
        <input
          className={fieldClass}
          placeholder={t('reserve.destination')}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          required
        />

        <select
          className={`${fieldClass} text-primary`}
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value as ServiceType | '')}
          required
        >
          <option value="" disabled>
            {t('reserve.serviceType')}
          </option>
          {SERVICE_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`reserve.services.${type}`)}
            </option>
          ))}
        </select>

        {serviceType === 'aeroporto' && (
          <select
            className={`${fieldClass} text-primary`}
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
        )}

        {serviceType === 'horas_a_disposicao' && (
          <input
            className={fieldClass}
            type="number"
            min={1}
            step={0.5}
            placeholder={t('reserve.hours')}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            required
          />
        )}

        <select
          className={`${fieldClass} text-primary`}
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

        <div className="flex space-x-4">
          <input
            className={`${fieldClass} w-1/2`}
            type="date"
            aria-label={t('reserve.date')}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <input
            className={`${fieldClass} w-1/2`}
            type="time"
            step={1800}
            aria-label={t('reserve.time')}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>

        <input
          className={fieldClass}
          placeholder={t('reserve.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className={fieldClass}
          type="tel"
          placeholder={t('reserve.phone')}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <input
          className={fieldClass}
          type="email"
          placeholder={t('reserve.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          className={fieldClass}
          type="number"
          min={1}
          step={0.1}
          placeholder="Km (temporário até OpenRouteService)"
          value={demoKm}
          onChange={(e) => setDemoKm(e.target.value)}
        />

        {estimate && (
          <div className="rounded-lg bg-background-light px-3 py-2 text-sm">
            <div className="font-semibold text-primary">
              {t('reserve.estimate')}:{' '}
              {formatCurrencyBRL(estimate.total, locale)}
            </div>
            <p className="text-xs text-text-secondary-light">
              {t('reserve.estimateHint')}
            </p>
          </div>
        )}

        <p className="text-xs text-text-secondary-light">{t('reserve.holdHint')}</p>

        <button
          type="submit"
          disabled={submitting || tenant.loading}
          className="mt-2 w-full rounded-lg bg-gray-900 py-3 font-medium text-text-primary-dark transition hover:bg-gray-800 disabled:opacity-60"
        >
          {submitting ? '…' : t('reserve.submit')}
        </button>

        {feedback && (
          <p
            className={`text-center text-xs ${feedbackError ? 'text-red-600' : 'text-primary'}`}
          >
            {feedback}
          </p>
        )}
      </form>
    </div>
  )
}
