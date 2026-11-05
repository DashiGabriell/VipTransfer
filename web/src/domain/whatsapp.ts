export type WhatsAppReservationSummary = {
  name: string
  phone: string
  email: string
  origin: string
  destination: string
  stops?: string[]
  serviceLabel: string
  vehicleLabel: string
  slotLabel: string
  /** Total driving distance in km, when measured. */
  distanceKm?: number | null
  hoursRequested?: number | null
  airport?: string | null
  serviceNotes?: string | null
  locale: 'pt-BR' | 'en'
}

export function buildWhatsAppUrl(
  whatsappE164: string,
  summary: WhatsAppReservationSummary,
): string {
  const digits = whatsappE164.replace(/\D/g, '')
  const stops = (summary.stops ?? []).map((s) => s.trim()).filter(Boolean)
  const notes = (summary.serviceNotes ?? '').trim()
  const destination = summary.destination.trim()
  const en = summary.locale === 'en'

  const stopLines = en
    ? stops.map((s, i) => `Stop ${i + 1}: ${s}`)
    : stops.map((s, i) => `Parada ${i + 1}: ${s}`)

  const lines = en
    ? [
        `Hello, I'd like to request a transfer with JMD.`,
        `Name: ${summary.name}`,
        `Phone: ${summary.phone}`,
        `Email: ${summary.email}`,
        `From: ${summary.origin}`,
        ...stopLines,
        ...(destination ? [`To: ${destination}`] : []),
        `Service: ${summary.serviceLabel}`,
        ...(summary.airport ? [`Airport: ${summary.airport}`] : []),
        ...(summary.hoursRequested != null
          ? [`Hours on demand: ${summary.hoursRequested}`]
          : []),
        ...(notes ? [`Details: ${notes}`] : []),
        `Vehicle: ${summary.vehicleLabel}`,
        `When: ${summary.slotLabel}`,
        ...(summary.distanceKm != null
          ? [`Distance: ${summary.distanceKm} km`]
          : []),
        `Please confirm availability and the fare on WhatsApp.`,
      ]
    : [
        `Olá, gostaria de solicitar um transfer com a JMD.`,
        `Nome: ${summary.name}`,
        `Telefone: ${summary.phone}`,
        `E-mail: ${summary.email}`,
        `Origem: ${summary.origin}`,
        ...stopLines,
        ...(destination ? [`Destino: ${destination}`] : []),
        `Serviço: ${summary.serviceLabel}`,
        ...(summary.airport ? [`Aeroporto: ${summary.airport}`] : []),
        ...(summary.hoursRequested != null
          ? [`Horas à disposição: ${summary.hoursRequested}`]
          : []),
        ...(notes ? [`Detalhes: ${notes}`] : []),
        `Veículo: ${summary.vehicleLabel}`,
        `Quando: ${summary.slotLabel}`,
        ...(summary.distanceKm != null
          ? [`Distância: ${summary.distanceKm} km`]
          : []),
        `Por favor, confirmem disponibilidade e o valor pelo WhatsApp.`,
      ]

  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`
}

/** Normalize BR phone / WhatsApp to digits with country code 55 when missing. */
export function toWhatsAppDigits(phone: string): string | null {
  let digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  if (digits.length >= 12) return digits
  return null
}

export type DriverDemandWhatsAppSummary = {
  driverFirstName: string
  origin: string
  destination: string
  stops?: string[]
  serviceLabel: string
  vehicleLabel?: string | null
  slotLabel: string
  distanceKm?: number | null
  hoursRequested?: number | null
  airport?: string | null
  serviceNotes?: string | null
  offersUrl: string
  locale: 'pt-BR' | 'en'
}

/** Alert the driver on WhatsApp after admin dispatch — no customer name, no price. */
export function buildDriverDemandWhatsAppUrl(
  driverPhone: string,
  summary: DriverDemandWhatsAppSummary,
): string | null {
  const digits = toWhatsAppDigits(driverPhone)
  if (!digits) return null

  const stops = (summary.stops ?? []).map((s) => s.trim()).filter(Boolean)
  const notes = (summary.serviceNotes ?? '').trim()
  const destination = summary.destination.trim()
  const vehicle = (summary.vehicleLabel ?? '').trim()
  const en = summary.locale === 'en'
  const first = summary.driverFirstName.trim() || (en ? 'driver' : 'motorista')

  const stopLines = en
    ? stops.map((s, i) => `Stop ${i + 1}: ${s}`)
    : stops.map((s, i) => `Parada ${i + 1}: ${s}`)

  const lines = en
    ? [
        `Hi, ${first}! JMD sent you a new job offer.`,
        `When: ${summary.slotLabel}`,
        `Service: ${summary.serviceLabel}`,
        ...(vehicle ? [`Vehicle: ${vehicle}`] : []),
        `From: ${summary.origin}`,
        ...stopLines,
        ...(destination ? [`To: ${destination}`] : []),
        ...(summary.airport ? [`Airport: ${summary.airport}`] : []),
        ...(summary.hoursRequested != null
          ? [`Hours on demand: ${summary.hoursRequested}`]
          : []),
        ...(notes ? [`Details: ${notes}`] : []),
        ...(summary.distanceKm != null
          ? [`Distance: ${summary.distanceKm} km`]
          : []),
        `Open your offers and respond in the app:`,
        summary.offersUrl,
      ]
    : [
        `Olá, ${first}! A JMD enviou uma nova demanda para você.`,
        `Quando: ${summary.slotLabel}`,
        `Serviço: ${summary.serviceLabel}`,
        ...(vehicle ? [`Veículo: ${vehicle}`] : []),
        `Origem: ${summary.origin}`,
        ...stopLines,
        ...(destination ? [`Destino: ${destination}`] : []),
        ...(summary.airport ? [`Aeroporto: ${summary.airport}`] : []),
        ...(summary.hoursRequested != null
          ? [`Horas à disposição: ${summary.hoursRequested}`]
          : []),
        ...(notes ? [`Detalhes: ${notes}`] : []),
        ...(summary.distanceKm != null
          ? [`Distância: ${summary.distanceKm} km`]
          : []),
        `Abra suas ofertas e responda no app:`,
        summary.offersUrl,
      ]

  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`
}
