import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type {
  AirportFee,
  CapacitySettings,
  FreightRule,
  Organization,
  VehicleCategory,
} from '../types/database'

export type TenantCatalog = {
  organization: Organization
  vehicles: VehicleCategory[]
  freightRules: FreightRule[]
  airportFees: AirportFee[]
  capacity: CapacitySettings | null
}

export async function loadTenantCatalog(
  slug: string,
): Promise<TenantCatalog | null> {
  if (!isSupabaseConfigured || !supabase) return null

  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (orgError) throw orgError
  if (!organization) return null

  const orgId = organization.id

  const [vehiclesRes, freightRes, airportRes, capacityRes] = await Promise.all([
    supabase
      .from('vehicle_categories')
      .select('*')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('freight_rules')
      .select('*')
      .eq('organization_id', orgId)
      .eq('active', true),
    supabase
      .from('airport_fees')
      .select('*')
      .eq('organization_id', orgId)
      .eq('active', true),
    supabase
      .from('capacity_settings')
      .select('*')
      .eq('organization_id', orgId)
      .maybeSingle(),
  ])

  if (vehiclesRes.error) throw vehiclesRes.error
  if (freightRes.error) throw freightRes.error
  if (airportRes.error) throw airportRes.error
  if (capacityRes.error) throw capacityRes.error

  return {
    organization,
    vehicles: vehiclesRes.data ?? [],
    freightRules: freightRes.data ?? [],
    airportFees: airportRes.data ?? [],
    capacity: capacityRes.data,
  }
}

export function pickFreightRule(
  rules: FreightRule[],
  opts: { vehicleCategoryId?: string | null; serviceType?: string | null },
): FreightRule | null {
  if (!rules.length) return null

  const byVehicleAndService = rules.find(
    (r) =>
      r.vehicle_category_id === opts.vehicleCategoryId &&
      r.service_type === opts.serviceType,
  )
  if (byVehicleAndService) return byVehicleAndService

  const byVehicle = rules.find(
    (r) =>
      r.vehicle_category_id === opts.vehicleCategoryId &&
      r.service_type == null,
  )
  if (byVehicle) return byVehicle

  const byService = rules.find(
    (r) =>
      r.vehicle_category_id == null && r.service_type === opts.serviceType,
  )
  if (byService) return byService

  return (
    rules.find((r) => r.vehicle_category_id == null && r.service_type == null) ??
    rules[0] ??
    null
  )
}
