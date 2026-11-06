import {
  STANDARD_VEHICLE_CATEGORIES,
  type StandardCategoryCode,
  type VehicleBodyType,
} from '../domain/fleet'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type {
  AirportCode,
  Customer,
  FleetVehicle,
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

export async function listVehicleCategoriesAdmin(
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

/** @deprecated use listVehicleCategoriesAdmin */
export async function listVehiclesAdmin(
  organizationId: string,
): Promise<VehicleCategory[]> {
  return listVehicleCategoriesAdmin(organizationId)
}

export async function setStandardCategoryActive(input: {
  organization_id: string
  code: StandardCategoryCode
  active: boolean
}): Promise<VehicleCategory> {
  if (!supabase) throw new Error('Supabase não configurado')
  const def = STANDARD_VEHICLE_CATEGORIES.find((c) => c.code === input.code)
  if (!def) throw new Error('Categoria padrão inválida')

  const { data: existing, error: findError } = await supabase
    .from('vehicle_categories')
    .select('*')
    .eq('organization_id', input.organization_id)
    .eq('code', input.code)
    .maybeSingle()
  if (findError) throw findError

  if (existing) {
    const { data, error } = await supabase
      .from('vehicle_categories')
      .update({
        active: input.active,
        name_i18n: { pt: def.name_pt, en: def.name_en },
        is_armored: def.is_armored,
        sort_order: def.sort_order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    return data as VehicleCategory
  }

  const { data, error } = await supabase
    .from('vehicle_categories')
    .insert({
      organization_id: input.organization_id,
      code: input.code,
      name_i18n: { pt: def.name_pt, en: def.name_en },
      description_i18n: { pt: '', en: '' },
      is_armored: def.is_armored,
      passenger_capacity: null,
      luggage_capacity: null,
      active: input.active,
      sort_order: def.sort_order,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as VehicleCategory
}

export async function listFleetVehiclesAdmin(
  organizationId: string,
): Promise<FleetVehicle[]> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase
    .from('fleet_vehicles')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as FleetVehicle[]
}

export async function createFleetVehicle(input: {
  organization_id: string
  vehicle_category_id: string
  driver_id: string
  brand: string
  model: string
  year: number
  color: string
  body_type: VehicleBodyType
  plate?: string | null
  notes?: string | null
}): Promise<FleetVehicle> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase
    .from('fleet_vehicles')
    .insert({
      organization_id: input.organization_id,
      vehicle_category_id: input.vehicle_category_id,
      driver_id: input.driver_id,
      brand: input.brand.trim(),
      model: input.model.trim(),
      year: input.year,
      color: input.color.trim(),
      body_type: input.body_type,
      plate: input.plate?.trim() || null,
      notes: input.notes?.trim() || null,
      active: true,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as FleetVehicle
}

export async function uploadFleetVehiclePhoto(input: {
  organization_id: string
  vehicle_id: string
  file: File
}): Promise<{ path: string; url: string }> {
  if (!supabase) throw new Error('Supabase não configurado')

  const ext = (input.file.name.split('.').pop() || 'jpg')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
  const path = `${input.organization_id}/${input.vehicle_id}.${safeExt}`

  const { error: uploadError } = await supabase.storage
    .from('fleet-photos')
    .upload(path, input.file, {
      cacheControl: '3600',
      upsert: true,
      contentType: input.file.type || `image/${safeExt}`,
    })
  if (uploadError) throw uploadError

  const { data: pub } = supabase.storage.from('fleet-photos').getPublicUrl(path)
  const url = pub.publicUrl

  const { error: updateError } = await supabase
    .from('fleet_vehicles')
    .update({
      photo_path: path,
      photo_url: url,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.vehicle_id)
  if (updateError) throw updateError

  return { path, url }
}

export async function updateFleetVehicle(input: {
  id: string
  vehicle_category_id: string
  driver_id: string
  brand: string
  model: string
  year: number
  color: string
  body_type: VehicleBodyType
  plate?: string | null
  notes?: string | null
}): Promise<FleetVehicle> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase
    .from('fleet_vehicles')
    .update({
      vehicle_category_id: input.vehicle_category_id,
      driver_id: input.driver_id,
      brand: input.brand.trim(),
      model: input.model.trim(),
      year: input.year,
      color: input.color.trim(),
      body_type: input.body_type,
      plate: input.plate?.trim() || null,
      notes: input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .select('*')
    .single()
  if (error) throw error
  return data as FleetVehicle
}

export async function setFleetVehicleActive(input: {
  id: string
  active: boolean
}): Promise<FleetVehicle> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase
    .from('fleet_vehicles')
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .select('*')
    .single()
  if (error) throw error
  return data as FleetVehicle
}

export async function fleetVehicleHasTripHistory(
  vehicleId: string,
): Promise<boolean> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase.rpc('fleet_vehicle_has_trip_history', {
    p_vehicle_id: vehicleId,
  })
  if (error) throw error
  return Boolean(data)
}

export async function deleteFleetVehicle(vehicleId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase.rpc('delete_fleet_vehicle', {
    p_vehicle_id: vehicleId,
  })
  if (error) throw error
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

  let ruleId = input.id
  if (!ruleId && input.service_type) {
    const { data: existing } = await supabase
      .from('freight_rules')
      .select('id')
      .eq('organization_id', input.organization_id)
      .is('vehicle_category_id', null)
      .eq('service_type', input.service_type)
      .maybeSingle()
    ruleId = existing?.id
  }

  if (ruleId) {
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
      .eq('id', ruleId)
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

export async function listCustomers(
  organizationId: string,
  options?: { includeInactive?: boolean },
): Promise<Customer[]> {
  if (!supabase) throw new Error('Supabase não configurado')
  let query = supabase
    .from('customers')
    .select('*')
    .eq('organization_id', organizationId)
    .order('full_name', { ascending: true })

  if (!options?.includeInactive) {
    query = query.eq('active', true)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Customer[]
}

export async function getCustomer(
  organizationId: string,
  customerId: string,
): Promise<Customer | null> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', customerId)
    .maybeSingle()
  if (error) throw error
  return (data as Customer | null) ?? null
}

export async function createCustomer(input: {
  organization_id: string
  full_name: string
  phone: string
  email: string
  notes?: string | null
}): Promise<Customer> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase
    .from('customers')
    .insert({
      organization_id: input.organization_id,
      full_name: input.full_name.trim(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      notes: input.notes?.trim() || null,
      active: true,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Customer
}

export async function updateCustomer(input: {
  id: string
  full_name: string
  phone: string
  email: string
  notes?: string | null
}): Promise<Customer> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase
    .from('customers')
    .update({
      full_name: input.full_name.trim(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      notes: input.notes?.trim() || null,
    })
    .eq('id', input.id)
    .select('*')
    .single()
  if (error) throw error
  return data as Customer
}

export async function setCustomerActive(input: {
  id: string
  active: boolean
}): Promise<Customer> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase
    .from('customers')
    .update({ active: input.active })
    .eq('id', input.id)
    .select('*')
    .single()
  if (error) throw error
  return data as Customer
}

/** Match reservations by phone digits (CRM history without FK). */
export async function listReservationsForCustomerPhone(
  organizationId: string,
  phone: string,
  limit = 20,
): Promise<Reservation[]> {
  if (!supabase) throw new Error('Supabase não configurado')
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return []

  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('organization_id', organizationId)
    .order('slot_start', { ascending: false })
    .limit(200)
  if (error) throw error

  return ((data ?? []) as Reservation[])
    .filter((r) => r.customer_phone.replace(/\D/g, '').endsWith(digits.slice(-8)))
    .slice(0, limit)
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
