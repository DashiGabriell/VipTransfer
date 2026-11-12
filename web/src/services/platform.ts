import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Json, OrgRole, PlatformRole } from '../types/database'

export type OrgStatus = 'active' | 'paused'

export type PlatformOrgListItem = {
  id: string
  slug: string
  name: string
  status: OrgStatus
  settings: Json
  created_at: string
  updated_at: string
  member_count: number
  reservations_30d: number
}

export type PlatformMember = {
  id: string
  organization_id: string
  user_id: string
  role: OrgRole
  created_at: string
  full_name: string | null
  email: string | null
}

export type PlatformOrgDetail = {
  organization: {
    id: string
    slug: string
    name: string
    status: OrgStatus
    settings: Json
    created_at: string
    updated_at: string
  }
  members: PlatformMember[]
  capacity: Record<string, unknown> | null
  airport_fees: Array<Record<string, unknown>>
}

export type PlatformOverview = {
  orgs_active: number
  orgs_paused: number
  holds_24h: number
  confirmed_24h: number
  confirmed_7d: number
  drivers_active: number
  payment_errors_7d: number
  recent_audit: Array<{
    id: number
    organization_id: string | null
    actor_id: string | null
    impersonator_id: string | null
    action: string
    entity_type: string
    entity_id: string | null
    created_at: string
  }>
  problem_orgs: Array<{
    id: string
    slug: string
    name: string
    status: OrgStatus
    holds_expiring_soon: number
    owners: number
  }>
}

export type PlatformUserRow = {
  id: string
  full_name: string | null
  email: string | null
  platform_role: PlatformRole | null
  memberships: Array<{
    organization_id: string
    role: OrgRole
    org_slug: string
    org_name: string
  }>
}

export type AuditLogRow = {
  id: number
  organization_id: string | null
  actor_id: string | null
  impersonator_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  before_data: Json | null
  after_data: Json | null
  created_at: string
}

export type ImpersonationSession = {
  id: string
  impersonator_id: string
  target_user_id: string
  organization_id: string
  target_membership_id: string | null
  reason: string
  expires_at: string
  ended_at: string | null
  created_at: string
}

export type ActiveImpersonation = {
  session: ImpersonationSession
  organization: { id: string; slug: string; name: string }
  target: {
    id: string
    full_name: string | null
    email: string | null
    role: OrgRole | null
  }
}

export type PlatformOpsSnapshot = {
  open_holds: number
  holds_past_expiry: number
  payment_charges_open: number
  payment_charges_failed_7d: number
  recent_webhooks: Array<{
    id: string
    event: string
    checkout_id: string | null
    payment_charge_id: string | null
    processed_at: string
  }>
  is_dev: boolean
}

export type PlatformFlags = {
  public_maintenance?: boolean
  block_new_reservations?: boolean
  banner_message?: string
  /** Quando false, oculta "Criar conta" e bloqueia auto-provisionamento. */
  public_signup_enabled?: boolean
}

function assertClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }
  return supabase
}

export async function getMyPlatformRole(): Promise<PlatformRole | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('platform_get_my_role')
  if (error) {
    // usuário sem row → null
    if (error.code === 'PGRST116') return null
    // rpc pode retornar null sem erro
    throw error
  }
  return (data as PlatformRole | null) ?? null
}

export async function fetchPlatformOverview(): Promise<PlatformOverview> {
  const client = assertClient()
  const { data, error } = await client.rpc('platform_overview')
  if (error) throw error
  return data as PlatformOverview
}

export async function listPlatformOrganizations(): Promise<PlatformOrgListItem[]> {
  const client = assertClient()
  const { data, error } = await client.rpc('platform_list_organizations')
  if (error) throw error
  return (data ?? []) as PlatformOrgListItem[]
}

export async function getPlatformOrganization(
  orgId: string,
): Promise<PlatformOrgDetail> {
  const client = assertClient()
  const { data, error } = await client.rpc('platform_get_organization', {
    p_org_id: orgId,
  })
  if (error) throw error
  return data as PlatformOrgDetail
}

export async function upsertPlatformOrganization(input: {
  id?: string | null
  slug?: string | null
  name?: string | null
  status?: OrgStatus | null
  settings?: Json | null
}): Promise<PlatformOrgListItem> {
  const client = assertClient()
  const { data, error } = await client.rpc('platform_upsert_organization', {
    p_id: input.id ?? null,
    p_slug: input.slug ?? null,
    p_name: input.name ?? null,
    p_status: input.status ?? null,
    p_settings: input.settings ?? null,
  })
  if (error) throw error
  return data as PlatformOrgListItem
}

export async function setPlatformMembership(input: {
  organizationId: string
  userId?: string | null
  email?: string | null
  role?: OrgRole
  remove?: boolean
}): Promise<unknown> {
  const client = assertClient()
  const { data, error } = await client.rpc('platform_set_membership', {
    p_organization_id: input.organizationId,
    p_user_id: input.userId ?? null,
    p_email: input.email ?? null,
    p_role: input.role ?? 'operador',
    p_remove: input.remove ?? false,
  })
  if (error) throw error
  return data
}

export async function searchPlatformUsers(
  query: string,
): Promise<PlatformUserRow[]> {
  const client = assertClient()
  const { data, error } = await client.rpc('platform_search_users', {
    p_query: query,
  })
  if (error) throw error
  return (data ?? []) as PlatformUserRow[]
}

export async function setPlatformRole(input: {
  userId: string
  role?: PlatformRole | null
  remove?: boolean
}): Promise<unknown> {
  const client = assertClient()
  const { data, error } = await client.rpc('platform_set_platform_role', {
    p_user_id: input.userId,
    p_role: input.role ?? null,
    p_remove: input.remove ?? false,
  })
  if (error) throw error
  return data
}

export async function startImpersonation(input: {
  organizationId: string
  targetUserId: string
  reason: string
  durationMinutes?: number
}): Promise<ImpersonationSession> {
  const client = assertClient()
  const { data, error } = await client.rpc('platform_start_impersonation', {
    p_organization_id: input.organizationId,
    p_target_user_id: input.targetUserId,
    p_reason: input.reason,
    p_duration_minutes: input.durationMinutes ?? 60,
  })
  if (error) throw error
  return data as ImpersonationSession
}

export async function endImpersonation(
  sessionId?: string | null,
): Promise<ImpersonationSession> {
  const client = assertClient()
  const { data, error } = await client.rpc('platform_end_impersonation', {
    p_session_id: sessionId ?? null,
  })
  if (error) throw error
  return data as ImpersonationSession
}

export async function getActiveImpersonation(): Promise<ActiveImpersonation | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('platform_get_active_impersonation')
  if (error) throw error
  return (data as ActiveImpersonation | null) ?? null
}

export async function listPlatformAudit(filters: {
  organizationId?: string | null
  actorId?: string | null
  impersonatorId?: string | null
  action?: string | null
  entityType?: string | null
  from?: string | null
  to?: string | null
  limit?: number
}): Promise<AuditLogRow[]> {
  const client = assertClient()
  const { data, error } = await client.rpc('platform_list_audit', {
    p_organization_id: filters.organizationId ?? null,
    p_actor_id: filters.actorId ?? null,
    p_impersonator_id: filters.impersonatorId ?? null,
    p_action: filters.action ?? null,
    p_entity_type: filters.entityType ?? null,
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_limit: filters.limit ?? 100,
  })
  if (error) throw error
  return (data ?? []) as AuditLogRow[]
}

export async function fetchPlatformOps(): Promise<PlatformOpsSnapshot> {
  const client = assertClient()
  const { data, error } = await client.rpc('platform_ops_snapshot')
  if (error) throw error
  return data as PlatformOpsSnapshot
}

export async function runExpireHolds(): Promise<{ expired_count: number }> {
  const client = assertClient()
  const { data, error } = await client.rpc('platform_run_expire_holds')
  if (error) throw error
  return data as { expired_count: number }
}

export async function fetchPublicPlatformFlags(): Promise<PlatformFlags> {
  if (!supabase) {
    return {
      public_maintenance: false,
      block_new_reservations: false,
      banner_message: '',
      public_signup_enabled: true,
    }
  }
  const { data, error } = await supabase.rpc('platform_public_flags')
  if (error) throw error
  const raw = (data ?? {}) as PlatformFlags
  return {
    public_maintenance: Boolean(raw.public_maintenance),
    block_new_reservations: Boolean(raw.block_new_reservations),
    banner_message:
      typeof raw.banner_message === 'string' ? raw.banner_message : '',
    public_signup_enabled: raw.public_signup_enabled !== false,
  }
}

export async function getPlatformSettings(): Promise<Record<string, Json>> {
  const client = assertClient()
  const { data, error } = await client.rpc('platform_get_settings')
  if (error) throw error
  return (data ?? {}) as Record<string, Json>
}

export async function setPlatformSettings(
  key: string,
  value: Json,
): Promise<Record<string, Json>> {
  const client = assertClient()
  const { data, error } = await client.rpc('platform_set_settings', {
    p_key: key,
    p_value: value,
  })
  if (error) throw error
  return (data ?? {}) as Record<string, Json>
}

export function settingsRecord(settings: Json): Record<string, unknown> {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return {}
  }
  return settings as Record<string, unknown>
}
