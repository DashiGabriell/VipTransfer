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

export type FleetModelEntry = {
  model: string
  bodies: readonly VehicleBodyType[]
}

type Body = VehicleBodyType

function m(model: string, ...bodies: Body[]): FleetModelEntry {
  return { model, bodies }
}

/**
 * Catálogo de marcas/modelos para frota executiva (BR), indexado por carroceria.
 * Cadastro só por select — modelos filtrados pela carroceria escolhida.
 */
export const FLEET_CATALOG: Readonly<Record<string, readonly FleetModelEntry[]>> =
  {
    Audi: [
      m('A3 Sedan', 'sedan'),
      m('A4', 'sedan'),
      m('A5 Sportback', 'sedan', 'hatch'),
      m('A6', 'sedan'),
      m('A7 Sportback', 'sedan', 'hatch'),
      m('A8', 'sedan'),
      m('S8', 'sedan'),
      m('Q3', 'suv'),
      m('Q5', 'suv'),
      m('Q7', 'suv'),
      m('Q8', 'suv'),
      m('e-tron', 'suv'),
      m('Q8 e-tron', 'suv'),
      m('RS Q8', 'suv'),
      m('TT', 'coupe'),
    ],
    BMW: [
      m('318i', 'sedan'),
      m('320i', 'sedan'),
      m('330i', 'sedan'),
      m('330e', 'sedan'),
      m('M340i', 'sedan'),
      m('420i Gran Coupe', 'sedan', 'coupe'),
      m('520i', 'sedan'),
      m('530i', 'sedan'),
      m('530e', 'sedan'),
      m('540i', 'sedan'),
      m('M550i', 'sedan'),
      m('740i', 'sedan'),
      m('750i', 'sedan'),
      m('750e', 'sedan'),
      m('i7', 'sedan'),
      m('X1', 'suv'),
      m('X2', 'suv'),
      m('X3', 'suv'),
      m('X3 M', 'suv'),
      m('X4', 'suv', 'coupe'),
      m('X5', 'suv'),
      m('X5 M', 'suv'),
      m('X6', 'suv', 'coupe'),
      m('X7', 'suv'),
      m('XM', 'suv'),
      m('iX', 'suv'),
      m('iX3', 'suv'),
      m('M2', 'coupe'),
      m('M4', 'coupe'),
    ],
    Mercedes: [
      m('A 200 Sedan', 'sedan'),
      m('C 180', 'sedan'),
      m('C 200', 'sedan'),
      m('C 300', 'sedan'),
      m('C 300e', 'sedan'),
      m('E 200', 'sedan'),
      m('E 250', 'sedan'),
      m('E 300', 'sedan'),
      m('E 350', 'sedan'),
      m('E 450', 'sedan'),
      m('S 450', 'sedan'),
      m('S 500', 'sedan'),
      m('S 560', 'sedan'),
      m('S 580', 'sedan'),
      m('Maybach S 580', 'sedan'),
      m('EQS 450', 'sedan'),
      m('CLA 200', 'sedan', 'coupe'),
      m('CLS 450', 'sedan', 'coupe'),
      m('GLA 200', 'suv'),
      m('GLA 250', 'suv'),
      m('GLB 200', 'suv'),
      m('GLC 200', 'suv'),
      m('GLC 300', 'suv'),
      m('GLC 300e', 'suv'),
      m('GLE 350', 'suv'),
      m('GLE 450', 'suv'),
      m('GLE 450e', 'suv'),
      m('GLS 450', 'suv'),
      m('GLS 580', 'suv'),
      m('G 500', 'suv'),
      m('EQB 250', 'suv'),
      m('EQE SUV', 'suv'),
      m('EQS SUV', 'suv'),
      m('Vito', 'van', 'minivan'),
      m('V-Class', 'van', 'minivan'),
      m('EQV', 'van', 'minivan'),
      m('Sprinter', 'van'),
    ],
    Porsche: [
      m('Panamera', 'sedan'),
      m('Panamera 4S', 'sedan'),
      m('Panamera Turbo', 'sedan'),
      m('Macan', 'suv'),
      m('Macan S', 'suv'),
      m('Macan GTS', 'suv'),
      m('Cayenne', 'suv'),
      m('Cayenne S', 'suv'),
      m('Cayenne Coupe', 'suv', 'coupe'),
      m('Cayenne Turbo', 'suv'),
      m('Taycan', 'sedan'),
      m('Taycan Cross Turismo', 'wagon'),
      m('911 Carrera', 'coupe'),
    ],
    Volvo: [
      m('S60', 'sedan'),
      m('S90', 'sedan'),
      m('V60', 'wagon'),
      m('V90', 'wagon'),
      m('XC40', 'suv'),
      m('XC60', 'suv'),
      m('XC90', 'suv'),
      m('C40 Recharge', 'suv', 'coupe'),
      m('EX30', 'suv'),
      m('EX90', 'suv'),
    ],
    Toyota: [
      m('Corolla', 'sedan'),
      m('Corolla Hybrid', 'sedan'),
      m('Corolla Altis', 'sedan'),
      m('Camry', 'sedan'),
      m('Prius', 'hatch', 'sedan'),
      m('Corolla Cross', 'suv'),
      m('RAV4', 'suv'),
      m('SW4', 'suv'),
      m('Hilux SW4', 'suv'),
      m('Land Cruiser Prado', 'suv'),
      m('Land Cruiser', 'suv'),
      m('Hilux', 'pickup'),
      m('Yaris Sedan', 'sedan'),
      m('Yaris Hatch', 'hatch'),
    ],
    LandRover: [
      m('Discovery Sport', 'suv'),
      m('Discovery', 'suv'),
      m('Defender 90', 'suv'),
      m('Defender 110', 'suv'),
      m('Defender 130', 'suv'),
      m('Range Rover Evoque', 'suv'),
      m('Range Rover Velar', 'suv'),
      m('Range Rover Sport', 'suv'),
      m('Range Rover', 'suv'),
      m('Range Rover Autobiography', 'suv'),
    ],
    Jeep: [
      m('Renegade', 'suv'),
      m('Compass', 'suv'),
      m('Commander', 'suv'),
      m('Grand Cherokee', 'suv'),
      m('Grand Cherokee L', 'suv'),
      m('Wrangler', 'suv'),
      m('Gladiator', 'pickup'),
    ],
    Volkswagen: [
      m('Virtus', 'sedan'),
      m('Jetta', 'sedan'),
      m('Jetta GLI', 'sedan'),
      m('Passat', 'sedan'),
      m('Polo', 'hatch'),
      m('Golf', 'hatch'),
      m('Nivus', 'suv'),
      m('T-Cross', 'suv'),
      m('Taos', 'suv'),
      m('Tiguan', 'suv'),
      m('Tiguan Allspace', 'suv'),
      m('Touareg', 'suv'),
      m('ID.4', 'suv'),
      m('Caravelle', 'van', 'minivan'),
      m('Multivan', 'van', 'minivan'),
      m('Transporter', 'van'),
      m('Amarok', 'pickup'),
    ],
    Hyundai: [
      m('HB20S', 'sedan'),
      m('Elantra', 'sedan'),
      m('Sonata', 'sedan'),
      m('Azera', 'sedan'),
      m('Ioniq 6', 'sedan'),
      m('Creta', 'suv'),
      m('Tucson', 'suv'),
      m('Santa Fe', 'suv'),
      m('Palisade', 'suv'),
      m('Ioniq 5', 'suv'),
      m('Staria', 'van', 'minivan'),
      m('H1', 'van', 'minivan'),
    ],
    Kia: [
      m('Cerato', 'sedan'),
      m('K5', 'sedan'),
      m('Stinger', 'sedan', 'coupe'),
      m('Sportage', 'suv'),
      m('Sorento', 'suv'),
      m('Telluride', 'suv'),
      m('EV6', 'suv'),
      m('Carnival', 'minivan', 'van'),
      m('Grand Carnival', 'minivan', 'van'),
    ],
    Honda: [
      m('City', 'sedan'),
      m('Civic', 'sedan'),
      m('Civic Hybrid', 'sedan'),
      m('Accord', 'sedan'),
      m('HR-V', 'suv'),
      m('WR-V', 'suv'),
      m('CR-V', 'suv'),
      m('ZR-V', 'suv'),
      m('Pilot', 'suv'),
    ],
    Lexus: [
      m('ES 250', 'sedan'),
      m('ES 300h', 'sedan'),
      m('ES 350', 'sedan'),
      m('LS 500', 'sedan'),
      m('LS 500h', 'sedan'),
      m('UX 250h', 'suv'),
      m('NX 250', 'suv'),
      m('NX 350', 'suv'),
      m('NX 350h', 'suv'),
      m('RX 350', 'suv'),
      m('RX 500h', 'suv'),
      m('RX 450h+', 'suv'),
      m('GX 550', 'suv'),
      m('LX 600', 'suv'),
      m('LM 350h', 'minivan', 'van'),
    ],
    Jaguar: [
      m('XE', 'sedan'),
      m('XF', 'sedan'),
      m('XJ', 'sedan'),
      m('E-Pace', 'suv'),
      m('F-Pace', 'suv'),
      m('I-Pace', 'suv'),
      m('F-Type', 'coupe'),
    ],
    Chevrolet: [
      m('Onix Plus', 'sedan'),
      m('Prisma', 'sedan'),
      m('Cruze', 'sedan'),
      m('Malibu', 'sedan'),
      m('Tracker', 'suv'),
      m('Equinox', 'suv'),
      m('Trailblazer', 'suv'),
      m('Blazer', 'suv'),
      m('Traverse', 'suv'),
      m('Tahoe', 'suv'),
      m('Suburban', 'suv'),
      m('Spin', 'minivan'),
      m('S10', 'pickup'),
      m('Silverado', 'pickup'),
    ],
    Ford: [
      m('Fusion', 'sedan'),
      m('Territory', 'suv'),
      m('Bronco Sport', 'suv'),
      m('Explorer', 'suv'),
      m('Edge', 'suv'),
      m('Mustang Mach-E', 'suv'),
      m('Ranger', 'pickup'),
      m('F-150', 'pickup'),
      m('Transit', 'van'),
      m('Transit Custom', 'van'),
    ],
    BYD: [
      m('King', 'sedan'),
      m('Seal', 'sedan'),
      m('Han', 'sedan'),
      m('Dolphin', 'hatch'),
      m('Yuan Plus', 'suv'),
      m('Song Plus', 'suv'),
      m('Tang', 'suv'),
      m('Shark', 'pickup'),
    ],
    CaoaChery: [
      m('Arrizo 5', 'sedan'),
      m('Arrizo 6', 'sedan'),
      m('Arrizo 6 Pro', 'sedan'),
      m('Tiggo 5X', 'suv'),
      m('Tiggo 7', 'suv'),
      m('Tiggo 7 Pro', 'suv'),
      m('Tiggo 8', 'suv'),
      m('Tiggo 8 Pro', 'suv'),
      m('Tiggo 8 Max', 'suv'),
      m('iCar', 'hatch'),
    ],
    Mitsubishi: [
      m('Lancer', 'sedan'),
      m('ASX', 'suv'),
      m('Eclipse Cross', 'suv'),
      m('Outlander', 'suv'),
      m('Outlander Sport', 'suv'),
      m('Pajero Sport', 'suv'),
      m('Pajero Full', 'suv'),
      m('L200', 'pickup'),
      m('L200 Triton', 'pickup'),
    ],
    Nissan: [
      m('Versa', 'sedan'),
      m('Sentra', 'sedan'),
      m('Altima', 'sedan'),
      m('Kicks', 'suv'),
      m('X-Trail', 'suv'),
      m('Pathfinder', 'suv'),
      m('Patrol', 'suv'),
      m('Frontier', 'pickup'),
      m('NV350', 'van'),
    ],
    Renault: [
      m('Logan', 'sedan'),
      m('Fluence', 'sedan'),
      m('Duster', 'suv'),
      m('Captur', 'suv'),
      m('Kardian', 'suv'),
      m('Oroch', 'pickup'),
      m('Master', 'van'),
      m('Trafic', 'van'),
    ],
    Fiat: [
      m('Cronos', 'sedan'),
      m('Argo', 'hatch'),
      m('Pulse', 'suv'),
      m('Fastback', 'suv', 'coupe'),
      m('Toro', 'pickup'),
      m('Strada', 'pickup'),
      m('Scudo', 'van'),
      m('Ducato', 'van'),
    ],
    Peugeot: [
      m('208', 'hatch'),
      m('2008', 'suv'),
      m('3008', 'suv'),
      m('5008', 'suv'),
      m('Expert', 'van'),
      m('Boxer', 'van'),
    ],
    Citroen: [
      m('C3', 'hatch'),
      m('C3 Aircross', 'suv'),
      m('C4 Cactus', 'suv'),
      m('Basalt', 'suv', 'coupe'),
      m('Jumpy', 'van'),
      m('Jumper', 'van'),
    ],
    GWM: [
      m('Ora 03', 'hatch'),
      m('Haval H6', 'suv'),
      m('Haval H6 GT', 'suv', 'coupe'),
      m('Haval Jolion', 'suv'),
      m('Tank 300', 'suv'),
      m('Tank 500', 'suv'),
      m('Poer', 'pickup'),
    ],
    RAM: [
      m('1500', 'pickup'),
      m('2500', 'pickup'),
      m('3500', 'pickup'),
      m('Rampage', 'pickup'),
    ],
    Cadillac: [
      m('CT5', 'sedan'),
      m('CT6', 'sedan'),
      m('XT4', 'suv'),
      m('XT5', 'suv'),
      m('XT6', 'suv'),
      m('Escalade', 'suv'),
      m('Escalade ESV', 'suv'),
      m('Lyriq', 'suv'),
    ],
    Genesis: [
      m('G70', 'sedan'),
      m('G80', 'sedan'),
      m('G90', 'sedan'),
      m('GV70', 'suv'),
      m('GV80', 'suv'),
      m('Electrified GV70', 'suv'),
    ],
    Mini: [
      m('Cooper', 'hatch'),
      m('Cooper S', 'hatch'),
      m('Clubman', 'wagon', 'hatch'),
      m('Countryman', 'suv'),
    ],
    Tesla: [
      m('Model 3', 'sedan'),
      m('Model S', 'sedan'),
      m('Model Y', 'suv'),
      m('Model X', 'suv'),
    ],
    Subaru: [
      m('Legacy', 'sedan'),
      m('Impreza', 'sedan', 'hatch'),
      m('XV', 'suv'),
      m('Forester', 'suv'),
      m('Outback', 'wagon', 'suv'),
      m('Ascent', 'suv'),
    ],
    Mazda: [
      m('Mazda3 Sedan', 'sedan'),
      m('Mazda3 Hatch', 'hatch'),
      m('Mazda6', 'sedan'),
      m('CX-30', 'suv'),
      m('CX-5', 'suv'),
      m('CX-50', 'suv'),
      m('CX-60', 'suv'),
      m('CX-90', 'suv'),
    ],
  } as const

/** @deprecated Prefer FLEET_CATALOG + modelsForBrand(brand, body). */
export const FLEET_BRAND_MODELS: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(
    Object.entries(FLEET_CATALOG).map(([brand, entries]) => [
      brand,
      entries.map((e) => e.model),
    ]),
  )

export const FLEET_BRANDS: readonly string[] = Object.keys(FLEET_CATALOG).sort(
  (a, b) => a.localeCompare(b, 'pt-BR'),
)

function matchesBody(
  entry: FleetModelEntry,
  bodyType?: VehicleBodyType | null,
): boolean {
  if (!bodyType || bodyType === 'outro') return true
  return entry.bodies.includes(bodyType)
}

/** Marcas que têm ao menos um modelo para a carroceria. */
export function brandsForBody(
  bodyType?: VehicleBodyType | null,
): readonly string[] {
  if (!bodyType || bodyType === 'outro') return FLEET_BRANDS
  return FLEET_BRANDS.filter((brand) =>
    (FLEET_CATALOG[brand] ?? []).some((e) => matchesBody(e, bodyType)),
  )
}

/** Modelos da marca, opcionalmente filtrados pela carroceria. */
export function modelsForBrand(
  brand: string,
  bodyType?: VehicleBodyType | null,
): readonly string[] {
  const entries = FLEET_CATALOG[brand] ?? []
  return entries.filter((e) => matchesBody(e, bodyType)).map((e) => e.model)
}

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
