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
