import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useTenant } from '../context/TenantContext'
import { calculateFreightEstimate } from '../domain/freight'
import {
  buildSlotRange,
  formatCurrencyBRL,
  holdExpiresAt,
} from '../domain/slots'
import { buildWhatsAppUrl } from '../domain/whatsapp'
import type { AirportCode, ServiceType } from '../types/database'

const SERVICE_TYPES: ServiceType[] = [
  'aeroporto',
  'corporativo',
  'horas_a_disposicao',
  'viagem',
]

const AIRPORTS: AirportCode[] = ['GRU', 'CGH', 'VCP']

/** Demo rates until admin freight_rules are wired */
const DEMO_RATES = {
  pricePerKm: 8,
  minimumFare: 120,
  pricePerHour: 180,
  airportFlatFee: 40,
}

type Props = {
  className?: string
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
  const [vehicleLabel, setVehicleLabel] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [demoKm, setDemoKm] = useState('25')
  const [submitted, setSubmitted] = useState(false)

  const estimate = useMemo(() => {
    if (!serviceType) return null
    return calculateFreightEstimate({
      km: Number(demoKm) || 0,
      pricePerKm: DEMO_RATES.pricePerKm,
      minimumFare: DEMO_RATES.minimumFare,
      pricePerHour: DEMO_RATES.pricePerHour,
      hours: Number(hours) || 0,
      airportFlatFee: DEMO_RATES.airportFlatFee,
      serviceType,
    })
  }, [serviceType, demoKm, hours])

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!serviceType || !date || !time || !estimate) return

    const { slotStart } = buildSlotRange(date, time)
    const expires = holdExpiresAt()
    const estimateLabel = formatCurrencyBRL(estimate.total, locale)

    // Persistence + capacity claim land with Supabase wiring next.
    // Hold semantics are already encoded for the WhatsApp handoff.
    setSubmitted(true)

    if (tenant.whatsapp) {
      const url = buildWhatsAppUrl(tenant.whatsapp, {
        name,
        phone,
        email,
        origin,
        destination,
        serviceLabel: t(`reserve.services.${serviceType}`),
        vehicleLabel: vehicleLabel || '—',
        slotLabel: `${slotStart.toLocaleString(locale)} (hold até ${expires.toLocaleTimeString(locale)})`,
        estimateLabel,
        locale,
      })
      window.open(url, '_blank', 'noopener,noreferrer')
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

        <input
          className={fieldClass}
          placeholder={t('reserve.vehicle')}
          value={vehicleLabel}
          onChange={(e) => setVehicleLabel(e.target.value)}
        />

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

        {/* Temporary km until OpenRouteService is connected */}
        <input
          className={fieldClass}
          type="number"
          min={1}
          step={0.1}
          placeholder="Km (demo até ORS)"
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
          className="mt-2 w-full rounded-lg bg-gray-900 py-3 font-medium text-text-primary-dark transition hover:bg-gray-800"
        >
          {t('reserve.submit')}
        </button>

        {submitted && (
          <p className="text-center text-xs text-primary">
            Hold de 60 min preparado · WhatsApp aberto quando configurado.
          </p>
        )}
      </form>
    </div>
  )
}
