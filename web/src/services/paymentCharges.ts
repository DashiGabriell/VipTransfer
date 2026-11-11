import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { PaymentCharge } from '../types/database'

function assertClient() {
  if (!supabase) throw new Error('Supabase não configurado')
  return supabase
}

export type CreateAsaasCheckoutResult = {
  charge: PaymentCharge
  checkout_url: string | null
  reused?: boolean
  stub?: boolean
  error?: string
}

async function extractFunctionsErrorMessage(
  error: unknown,
  data: unknown,
): Promise<string> {
  const fromData =
    data &&
    typeof data === 'object' &&
    'error' in data &&
    typeof (data as { error: unknown }).error === 'string'
      ? (data as { error: string }).error
      : null
  if (fromData) return fromData

  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (body && typeof body === 'object' && 'error' in body) {
        const e = (body as { error: unknown }).error
        if (typeof e === 'string' && e.trim()) return e
      }
    } catch {
      try {
        const text = await error.context.text()
        if (text.trim()) return text.slice(0, 400)
      } catch {
        /* ignore */
      }
    }
  }

  if (error instanceof Error && error.message.trim()) return error.message
  return 'ASAAS_CHECKOUT_FAILED'
}

/**
 * Cria Checkout Asaas para uma cobrança já emitida.
 * Se a chave ainda não estiver configurada, devolve stub (sem URL).
 */
export async function createAsaasCheckoutForCharge(
  chargeId: string,
): Promise<CreateAsaasCheckoutResult> {
  const client = assertClient()
  const { data, error } = await client.functions.invoke(
    'create-asaas-checkout',
    { body: { charge_id: chargeId } },
  )

  const payload = (data ?? null) as {
    charge?: PaymentCharge
    checkout_url?: string
    reused?: boolean
    error?: string
  } | null

  if (payload?.error === 'ASAAS_NOT_CONFIGURED') {
    return {
      charge: payload.charge ?? ({ id: chargeId } as PaymentCharge),
      checkout_url: null,
      stub: true,
      error: 'ASAAS_NOT_CONFIGURED',
    }
  }

  if (payload?.error) {
    throw new Error(payload.error)
  }

  if (error) {
    const msg = await extractFunctionsErrorMessage(error, data)
    if (msg.includes('ASAAS_NOT_CONFIGURED')) {
      return {
        charge: { id: chargeId } as PaymentCharge,
        checkout_url: null,
        stub: true,
        error: 'ASAAS_NOT_CONFIGURED',
      }
    }
    throw new Error(msg || 'ASAAS_CHECKOUT_FAILED')
  }

  if (!payload?.charge) {
    throw new Error('ASAAS_CHECKOUT_FAILED')
  }

  return {
    charge: payload.charge,
    checkout_url: payload.checkout_url ?? payload.charge.checkout_url,
    reused: payload.reused,
  }
}

export async function listPaymentChargesForReservation(
  reservationId: string,
): Promise<PaymentCharge[]> {
  const client = assertClient()
  const { data, error } = await client
    .from('payment_charges')
    .select('*')
    .eq('reservation_id', reservationId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PaymentCharge[]
}

export async function getReservationDepositAmount(
  reservationId: string,
): Promise<number> {
  const client = assertClient()
  const { data, error } = await client.rpc('reservation_deposit_amount', {
    p_reservation_id: reservationId,
  })
  if (error) throw error
  const n = Number(data)
  return Number.isFinite(n) ? n : 0
}

export async function emitDepositCharge(
  reservationId: string,
): Promise<PaymentCharge> {
  const client = assertClient()
  const { data, error } = await client.rpc('emit_deposit_charge', {
    p_reservation_id: reservationId,
  })
  if (error) throw error
  return data as PaymentCharge
}

export async function emitRemainingCharge(input: {
  reservationId: string
  amount: number
  justification?: string | null
}): Promise<PaymentCharge> {
  const client = assertClient()
  const { data, error } = await client.rpc('emit_remaining_charge', {
    p_reservation_id: input.reservationId,
    p_amount: input.amount,
    p_justification: input.justification?.trim() || null,
  })
  if (error) throw error
  return data as PaymentCharge
}

export async function markPaymentChargePaid(
  chargeId: string,
): Promise<PaymentCharge> {
  const client = assertClient()
  const { data, error } = await client.rpc('mark_payment_charge_paid', {
    p_charge_id: chargeId,
  })
  if (error) throw error
  return data as PaymentCharge
}
