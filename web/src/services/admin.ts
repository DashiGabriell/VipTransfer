import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type {
  AirportCode,
  FreightRule,
  OrgRole,
  Reservation,
  ReservationStatus,
  ServiceType,
  VehicleCategory,
} from '../types/database'

export type Membership = {
  id: string
  organization_id: string
  user_id: string
  role: OrgRole
}

export async function listMyMemberships(): Promise<Membership[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('organization_members')
    .select('id, organization_id, user_id, role')
  if (error) throw error
  return (data ?? []) as Membership[]
}

export async function claimOrgOwner(slug: string): Promise<Membership> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase.rpc('claim_org_owner', {
    p_slug: slug,
  })
  if (error) throw error
  return data as Membership
}

export async function listReservations(
  organizationId: string,
  status?: ReservationStatus | 'all',
): Promise<Reservation[]> {
  if (!supabase) throw new Error('Supabase não configurado')
  let query = supabase
    .from('reservations')
    .select('*')
    .eq('organization_id', organizationId)
    .order('slot_start', { ascending: true })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Reservation[]
}

export async function confirmReservation(id: string): Promise<Reservation> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase.rpc('confirm_reservation', {
    p_reservation_id: id,
  })
  if (error) throw error
  return data as Reservation
}

export async function cancelReservation(id: string): Promise<Reservation> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase.rpc('cancel_reservation', {
    p_reservation_id: id,
  })
  if (error) throw error
  return data as Reservation
}

export async function createVehicleCategory(input: {
  organization_id: string
  name_pt: string
  name_en: string
  is_armored?: boolean
  passenger_capacity?: number | null
  luggage_capacity?: number | null
}): Promise<VehicleCategory> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase
    .from('vehicle_categories')
    .insert({
      organization_id: input.organization_id,
      name_i18n: { pt: input.name_pt, en: input.name_en },
      description_i18n: { pt: '', en: '' },
      is_armored: input.is_armored ?? false,
      passenger_capacity: input.passenger_capacity ?? null,
      luggage_capacity: input.luggage_capacity ?? null,
      active: true,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as VehicleCategory
}

export async function listVehiclesAdmin(
  organizationId: string,
): Promise<VehicleCategory[]> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase
    .from('vehicle_categories')
    .select('*')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as VehicleCategory[]
}

export async function upsertFreightRule(input: {
  id?: string
  organization_id: string
  price_per_km: number
  minimum_fare: number
  price_per_hour: number
  vehicle_category_id?: string | null
  service_type?: ServiceType | null
}): Promise<FreightRule> {
  if (!supabase) throw new Error('Supabase não configurado')

  if (input.id) {
    const { data, error } = await supabase
      .from('freight_rules')
      .update({
        price_per_km: input.price_per_km,
        minimum_fare: input.minimum_fare,
        price_per_hour: input.price_per_hour,
        vehicle_category_id: input.vehicle_category_id ?? null,
        service_type: input.service_type ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .select('*')
      .single()
    if (error) throw error
    return data as FreightRule
  }

  const { data, error } = await supabase
    .from('freight_rules')
    .insert({
      organization_id: input.organization_id,
      price_per_km: input.price_per_km,
      minimum_fare: input.minimum_fare,
      price_per_hour: input.price_per_hour,
      vehicle_category_id: input.vehicle_category_id ?? null,
      service_type: input.service_type ?? null,
      active: true,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as FreightRule
}

export async function listFreightRulesAdmin(
  organizationId: string,
): Promise<FreightRule[]> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase
    .from('freight_rules')
    .select('*')
    .eq('organization_id', organizationId)
  if (error) throw error
  return (data ?? []) as FreightRule[]
}

export async function updateAirportFee(input: {
  organization_id: string
  airport: AirportCode
  flat_fee: number
}): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase
    .from('airport_fees')
    .update({ flat_fee: input.flat_fee, updated_at: new Date().toISOString() })
    .eq('organization_id', input.organization_id)
    .eq('airport', input.airport)
  if (error) throw error
}

export function canOperate(role: OrgRole | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'operador'
}

export function canAdmin(role: OrgRole | null): boolean {
  return role === 'owner' || role === 'admin'
}

export function assertSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }
}
