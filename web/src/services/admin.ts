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

export type Profile = {
  id: string
  full_name: string | null
  preferred_locale: string
  created_at?: string
  updated_at?: string
}

export type NotificationEventType =
  | 'reservation_hold'
  | 'reservation_confirmed'
  | 'reservation_cancelled'
  | 'hold_expired'

export type NotificationPreferences = {
  user_id: string
  email_enabled: boolean
  in_app_enabled: boolean
  whatsapp_enabled: boolean
  event_reservation_hold: boolean
  event_reservation_confirmed: boolean
  event_reservation_cancelled: boolean
  event_hold_expired: boolean
  updated_at?: string
}

export type StaffNotification = {
  id: string
  user_id: string
  organization_id: string
  event_type: NotificationEventType
  title: string
  body: string | null
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export const DEFAULT_NOTIFICATION_PREFS: Omit<
  NotificationPreferences,
  'user_id' | 'updated_at'
> = {
  email_enabled: true,
  in_app_enabled: true,
  whatsapp_enabled: false,
  event_reservation_hold: true,
  event_reservation_confirmed: true,
  event_reservation_cancelled: true,
  event_hold_expired: true,
}

export type AvailabilityWindow = {
  id: string
  organization_id: string
  day_of_week: number | null
  specific_date: string | null
  start_time: string
  end_time: string
  is_blackout: boolean
  capacity_override: number | null
  created_at?: string
}

export async function getMyProfile(): Promise<Profile | null> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, preferred_locale, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export async function updateMyProfile(input: {
  full_name: string
  preferred_locale: string
}): Promise<Profile> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error('NOT_AUTHENTICATED')
  const payload = {
    id: userId,
    full_name: input.full_name.trim(),
    preferred_locale: input.preferred_locale,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('id, full_name, preferred_locale, created_at, updated_at')
    .single()
  if (error) throw error
  return data as Profile
}

export async function getMyNotificationPreferences(): Promise<NotificationPreferences> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error('NOT_AUTHENTICATED')

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error

  if (data) return data as NotificationPreferences

  const { data: inserted, error: insertError } = await supabase
    .from('notification_preferences')
    .upsert(
      { user_id: userId, ...DEFAULT_NOTIFICATION_PREFS },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single()
  if (insertError) throw insertError
  return inserted as NotificationPreferences
}

export async function updateMyNotificationPreferences(
  input: Partial<Omit<NotificationPreferences, 'user_id' | 'updated_at'>>,
): Promise<NotificationPreferences> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error('NOT_AUTHENTICATED')

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: userId,
        ...DEFAULT_NOTIFICATION_PREFS,
        ...input,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single()
  if (error) throw error
  return data as NotificationPreferences
}

export async function listMyNotifications(
  limit = 40,
): Promise<StaffNotification[]> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error('NOT_AUTHENTICATED')

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as StaffNotification[]
}

export async function markNotificationRead(
  notificationId: string,
): Promise<StaffNotification> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  })
  if (error) throw error
  return data as StaffNotification
}

export async function markAllNotificationsRead(): Promise<number> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase.rpc('mark_all_notifications_read')
  if (error) throw error
  return Number(data ?? 0)
}

export async function listAvailabilityWindows(
  organizationId: string,
): Promise<AvailabilityWindow[]> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase
    .from('availability_windows')
    .select('*')
    .eq('organization_id', organizationId)
    .order('day_of_week', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as AvailabilityWindow[]
}

export async function createAvailabilityWindow(input: {
  organization_id: string
  day_of_week?: number | null
  specific_date?: string | null
  start_time: string
  end_time: string
  is_blackout: boolean
  capacity_override?: number | null
}): Promise<AvailabilityWindow> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase
    .from('availability_windows')
    .insert({
      organization_id: input.organization_id,
      day_of_week: input.specific_date ? null : (input.day_of_week ?? null),
      specific_date: input.specific_date ?? null,
      start_time: input.start_time,
      end_time: input.end_time,
      is_blackout: input.is_blackout,
      capacity_override: input.capacity_override ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as AvailabilityWindow
}

export async function deleteAvailabilityWindow(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase
    .from('availability_windows')
    .delete()
    .eq('id', id)
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
