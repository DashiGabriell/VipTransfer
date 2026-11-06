import type { Reservation } from '../types/database'

/** Arredonda para centavos (BRL). */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

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
    return roundMoney(Number(reservation.override_price))
  }
  const suggested = Number(reservation.estimated_price)
  return Number.isFinite(suggested) ? roundMoney(suggested) : null
}

export function formatReservationMoney(
  price: number | null | undefined,
  locale = 'pt-BR',
): string {
  if (price == null || !Number.isFinite(Number(price))) return '—'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundMoney(Number(price)))
}

/** Rascunho do input: sempre 2 casas, vírgula decimal (pt-BR). */
export function formatMoneyDraft(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return ''
  return roundMoney(Number(n)).toFixed(2).replace('.', ',')
}

/** Valor inicial do campo preço real (override ou sugerido arredondado). */
export function initialMoneyDraft(
  reservation: Pick<Reservation, 'override_price' | 'estimated_price'>,
): string {
  if (hasOverridePrice(reservation)) {
    return formatMoneyDraft(reservation.override_price)
  }
  if (reservation.estimated_price != null) {
    return formatMoneyDraft(reservation.estimated_price)
  }
  return ''
}

/**
 * Digitação de moeda BRL: só dígitos + uma vírgula/ponto, no máx. 2 decimais.
 * Aceita colar "1.234,56" / "1234.56".
 */
export function sanitizeMoneyTyping(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  // Colagem com milhar + decimal pt-BR
  if (/^\d{1,3}(\.\d{3})+,\d{0,2}$/.test(trimmed)) {
    return trimmed.replace(/\./g, '')
  }
  // Colagem com milhar US + decimal
  if (/^\d{1,3}(,\d{3})+\.\d{0,2}$/.test(trimmed)) {
    return trimmed.replace(/,/g, '').replace('.', ',')
  }

  let out = ''
  let sep = false
  let decimals = 0
  for (const ch of trimmed.replace(/\s/g, '')) {
    if (ch >= '0' && ch <= '9') {
      if (sep) {
        if (decimals >= 2) continue
        decimals += 1
      }
      out += ch
      continue
    }
    if ((ch === ',' || ch === '.') && !sep) {
      sep = true
      out += ','
    }
  }
  return out
}

/** Converte rascunho do input em número com 2 casas (ou null se inválido). */
export function parseMoneyDraft(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, '')
  if (!cleaned) return null

  let normalized = cleaned
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // 1.234,56 → milhar ponto, decimal vírgula
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,234.56
      normalized = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.')
  }

  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  return roundMoney(n)
}
