export type OrgRole = 'owner' | 'admin' | 'operador' | 'leitura'
export type PlatformRole = 'dev' | 'platform_owner'
export type ReservationStatus =
  | 'hold'
  | 'hold_expirado'
  | 'confirmado'
  | 'cancelado'
  | 'concluido'
export type ServiceType =
  | 'aeroporto'
  | 'corporativo'
  | 'horas_a_disposicao'
  | 'viagem'
export type AirportCode = 'GRU' | 'CGH' | 'VCP'

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
  service_type: ServiceType
  vehicle_category_id: string | null
  airport: AirportCode | null
  slot_start: string
  slot_end: string
  hours_requested: number | null
  estimated_km: number | null
  estimated_price: number | null
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
  service_type: ServiceType
  slot_start: string
  slot_end: string
  vehicle_category_id?: string | null
  airport?: AirportCode | null
  hours_requested?: number | null
  estimated_km?: number | null
  estimated_price?: number | null
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
