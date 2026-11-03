import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { CreateReservationInput, Reservation } from '../types/database'

export class SlotUnavailableError extends Error {
  constructor(message = 'SLOT_UNAVAILABLE') {
    super(message)
    this.name = 'SlotUnavailableError'
  }
}

export async function createReservationWithHold(
  input: CreateReservationInput,
): Promise<Reservation> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }

  const { data, error } = await supabase.rpc('create_reservation_with_hold', {
    p_organization_id: input.organization_id,
    p_customer_name: input.customer_name,
    p_customer_phone: input.customer_phone,
    p_customer_email: input.customer_email,
    p_origin_address: input.origin_address,
    p_destination_address: input.destination_address,
    p_service_type: input.service_type,
    p_slot_start: input.slot_start,
    p_slot_end: input.slot_end,
    p_vehicle_category_id: input.vehicle_category_id ?? null,
    p_airport: input.airport ?? null,
    p_hours_requested: input.hours_requested ?? null,
    p_estimated_km: input.estimated_km ?? null,
    p_estimated_price: input.estimated_price ?? null,
    p_locale: input.locale ?? 'pt-BR',
    p_source: input.source ?? 'web',
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('SLOT_UNAVAILABLE')) {
      throw new SlotUnavailableError()
    }
    throw error
  }

  if (!data) {
    throw new Error('Reserva não retornada pelo servidor')
  }

  return data as Reservation
}

export async function notifyReservationWebhook(
  reservation: Reservation,
): Promise<void> {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined
  if (!url) return

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'reservation.created',
        reservation,
      }),
    })
  } catch {
    // Non-blocking: reservation already persisted
  }
}
