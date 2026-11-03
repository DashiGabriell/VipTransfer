export type FreightInput = {
  km: number
  pricePerKm: number
  minimumFare: number
  airportFlatFee?: number
  hours?: number
  pricePerHour?: number
  serviceType: 'aeroporto' | 'corporativo' | 'horas_a_disposicao' | 'viagem'
}

export type FreightResult = {
  distanceComponent: number
  hourlyComponent: number
  airportFee: number
  total: number
}

/**
 * v1 formula: max(minimum, km * pricePerKm) + airport fee
 * + hours * pricePerHour when service is horas_a_disposicao
 */
export function calculateFreightEstimate(input: FreightInput): FreightResult {
  const km = Math.max(0, input.km)
  const distanceComponent = Math.max(
    input.minimumFare,
    km * input.pricePerKm,
  )

  const hourlyComponent =
    input.serviceType === 'horas_a_disposicao'
      ? Math.max(0, input.hours ?? 0) * Math.max(0, input.pricePerHour ?? 0)
      : 0

  const airportFee =
    input.serviceType === 'aeroporto' ? Math.max(0, input.airportFlatFee ?? 0) : 0

  return {
    distanceComponent,
    hourlyComponent,
    airportFee,
    total: distanceComponent + hourlyComponent + airportFee,
  }
}
