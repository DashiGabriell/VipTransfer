import type { ServiceType } from '../types/database'

export type FreightInput = {
  km: number
  pricePerKm: number
  minimumFare: number
  airportFlatFee?: number
  hours?: number
  pricePerHour?: number
  serviceType: ServiceType
}

export type FreightResult = {
  distanceComponent: number
  hourlyComponent: number
  airportFee: number
  total: number
}

/**
 * Referência interna (admin / operação). Não exibida ao cliente —
 * o valor fecha no WhatsApp com o motorista.
 *
 * ponto_a_b: max(mínimo, km × R$/km) + taxa aeroporto (se houver)
 * a_disposicao: horas × R$/hora (+ componente de km se houver)
 * concierge: sem fórmula automática (total 0)
 */
export function calculateFreightEstimate(input: FreightInput): FreightResult {
  if (input.serviceType === 'concierge') {
    return {
      distanceComponent: 0,
      hourlyComponent: 0,
      airportFee: 0,
      total: 0,
    }
  }

  const km = Math.max(0, input.km)
  const distanceComponent = Math.max(
    input.minimumFare,
    km * input.pricePerKm,
  )

  const hourlyComponent =
    input.serviceType === 'a_disposicao'
      ? Math.max(0, input.hours ?? 0) * Math.max(0, input.pricePerHour ?? 0)
      : 0

  const airportFee = Math.max(0, input.airportFlatFee ?? 0)

  const total =
    input.serviceType === 'a_disposicao'
      ? hourlyComponent + (km > 0 ? distanceComponent : 0)
      : distanceComponent + airportFee

  return {
    distanceComponent,
    hourlyComponent,
    airportFee,
    total,
  }
}
