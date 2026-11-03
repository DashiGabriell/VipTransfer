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

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          slug: string
          name: string
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>
      }
      vehicle_categories: {
        Row: {
          id: string
          organization_id: string
          name_i18n: Json
          description_i18n: Json
          is_armored: boolean
          passenger_capacity: number | null
          luggage_capacity: number | null
          active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name_i18n?: Json
          description_i18n?: Json
          is_armored?: boolean
          passenger_capacity?: number | null
          luggage_capacity?: number | null
          active?: boolean
          sort_order?: number
        }
        Update: Partial<Database['public']['Tables']['vehicle_categories']['Insert']>
      }
      reservations: {
        Row: {
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
          estimated_km: number | null
          estimated_price: number | null
          hold_expires_at: string | null
          created_at: string
        }
        Insert: {
          organization_id: string
          status?: ReservationStatus
          customer_name: string
          customer_phone: string
          customer_email: string
          origin_address: string
          destination_address: string
          service_type: ServiceType
          vehicle_category_id?: string | null
          airport?: AirportCode | null
          slot_start: string
          slot_end: string
          estimated_km?: number | null
          estimated_price?: number | null
          hold_expires_at?: string | null
          locale?: string
          source?: string
        }
        Update: Partial<Database['public']['Tables']['reservations']['Insert']>
      }
    }
  }
}
