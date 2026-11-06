import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type {
  Driver,
  DriverAvailabilitySlot,
  DriverJobDetail,
  FinancialEntry,
  JobAssignment,
  Lead,
  VehicleBodyType,
} from '../types/database'

function assertClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }
  return supabase
}

export async function listDrivers(
  organizationId: string,
  options?: { readyOnly?: boolean; includeInactive?: boolean },
): Promise<Driver[]> {
  const client = assertClient()
  let query = client
    .from('drivers')
    .select('*')
    .eq('organization_id', organizationId)
    .order('full_name', { ascending: true })

  if (!options?.includeInactive) query = query.eq('active', true)
  if (options?.readyOnly) {
    query = query.eq('profile_complete', true).eq('active', true)
  }

  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as Driver[]).map(normalizeDriver)
}

export async function getDriver(
  organizationId: string,
  driverId: string,
): Promise<Driver | null> {
  const client = assertClient()
  const { data, error } = await client
    .from('drivers')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', driverId)
    .maybeSingle()
  if (error) throw error
  return data ? normalizeDriver(data as Driver) : null
}

export type DriverInput = {
  organization_id: string
  full_name: string
  phone: string
  email: string
  vehicle_category_id: string
  vehicle_brand: string
  vehicle_model: string
  vehicle_year: number | null
  vehicle_color: string
  vehicle_plate?: string | null
  vehicle_body_type?: VehicleBodyType | null
  skills: string[]
  availability: DriverAvailabilitySlot[]
  notes?: string | null
  documents_notes?: string | null
  active?: boolean
}

export async function createDriver(input: DriverInput): Promise<Driver> {
  const client = assertClient()
  const { data, error } = await client
    .from('drivers')
    .insert({
      organization_id: input.organization_id,
      full_name: input.full_name.trim(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      vehicle_category_id: input.vehicle_category_id,
      vehicle_brand: input.vehicle_brand.trim(),
      vehicle_model: input.vehicle_model.trim(),
      vehicle_year: input.vehicle_year,
      vehicle_color: input.vehicle_color.trim(),
      vehicle_plate: input.vehicle_plate?.trim() || null,
      vehicle_body_type: input.vehicle_body_type ?? null,
      skills: input.skills,
      availability: input.availability,
      notes: input.notes?.trim() || null,
      documents_notes: input.documents_notes?.trim() || null,
      active: input.active ?? true,
    })
    .select('*')
    .single()
  if (error) throw error
  return normalizeDriver(data as Driver)
}

export async function updateDriver(
  id: string,
  input: Omit<DriverInput, 'organization_id'>,
): Promise<Driver> {
  const client = assertClient()
  const { data, error } = await client
    .from('drivers')
    .update({
      full_name: input.full_name.trim(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      vehicle_category_id: input.vehicle_category_id,
      vehicle_brand: input.vehicle_brand.trim(),
      vehicle_model: input.vehicle_model.trim(),
      vehicle_year: input.vehicle_year,
      vehicle_color: input.vehicle_color.trim(),
      vehicle_plate: input.vehicle_plate?.trim() || null,
      vehicle_body_type: input.vehicle_body_type ?? null,
      skills: input.skills,
      availability: input.availability,
      notes: input.notes?.trim() || null,
      documents_notes: input.documents_notes?.trim() || null,
      active: input.active ?? true,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return normalizeDriver(data as Driver)
}

export async function setDriverActive(
  id: string,
  active: boolean,
): Promise<Driver> {
  const client = assertClient()
  const { data, error } = await client
    .from('drivers')
    .update({ active })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return normalizeDriver(data as Driver)
}

export async function listAssignmentsForReservations(
  organizationId: string,
  reservationIds: string[],
): Promise<JobAssignment[]> {
  if (!reservationIds.length) return []
  const client = assertClient()
  const { data, error } = await client
    .from('job_assignments')
    .select('*')
    .eq('organization_id', organizationId)
    .in('reservation_id', reservationIds)
    .order('offered_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as JobAssignment[]
}

export type DriverAssignmentRow = JobAssignment & {
  reservation?: {
    slot_start: string
    origin_address: string
    destination_address: string
    service_type: string
    status: string
    estimated_price: number | null
    customer_name: string
  } | null
}

export async function listAssignmentsForDriver(
  organizationId: string,
  driverId: string,
): Promise<DriverAssignmentRow[]> {
  const client = assertClient()
  const { data, error } = await client
    .from('job_assignments')
    .select(
      '*, reservation:reservations(slot_start, origin_address, destination_address, service_type, status, estimated_price, customer_name)',
    )
    .eq('organization_id', organizationId)
    .eq('driver_id', driverId)
    .order('offered_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []).map((row) => {
    const r = row as JobAssignment & {
      reservation?: DriverAssignmentRow['reservation'] | DriverAssignmentRow['reservation'][]
    }
    const reservation = Array.isArray(r.reservation)
      ? r.reservation[0] ?? null
      : r.reservation ?? null
    return { ...r, reservation }
  })
}

export async function assignReservationToDriver(
  reservationId: string,
  driverId: string,
): Promise<JobAssignment> {
  const client = assertClient()
  const { data, error } = await client.rpc('assign_reservation_to_driver', {
    p_reservation_id: reservationId,
    p_driver_id: driverId,
  })
  if (error) throw error
  return data as JobAssignment
}

export async function completeReservationJob(
  reservationId: string,
): Promise<FinancialEntry> {
  const client = assertClient()
  const { data, error } = await client.rpc('complete_reservation_job', {
    p_reservation_id: reservationId,
  })
  if (error) throw error
  return data as FinancialEntry
}

export async function listFinancialEntries(
  organizationId: string,
): Promise<FinancialEntry[]> {
  const client = assertClient()
  const { data, error } = await client
    .from('financial_entries')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as FinancialEntry[]
}

const SETTLEMENT_PROOF_MAX_BYTES = 8 * 1024 * 1024
const SETTLEMENT_PROOF_BUCKET = 'settlement-proofs'
const SETTLEMENT_PROOF_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
])

export type SettlementProofKind = 'client_to_platform' | 'platform_to_driver'

export async function uploadSettlementProof(input: {
  organization_id: string
  entry_id: string
  kind: SettlementProofKind
  file: File
}): Promise<string> {
  const client = assertClient()
  if (input.file.size > SETTLEMENT_PROOF_MAX_BYTES) {
    throw new Error('PROOF_TOO_LARGE')
  }

  const mime = (input.file.type || '').toLowerCase()
  if (mime && !SETTLEMENT_PROOF_MIME.has(mime)) {
    throw new Error('PROOF_TYPE_INVALID')
  }

  const extRaw = (input.file.name.split('.').pop() || '').toLowerCase()
  const fromName = ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(extRaw)
    ? extRaw
    : null
  const fromMime =
    mime === 'application/pdf'
      ? 'pdf'
      : mime.includes('png')
        ? 'png'
        : mime.includes('webp')
          ? 'webp'
          : mime.includes('jpeg') || mime.includes('jpg')
            ? 'jpg'
            : null
  const safeExt = fromName || fromMime || 'bin'
  if (safeExt === 'bin') {
    throw new Error('PROOF_TYPE_INVALID')
  }

  const path = `${input.organization_id}/${input.entry_id}/${input.kind}-${crypto.randomUUID()}.${safeExt}`
  const contentType =
    mime && SETTLEMENT_PROOF_MIME.has(mime)
      ? mime
      : safeExt === 'pdf'
        ? 'application/pdf'
        : `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`

  const { error: uploadError } = await client.storage
    .from(SETTLEMENT_PROOF_BUCKET)
    .upload(path, input.file, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    })
  if (uploadError) throw uploadError

  const { data: pub } = client.storage
    .from(SETTLEMENT_PROOF_BUCKET)
    .getPublicUrl(path)
  return pub.publicUrl
}

export async function liquidateFinancialEntry(
  entryId: string,
  proofs: {
    client_to_platform_proof_url: string
    platform_to_driver_proof_url: string
  },
): Promise<FinancialEntry> {
  const client = assertClient()
  const { data, error } = await client.rpc('liquidate_financial_entry', {
    p_entry_id: entryId,
    p_client_to_platform_proof_url: proofs.client_to_platform_proof_url,
    p_platform_to_driver_proof_url: proofs.platform_to_driver_proof_url,
  })
  if (error) throw error
  return data as FinancialEntry
}

export async function setOrgCommissionPercent(
  organizationId: string,
  percent: number,
): Promise<void> {
  const client = assertClient()
  const { error } = await client.rpc('set_org_commission_percent', {
    p_organization_id: organizationId,
    p_percent: percent,
  })
  if (error) throw error
}

export function readCommissionPercent(settings: unknown): number {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return 20
  }
  const raw = (settings as Record<string, unknown>).platform_commission_percent
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return 20
  return Math.max(0, Math.min(100, n))
}

export async function createLead(input: {
  organization_id: string
  full_name: string
  phone: string
  email: string
  message?: string | null
}): Promise<Lead> {
  const client = assertClient()
  const { data, error } = await client
    .from('leads')
    .insert({
      organization_id: input.organization_id,
      full_name: input.full_name.trim(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      message: input.message?.trim() || null,
      source: 'landing',
      status: 'novo',
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Lead
}

export async function listLeads(organizationId: string): Promise<Lead[]> {
  const client = assertClient()
  const { data, error } = await client
    .from('leads')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as Lead[]
}

export async function getMyDriverProfile(
  organizationId: string,
): Promise<Driver | null> {
  const client = assertClient()
  const { data: auth } = await client.auth.getUser()
  const userId = auth.user?.id
  if (!userId) return null

  const { data, error } = await client
    .from('drivers')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (data) return normalizeDriver(data as Driver)

  const { data: claimed, error: claimError } = await client.rpc(
    'claim_my_driver_profile',
    { p_organization_id: organizationId },
  )
  if (claimError) {
    if (/DRIVER_NOT_FOUND/i.test(claimError.message)) return null
    throw claimError
  }
  return claimed ? normalizeDriver(claimed as Driver) : null
}

/** Creates/links a driver profile for login-page signups. Never changes owners. */
export async function ensureDriverProfileForSignup(
  organizationId: string,
): Promise<Driver | null> {
  const client = assertClient()
  const { data, error } = await client.rpc('ensure_driver_profile_for_signup', {
    p_organization_id: organizationId,
  })
  if (error) throw error
  return data ? normalizeDriver(data as Driver) : null
}

export async function listMyDriverAssignments(
  organizationId: string,
): Promise<JobAssignment[]> {
  const driver = await getMyDriverProfile(organizationId)
  if (!driver) return []
  const client = assertClient()
  const { data, error } = await client
    .from('job_assignments')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('driver_id', driver.id)
    .in('status', ['oferecido', 'aceito', 'concluido'])
    .order('offered_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as JobAssignment[]
}

export async function getDriverJobDetail(
  assignmentId: string,
): Promise<DriverJobDetail> {
  const client = assertClient()
  const { data, error } = await client.rpc('get_driver_job_detail', {
    p_assignment_id: assignmentId,
  })
  if (error) throw error
  return data as DriverJobDetail
}

export async function driverRespondAssignment(
  assignmentId: string,
  accept: boolean,
  refuseReason?: string,
): Promise<JobAssignment> {
  const client = assertClient()
  const { data, error } = await client.rpc('driver_respond_assignment', {
    p_assignment_id: assignmentId,
    p_accept: accept,
    p_refuse_reason: refuseReason ?? null,
  })
  if (error) throw error
  return data as JobAssignment
}

function normalizeDriver(row: Driver): Driver {
  const availability = Array.isArray(row.availability)
    ? (row.availability as DriverAvailabilitySlot[])
    : []
  const inviteStatus = row.invite_status
  const photos = Array.isArray(row.vehicle_photo_urls)
    ? row.vehicle_photo_urls.filter((u): u is string => typeof u === 'string' && u.length > 0)
    : []
  return {
    ...row,
    skills: Array.isArray(row.skills) ? row.skills : [],
    availability,
    vehicle_photo_urls: photos.slice(0, 4),
    invite_status:
      inviteStatus === 'pending' || inviteStatus === 'accepted'
        ? inviteStatus
        : 'none',
    invited_at: row.invited_at ?? null,
  }
}

export type MyDriverProfileInput = {
  organization_id: string
  full_name: string
  phone: string
  vehicle_category_id: string | null
  vehicle_brand: string
  vehicle_model: string
  vehicle_year: number | null
  vehicle_color: string
  vehicle_plate: string | null
  vehicle_body_type: VehicleBodyType | null
  skills: string[]
  availability: DriverAvailabilitySlot[]
  vehicle_photo_urls: string[]
}

export async function updateMyDriverProfile(
  input: MyDriverProfileInput,
): Promise<Driver> {
  const client = assertClient()
  const { data, error } = await client.rpc('update_my_driver_profile', {
    p_organization_id: input.organization_id,
    p_full_name: input.full_name.trim(),
    p_phone: input.phone.trim(),
    p_vehicle_category_id: input.vehicle_category_id,
    p_vehicle_brand: input.vehicle_brand.trim(),
    p_vehicle_model: input.vehicle_model.trim(),
    p_vehicle_year: input.vehicle_year,
    p_vehicle_color: input.vehicle_color.trim(),
    p_vehicle_plate: input.vehicle_plate?.trim() || null,
    p_vehicle_body_type: input.vehicle_body_type,
    p_skills: input.skills,
    p_availability: input.availability,
    p_vehicle_photo_urls: input.vehicle_photo_urls.slice(0, 4),
  })
  if (error) throw error
  return normalizeDriver(data as Driver)
}

const DRIVER_PHOTO_MAX_BYTES = 5 * 1024 * 1024

export async function uploadDriverVehiclePhoto(input: {
  organization_id: string
  driver_id: string
  file: File
}): Promise<string> {
  const client = assertClient()
  if (input.file.size > DRIVER_PHOTO_MAX_BYTES) {
    throw new Error('PHOTO_TOO_LARGE')
  }

  const ext = (input.file.name.split('.').pop() || 'jpg')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
  const path = `${input.organization_id}/${input.driver_id}/${crypto.randomUUID()}.${safeExt}`

  const { error: uploadError } = await client.storage
    .from('driver-vehicle-photos')
    .upload(path, input.file, {
      cacheControl: '3600',
      upsert: false,
      contentType: input.file.type || `image/${safeExt}`,
    })
  if (uploadError) throw uploadError

  const { data: pub } = client.storage
    .from('driver-vehicle-photos')
    .getPublicUrl(path)
  return pub.publicUrl
}

export async function removeDriverVehiclePhotoByUrl(url: string): Promise<void> {
  const client = assertClient()
  const marker = '/driver-vehicle-photos/'
  const idx = url.indexOf(marker)
  if (idx < 0) return
  const path = decodeURIComponent(url.slice(idx + marker.length).split('?')[0] ?? '')
  if (!path) return
  const { error } = await client.storage.from('driver-vehicle-photos').remove([path])
  if (error) throw error
}

/** Admin: envia/reenvia convite Auth para o motorista definir senha. */
export async function inviteDriver(driverId: string): Promise<Driver> {
  const client = assertClient()
  const redirectTo = `${window.location.origin}/aceitar-convite`
  const { data, error } = await client.functions.invoke('invite-driver', {
    body: { driver_id: driverId, redirect_to: redirectTo },
  })
  const payload = data as {
    ok?: boolean
    error?: string
    driver?: Driver
    already_accepted?: boolean
  } | null

  if (error) {
    const fromBody = payload?.error
    throw new Error(fromBody || error.message || 'Falha ao enviar convite')
  }
  if (!payload?.ok) {
    throw new Error(payload?.error || 'Falha ao enviar convite')
  }
  if (!payload.driver) {
    throw new Error('Convite enviado, mas motorista não retornou')
  }
  return normalizeDriver(payload.driver)
}

export async function acceptMyDriverInvite(
  organizationId: string,
): Promise<Driver> {
  const client = assertClient()
  const { data, error } = await client.rpc('accept_my_driver_invite', {
    p_organization_id: organizationId,
  })
  if (error) throw error
  return normalizeDriver(data as Driver)
}

/** Active dispatch label for a reservation from its assignments. */
export function dispatchLabel(
  assignments: JobAssignment[],
  reservationId: string,
): 'sem_motorista' | 'oferecido' | 'aceito' | 'concluido' {
  const rows = assignments.filter((a) => a.reservation_id === reservationId)
  if (rows.some((a) => a.status === 'concluido')) return 'concluido'
  if (rows.some((a) => a.status === 'aceito')) return 'aceito'
  if (rows.some((a) => a.status === 'oferecido')) return 'oferecido'
  return 'sem_motorista'
}
