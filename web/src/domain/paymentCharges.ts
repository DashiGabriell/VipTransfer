import type {
  PaymentCharge,
  PaymentChargeKind,
  PaymentChargeStatus,
  Reservation,
} from '../types/database'
import { hasOverridePrice, roundMoney } from './reservationPrice'

export type DepositConfirmGate =
  | 'ok'
  | 'deposit_pending'
  | 'deposit_required'

export const ACTIVE_CHARGE_STATUSES: PaymentChargeStatus[] = [
  'emitida',
  'paga',
]

/** Sem linha ativa = ainda não há cobrança desse tipo. */
export function findActiveCharge(
  charges: PaymentCharge[],
  kind: PaymentChargeKind,
): PaymentCharge | null {
  return (
    charges.find(
      (c) =>
        c.kind === kind && ACTIVE_CHARGE_STATUSES.includes(c.status),
    ) ?? null
  )
}

/**
 * Espelha `reservation_deposit_gate` no SQL:
 * - sinal emitido ⇒ bloqueia
 * - preço real definido sem sinal pago ⇒ bloqueia
 */
export function depositConfirmGate(
  reservation: Pick<Reservation, 'override_price'>,
  charges: PaymentCharge[],
): DepositConfirmGate {
  const deposit = findActiveCharge(charges, 'sinal')
  if (deposit?.status === 'emitida') return 'deposit_pending'
  if (hasOverridePrice(reservation) && deposit?.status !== 'paga') {
    return 'deposit_required'
  }
  return 'ok'
}

export function isChargePaid(charge: PaymentCharge | null | undefined): boolean {
  return charge?.status === 'paga'
}

/** Restante sugerido: preço real − sinal (pago ou emitido). */
export function suggestedRemainingAmount(
  realPrice: number,
  depositAmount: number,
): number {
  const remaining = roundMoney(Number(realPrice) || 0) - roundMoney(Number(depositAmount) || 0)
  return remaining > 0 ? roundMoney(remaining) : 0
}

/** Ajuste do restante exige justificativa quando difere do sugerido. */
export function remainingNeedsJustification(
  amount: number,
  suggested: number,
): boolean {
  return roundMoney(amount) !== roundMoney(suggested)
}

export function isValidAdjustmentJustification(raw: string): boolean {
  const t = raw.trim()
  return t.length >= 3 && t.length <= 2000
}
