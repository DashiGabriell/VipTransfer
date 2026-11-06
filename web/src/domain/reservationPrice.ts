import type { Reservation } from '../types/database'

/** Preço real negociado, quando definido. */
export function hasOverridePrice(
  reservation: Pick<Reservation, 'override_price'>,
): boolean {
  const n = Number(reservation.override_price)
  return Number.isFinite(n) && n > 0
}

/** Valor usado no financeiro: override obrigatório; estimado só como referência de UI. */
export function reservationDisplayPrice(
  reservation: Pick<Reservation, 'override_price' | 'estimated_price'>,
): number | null {
  if (hasOverridePrice(reservation)) {
    return Number(reservation.override_price)
  }
  const suggested = Number(reservation.estimated_price)
  return Number.isFinite(suggested) ? suggested : null
}

export function formatReservationMoney(
  price: number | null | undefined,
  locale = 'pt-BR',
): string {
  if (price == null || !Number.isFinite(Number(price))) return '—'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(price))
}
