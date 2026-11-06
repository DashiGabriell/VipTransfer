export type OrgRole = 'owner' | 'admin' | 'operador' | 'leitura'
export type PlatformRole = 'dev' | 'platform_owner'
export type ReservationStatus =
  | 'hold'
  | 'hold_expirado'
  | 'confirmado'
  | 'cancelado'
  | 'concluido'
export type ServiceType = 'ponto_a_b' | 'a_disposicao' | 'concierge'
export type AirportCode = 'GRU' | 'CGH' | 'VCP'

export const SERVICE_TYPES: ServiceType[] = [
  'ponto_a_b',
  'a_disposicao',
  'concierge',
]

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type I18nText = {
  pt?: string
  en?: string
  [key: string]: string | undefined
}

export type Organization = {
  id: string
  slug: string
  name: string
  settings: Json
  created_at: string
  updated_at: string
}

export type VehicleCategory = {
  id: string
  organization_id: string
  code: string
  name_i18n: I18nText
  description_i18n: I18nText
  is_armored: boolean
  passenger_capacity: number | null
  luggage_capacity: number | null
  active: boolean
  sort_order: number
}

export type VehicleBodyType =
  | 'sedan'
  | 'suv'
  | 'hatch'
  | 'wagon'
  | 'van'
  | 'minivan'
  | 'pickup'
  | 'coupe'
  | 'outro'

export type FleetVehicle = {
  id: string
  organization_id: string
  vehicle_category_id: string
  driver_id: string | null
  brand: string
  model: string
  year: number
  color: string
  body_type: VehicleBodyType
  photo_path: string | null
  photo_url: string | null
  plate: string | null
  active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type Customer = {
  id: string
  organization_id: string
  full_name: string
  phone: string
  email: string
  notes: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type DriverAvailabilitySlot = {
  day_of_week: number
  start_time: string
  end_time: string
}

export type DriverInviteStatus = 'none' | 'pending' | 'accepted'

export type Driver = {
  id: string
  organization_id: string
  user_id: string | null
  full_name: string
  phone: string
  email: string
  vehicle_category_id: string | null
  vehicle_brand: string
  vehicle_model: string
  vehicle_year: number | null
  vehicle_color: string
  vehicle_plate: string | null
  vehicle_body_type: VehicleBodyType | null
  vehicle_photo_urls: string[]
  skills: string[]
  availability: DriverAvailabilitySlot[]
  notes: string | null
  documents_notes: string | null
  profile_complete: boolean
  active: boolean
  invite_status: DriverInviteStatus
  invited_at: string | null
  created_at: string
  updated_at: string
}

export type AssignmentStatus =
  | 'oferecido'
  | 'aceito'
  | 'recusado'
  | 'cancelado'
  | 'concluido'

export type JobAssignment = {
  id: string
  organization_id: string
  reservation_id: string
  driver_id: string
  status: AssignmentStatus
  offered_at: string
  offered_by: string | null
  responded_at: string | null
  refuse_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type FinancialEntryStatus = 'previsto' | 'a_liquidar' | 'liquidado'

export type FinancialEntry = {
  id: string
  organization_id: string
  reservation_id: string
  driver_id: string | null
  assignment_id: string | null
  gross_amount: number
  commission_percent: number
  commission_amount: number
  driver_amount: number
  currency: string
  status: FinancialEntryStatus
  notes: string | null
  liquidated_at: string | null
  /** Comprovante cliente → plataforma (PDF/imagem). */
  client_to_platform_proof_url: string | null
  /** Comprovante plataforma → motorista (PDF/imagem). */
  platform_to_driver_proof_url: string | null
  created_at: string
  updated_at: string
}

/** Lançamento do extrato com nome do cliente (via reservation). */
export type FinanceLedgerEntry = FinancialEntry & {
  customer_name: string
}

export type Lead = {
  id: string
  organization_id: string
  full_name: string
  phone: string
  email: string
  message: string | null
  source: string
  status: string
  created_at: string
}

export type DriverJobDetail = {
  assignment_id: string
  status: AssignmentStatus
  offered_at: string
  responded_at: string | null
  refuse_reason: string | null
  service: {
    reservation_id: string
    customer_first_name: string
    origin_address: string
    destination_address: string
    stops: string[]
    service_type: ServiceType
    airport: AirportCode | null
    slot_start: string
    slot_end: string
    hours_requested: number | null
    estimated_km: number | null
    notes: string | null
  }
}

export type FreightRule = {
  id: string
  organization_id: string
  vehicle_category_id: string | null
  service_type: ServiceType | null
  price_per_km: number
  minimum_fare: number
  price_per_hour: number | null
  active: boolean
}

export type AirportFee = {
  id: string
  organization_id: string
  airport: AirportCode
  flat_fee: number
  active: boolean
}

export type CapacitySettings = {
  organization_id: string
  slot_minutes: number
  default_capacity: number
  hold_minutes: number
  timezone: string
}

export type Reservation = {
  id: string
  organization_id: string
  status: ReservationStatus
  customer_name: string
  customer_phone: string
  customer_email: string
  origin_address: string
  destination_address: string
  /** Intermediate stops between origin and destination, in order. */
  stops: string[]
  service_type: ServiceType
  vehicle_category_id: string | null
  airport: AirportCode | null
  slot_start: string
  slot_end: string
  hours_requested: number | null
  estimated_km: number | null
  /** Internal/legacy only — never shown to the customer. */
  estimated_price: number | null
  /** Concierge details or extra notes. */
  service_notes: string | null
  hold_expires_at: string | null
  locale: string
  source: string
  created_at: string
}

export type CreateReservationInput = {
  organization_id: string
  customer_name: string
  customer_phone: string
  customer_email: string
  origin_address: string
  destination_address: string
  stops?: string[]
  service_type: ServiceType
  slot_start: string
  slot_end: string
  vehicle_category_id?: string | null
  airport?: AirportCode | null
  hours_requested?: number | null
  estimated_km?: number | null
  estimated_price?: number | null
  service_notes?: string | null
  locale?: string
  source?: string
}

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: Organization
        Insert: Partial<Organization> & Pick<Organization, 'slug' | 'name'>
        Update: Partial<Organization>
      }
      vehicle_categories: {
        Row: VehicleCategory
        Insert: Partial<VehicleCategory> &
          Pick<VehicleCategory, 'organization_id' | 'code'>
        Update: Partial<VehicleCategory>
      }
      fleet_vehicles: {
        Row: FleetVehicle
        Insert: Partial<FleetVehicle> &
          Pick<
            FleetVehicle,
            | 'organization_id'
            | 'vehicle_category_id'
            | 'brand'
            | 'model'
            | 'year'
            | 'color'
            | 'body_type'
          >
        Update: Partial<FleetVehicle>
      }
      customers: {
        Row: Customer
        Insert: Partial<Customer> &
          Pick<Customer, 'organization_id' | 'full_name' | 'phone' | 'email'>
        Update: Partial<Customer>
      }
      freight_rules: {
        Row: FreightRule
        Insert: Partial<FreightRule> & Pick<FreightRule, 'organization_id'>
        Update: Partial<FreightRule>
      }
      airport_fees: {
        Row: AirportFee
        Insert: Partial<AirportFee> &
          Pick<AirportFee, 'organization_id' | 'airport'>
        Update: Partial<AirportFee>
      }
      capacity_settings: {
        Row: CapacitySettings
        Insert: Partial<CapacitySettings> &
          Pick<CapacitySettings, 'organization_id'>
        Update: Partial<CapacitySettings>
      }
      reservations: {
        Row: Reservation
        Insert: CreateReservationInput & { status?: ReservationStatus }
        Update: Partial<Reservation>
      }
    }
    Functions: {
      create_reservation_with_hold: {
        Args: {
          p_organization_id: string
          p_customer_name: string
          p_customer_phone: string
          p_customer_email: string
          p_origin_address: string
          p_destination_address: string
          p_service_type: ServiceType
          p_slot_start: string
          p_slot_end: string
          p_vehicle_category_id?: string | null
          p_airport?: AirportCode | null
          p_hours_requested?: number | null
          p_estimated_km?: number | null
          p_estimated_price?: number | null
          p_origin_lat?: number | null
          p_origin_lng?: number | null
          p_destination_lat?: number | null
          p_destination_lng?: number | null
          p_locale?: string
          p_source?: string
          p_stops?: string[]
          p_service_notes?: string | null
        }
        Returns: Reservation
      }
      expire_reservation_holds: {
        Args: Record<string, never>
        Returns: number
      }
    }
  }
}
