import type {
  AirportCode,
  AirportFee,
  FreightRule,
  ServiceType,
} from '../types/database'

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

function pickRule(
  rules: FreightRule[],
  opts: { vehicleCategoryId?: string | null; serviceType?: string | null },
): FreightRule | null {
  if (!rules.length) return null

  const byVehicleAndService = rules.find(
    (r) =>
      r.vehicle_category_id === opts.vehicleCategoryId &&
      r.service_type === opts.serviceType,
  )
  if (byVehicleAndService) return byVehicleAndService

  const byVehicle = rules.find(
    (r) =>
      r.vehicle_category_id === opts.vehicleCategoryId &&
      r.service_type == null,
  )
  if (byVehicle) return byVehicle

  const byService = rules.find(
    (r) =>
      r.vehicle_category_id == null && r.service_type === opts.serviceType,
  )
  if (byService) return byService

  return (
    rules.find((r) => r.vehicle_category_id == null && r.service_type == null) ??
    rules[0] ??
    null
  )
}

/** Estimativa interna persistida em `estimated_price` — não mostrar no formulário público. */
export function computeInternalEstimatedPrice(opts: {
  serviceType: ServiceType
  km: number | null
  hours: number | null
  airport: AirportCode | null
  vehicleCategoryId: string | null
  rules: FreightRule[]
  airportFees: AirportFee[]
}): number | null {
  if (opts.serviceType === 'concierge') return null

  const rule = pickRule(opts.rules, {
    vehicleCategoryId: opts.vehicleCategoryId,
    serviceType: opts.serviceType,
  })
  if (!rule) return null

  if (opts.serviceType === 'ponto_a_b' && (opts.km == null || opts.km < 0)) {
    return null
  }

  if (
    opts.serviceType === 'a_disposicao' &&
    !(opts.hours != null && opts.hours > 0) &&
    !(opts.km != null && opts.km > 0)
  ) {
    return null
  }

  const airportFlatFee = opts.airport
    ? Math.max(
        0,
        Number(
          opts.airportFees.find((f) => f.airport === opts.airport)?.flat_fee ??
            0,
        ),
      )
    : 0

  const result = calculateFreightEstimate({
    km: Math.max(0, opts.km ?? 0),
    pricePerKm: Number(rule.price_per_km) || 0,
    minimumFare: Number(rule.minimum_fare) || 0,
    airportFlatFee,
    hours: opts.hours ?? 0,
    pricePerHour: Number(rule.price_per_hour) || 0,
    serviceType: opts.serviceType,
  })

  if (!(result.total > 0)) return null
  return Math.round(result.total * 100) / 100
}
