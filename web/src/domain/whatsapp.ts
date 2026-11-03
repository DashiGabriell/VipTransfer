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
  estimateLabel: string
  /** Total driving distance in km, when measured. */
  distanceKm?: number | null
  locale: 'pt-BR' | 'en'
}

export function buildWhatsAppUrl(
  whatsappE164: string,
  summary: WhatsAppReservationSummary,
): string {
  const digits = whatsappE164.replace(/\D/g, '')
  const stops = (summary.stops ?? []).map((s) => s.trim()).filter(Boolean)
  const stopLines =
    summary.locale === 'en'
      ? stops.map((s, i) => `Stop ${i + 1}: ${s}`)
      : stops.map((s, i) => `Parada ${i + 1}: ${s}`)

  const lines =
    summary.locale === 'en'
      ? [
          `Hello, I'd like to confirm a transfer reservation.`,
          `Name: ${summary.name}`,
          `Phone: ${summary.phone}`,
          `Email: ${summary.email}`,
          `From: ${summary.origin}`,
          ...stopLines,
          `To: ${summary.destination}`,
          `Service: ${summary.serviceLabel}`,
          `Vehicle: ${summary.vehicleLabel}`,
          `When: ${summary.slotLabel}`,
          ...(summary.distanceKm != null
            ? [`Distance: ${summary.distanceKm} km`]
            : []),
          `Estimate: ${summary.estimateLabel}`,
        ]
      : [
          `Olá, gostaria de confirmar uma reserva de transfer.`,
          `Nome: ${summary.name}`,
          `Telefone: ${summary.phone}`,
          `E-mail: ${summary.email}`,
          `Origem: ${summary.origin}`,
          ...stopLines,
          `Destino: ${summary.destination}`,
          `Serviço: ${summary.serviceLabel}`,
          `Veículo: ${summary.vehicleLabel}`,
          `Quando: ${summary.slotLabel}`,
          ...(summary.distanceKm != null
            ? [`Distância: ${summary.distanceKm} km`]
            : []),
          `Estimativa: ${summary.estimateLabel}`,
        ]

  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`
}
