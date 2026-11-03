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

/** Marcas e modelos comuns em frota executiva (cadastro só por select). */
export const FLEET_BRAND_MODELS: Readonly<Record<string, readonly string[]>> = {
  Audi: ['A4', 'A6', 'A8', 'Q5', 'Q7', 'Q8', 'e-tron'],
  BMW: ['320i', '330i', '520i', '530i', '740i', 'X1', 'X3', 'X5', 'X6', 'X7'],
  Mercedes: [
    'C 180',
    'C 200',
    'E 300',
    'S 500',
    'GLA 200',
    'GLC 300',
    'GLE 450',
    'GLS 450',
    'V-Class',
    'Sprinter',
  ],
  Porsche: ['Cayenne', 'Macan', 'Panamera'],
  Volvo: ['S60', 'S90', 'XC60', 'XC90'],
  Toyota: ['Corolla', 'Camry', 'Hilux', 'SW4', 'Land Cruiser'],
  LandRover: ['Discovery', 'Range Rover', 'Range Rover Sport', 'Range Rover Velar'],
  Jeep: ['Commander', 'Grand Cherokee', 'Wrangler'],
  Volkswagen: ['Jetta', 'Passat', 'Tiguan', 'Touareg', 'Caravelle'],
  Hyundai: ['Azera', 'Sonata', 'Palisade', 'Staria'],
  Kia: ['Carnival', 'Sorento', 'Sportage', 'Stinger'],
  Honda: ['Accord', 'CR-V', 'Pilot'],
  Lexus: ['ES 300h', 'LS 500', 'NX 350', 'RX 500h', 'LX 600'],
  Jaguar: ['XF', 'F-Pace', 'I-Pace'],
  Chevrolet: ['Equinox', 'Traverse', 'Tahoe'],
  Ford: ['Territory', 'Explorer', 'Transit'],
  BYD: ['Han', 'Tang', 'Song Plus'],
  CaoaChery: ['Tiggo 8', 'Arrizo 6'],
  Mitsubishi: ['Pajero Sport', 'Outlander', 'L200'],
  Nissan: ['Altima', 'Frontier', 'Patrol'],
} as const

export const FLEET_BRANDS: readonly string[] = Object.keys(FLEET_BRAND_MODELS).sort(
  (a, b) => a.localeCompare(b, 'pt-BR'),
)

export type FleetColorOption = {
  value: string
  labelKey: string
}

export const FLEET_COLORS: readonly FleetColorOption[] = [
  { value: 'Preto', labelKey: 'admin.fleet.colors.black' },
  { value: 'Branco', labelKey: 'admin.fleet.colors.white' },
  { value: 'Prata', labelKey: 'admin.fleet.colors.silver' },
  { value: 'Cinza', labelKey: 'admin.fleet.colors.gray' },
  { value: 'Grafite', labelKey: 'admin.fleet.colors.graphite' },
  { value: 'Azul', labelKey: 'admin.fleet.colors.blue' },
  { value: 'Azul-marinho', labelKey: 'admin.fleet.colors.navy' },
  { value: 'Vermelho', labelKey: 'admin.fleet.colors.red' },
  { value: 'Marrom', labelKey: 'admin.fleet.colors.brown' },
  { value: 'Bege', labelKey: 'admin.fleet.colors.beige' },
  { value: 'Champagne', labelKey: 'admin.fleet.colors.champagne' },
  { value: 'Verde', labelKey: 'admin.fleet.colors.green' },
] as const

const FLEET_YEAR_MIN = 2015

export function fleetYearOptions(now = new Date().getFullYear()): number[] {
  const max = now + 1
  const years: number[] = []
  for (let y = max; y >= FLEET_YEAR_MIN; y -= 1) years.push(y)
  return years
}

export function modelsForBrand(brand: string): readonly string[] {
  return FLEET_BRAND_MODELS[brand] ?? []
}
