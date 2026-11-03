export type StandardCategoryCode =
  | 'suv_executivo'
  | 'sedan_luxo'
  | 'van_executiva'
  | 'suv_blindado'
  | 'sedan_blindado'

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

export type StandardVehicleCategory = {
  code: StandardCategoryCode
  name_pt: string
  name_en: string
  is_armored: boolean
  sort_order: number
  default_body: VehicleBodyType
}

/** Categorias padrão da operação — selecionáveis na config da frota. */
export const STANDARD_VEHICLE_CATEGORIES: readonly StandardVehicleCategory[] = [
  {
    code: 'suv_executivo',
    name_pt: 'SUV executivo',
    name_en: 'Executive SUV',
    is_armored: false,
    sort_order: 10,
    default_body: 'suv',
  },
  {
    code: 'sedan_luxo',
    name_pt: 'Sedan de luxo',
    name_en: 'Luxury sedan',
    is_armored: false,
    sort_order: 20,
    default_body: 'sedan',
  },
  {
    code: 'van_executiva',
    name_pt: 'Van executiva',
    name_en: 'Executive van',
    is_armored: false,
    sort_order: 30,
    default_body: 'van',
  },
  {
    code: 'suv_blindado',
    name_pt: 'SUV blindado',
    name_en: 'Armored SUV',
    is_armored: true,
    sort_order: 40,
    default_body: 'suv',
  },
  {
    code: 'sedan_blindado',
    name_pt: 'Sedan blindado',
    name_en: 'Armored sedan',
    is_armored: true,
    sort_order: 50,
    default_body: 'sedan',
  },
] as const

export const VEHICLE_BODY_TYPES: readonly VehicleBodyType[] = [
  'sedan',
  'suv',
  'hatch',
  'wagon',
  'van',
  'minivan',
  'pickup',
  'coupe',
  'outro',
] as const

export function isStandardCategoryCode(
  value: string,
): value is StandardCategoryCode {
  return STANDARD_VEHICLE_CATEGORIES.some((c) => c.code === value)
}

export function standardCategoryByCode(code: string) {
  return STANDARD_VEHICLE_CATEGORIES.find((c) => c.code === code) ?? null
}
