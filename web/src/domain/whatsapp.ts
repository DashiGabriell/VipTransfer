export type WhatsAppReservationSummary = {
  name: string
  phone: string
  email: string
  origin: string
  destination: string
  serviceLabel: string
  vehicleLabel: string
  slotLabel: string
  estimateLabel: string
  locale: 'pt-BR' | 'en'
}

export function buildWhatsAppUrl(
  whatsappE164: string,
  summary: WhatsAppReservationSummary,
): string {
  const digits = whatsappE164.replace(/\D/g, '')
  const lines =
    summary.locale === 'en'
      ? [
          `Hello, I'd like to confirm a transfer reservation.`,
          `Name: ${summary.name}`,
          `Phone: ${summary.phone}`,
          `Email: ${summary.email}`,
          `From: ${summary.origin}`,
          `To: ${summary.destination}`,
          `Service: ${summary.serviceLabel}`,
          `Vehicle: ${summary.vehicleLabel}`,
          `When: ${summary.slotLabel}`,
          `Estimate: ${summary.estimateLabel}`,
        ]
      : [
          `Olá, gostaria de confirmar uma reserva de transfer.`,
          `Nome: ${summary.name}`,
          `Telefone: ${summary.phone}`,
          `E-mail: ${summary.email}`,
          `Origem: ${summary.origin}`,
          `Destino: ${summary.destination}`,
          `Serviço: ${summary.serviceLabel}`,
          `Veículo: ${summary.vehicleLabel}`,
          `Quando: ${summary.slotLabel}`,
          `Estimativa: ${summary.estimateLabel}`,
        ]

  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`
}
