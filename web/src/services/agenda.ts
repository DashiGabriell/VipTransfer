import type { DaySlot } from '../domain/agenda'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export async function listDaySlots(
  organizationId: string,
  day: string,
): Promise<DaySlot[]> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }

  const { data, error } = await supabase.rpc('list_day_slots', {
    p_organization_id: organizationId,
    p_day: day,
  })

  if (error) throw error

  return ((data ?? []) as DaySlot[]).map((row) => ({
    slot_start: row.slot_start,
    slot_end: row.slot_end,
    capacity: Number(row.capacity),
    occupied: Number(row.occupied),
    available: Number(row.available),
    is_past: Boolean(row.is_past),
    is_blackout: Boolean(row.is_blackout),
  }))
}
