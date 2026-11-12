import type { AirportCode } from '../types/database'

/** [longitude, latitude] — GeoJSON / OSRM order */
export type LonLat = [number, number]

/** Photon (Komoot) — geocode OSM-friendly with browser CORS. */
const PHOTON_SEARCH = 'https://photon.komoot.io/api/'
/** Public OSRM demo — driving distance (meters). */
const OSRM_ROUTE = 'https://router.project-osrm.org/route/v1/driving'

/** Known São Paulo airport centroids (lon, lat). */
export const AIRPORT_COORDS: Record<AirportCode, LonLat> = {
  GRU: [-46.473056, -23.435556],
  CGH: [-46.656389, -23.626111],
  VCP: [-47.134444, -23.006944],
}

const AIRPORT_ALIASES: Record<string, AirportCode> = {
  gru: 'GRU',
  'sao paulo gru': 'GRU',
  'são paulo gru': 'GRU',
  'aeroporto de guarulhos': 'GRU',
  'aeroporto internacional de guarulhos': 'GRU',
  cgh: 'CGH',
  'sao paulo cgh': 'CGH',
  'são paulo cgh': 'CGH',
  'aeroporto de congonhas': 'CGH',
  congonhas: 'CGH',
  vcp: 'VCP',
  'campinas vcp': 'VCP',
  'aeroporto de viracopos': 'VCP',
  viracopos: 'VCP',
}

export class DistanceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DistanceError'
  }
}

function normalizePlace(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function resolveAirportCode(text: string): AirportCode | null {
  const n = normalizePlace(text)
  if (!n) return null
  if (n === 'gru' || n === 'cgh' || n === 'vcp') {
    return n.toUpperCase() as AirportCode
  }
  return AIRPORT_ALIASES[n] ?? null
}

export type GeocodeHit = {
  coords: LonLat
  /** Human-readable label from Photon / airport alias. */
  label: string
}

/** In-memory cache so field validation + distance don't hit Photon twice. */
const GEOCODE_CACHE = new Map<string, GeocodeHit>()
const GEOCODE_CACHE_MAX = 80

function geocodeCacheKey(query: string): string {
  return normalizePlace(query)
}

function readGeocodeCache(query: string): GeocodeHit | null {
  return GEOCODE_CACHE.get(geocodeCacheKey(query)) ?? null
}

function writeGeocodeCache(query: string, hit: GeocodeHit): void {
  const key = geocodeCacheKey(query)
  if (GEOCODE_CACHE.has(key)) GEOCODE_CACHE.delete(key)
  GEOCODE_CACHE.set(key, hit)
  while (GEOCODE_CACHE.size > GEOCODE_CACHE_MAX) {
    const oldest = GEOCODE_CACHE.keys().next().value
    if (oldest == null) break
    GEOCODE_CACHE.delete(oldest)
  }
}

type PhotonProps = {
  name?: string
  street?: string
  housenumber?: string
  district?: string
  city?: string
  town?: string
  village?: string
  county?: string
  state?: string
  country?: string
  postcode?: string
}

function formatPhotonLabel(props: PhotonProps | undefined): string {
  if (!props) return ''
  const streetLine = [props.street, props.housenumber].filter(Boolean).join(', ')
  const place =
    props.city || props.town || props.village || props.district || props.county
  const parts = [
    props.name && props.name !== streetLine ? props.name : null,
    streetLine || null,
    place || null,
    props.state || null,
  ].filter(Boolean) as string[]
  // Prefer street+city when name duplicates street
  const unique: string[] = []
  for (const p of parts) {
    if (!unique.some((u) => u.toLowerCase() === p.toLowerCase())) unique.push(p)
  }
  return unique.join(' — ')
}

/**
 * Geocode via Photon (OpenStreetMap data). No API key.
 * Prefer airport aliases / fixed coords when possible.
 * Returns coordinates + the label Photon matched (for UI confirmation).
 */
export async function geocodePlace(
  text: string,
  signal?: AbortSignal,
): Promise<GeocodeHit> {
  const trimmed = text.trim()
  if (!trimmed) throw new DistanceError('EMPTY_ADDRESS')

  const airport = resolveAirportCode(trimmed)
  if (airport) {
    return {
      coords: AIRPORT_COORDS[airport],
      label: `Aeroporto ${airport}`,
    }
  }

  // Bias search toward Brazil / São Paulo metro
  const query = /brasil|brazil|são paulo|sao paulo|sp\b/i.test(trimmed)
    ? trimmed
    : `${trimmed}, São Paulo, Brasil`

  const cached = readGeocodeCache(query)
  if (cached) return cached

  const url = new URL(PHOTON_SEARCH)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '1')
  // Photon só aceita: default | de | en | fr — nunca pt/pt-BR (400).
  url.searchParams.set('lang', 'en')
  url.searchParams.set('lat', '-23.5505')
  url.searchParams.set('lon', '-46.6333')

  const res = await fetch(url.toString(), {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new DistanceError(`GEOCODE_HTTP_${res.status}`)
  }

  const data = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: number[] }
      properties?: PhotonProps
    }>
  }
  const feature = data.features?.[0]
  const coords = feature?.geometry?.coordinates
  if (!coords || coords.length < 2) {
    throw new DistanceError('GEOCODE_NOT_FOUND')
  }

  const label = formatPhotonLabel(feature?.properties) || trimmed
  const hit: GeocodeHit = {
    coords: [Number(coords[0]), Number(coords[1])],
    label,
  }
  writeGeocodeCache(query, hit)
  return hit
}

export async function geocodeAddress(
  text: string,
  signal?: AbortSignal,
): Promise<LonLat> {
  const hit = await geocodePlace(text, signal)
  return hit.coords
}

export type RouteDistanceResult = {
  km: number
  meters: number
  points: LonLat[]
}

/**
 * Driving distance for ordered waypoints: origin → stops… → destination.
 * Uses public OSRM (OpenStreetMap) — no API key required.
 */
export async function measureDrivingDistanceKm(
  waypoints: string[],
  signal?: AbortSignal,
): Promise<RouteDistanceResult> {
  const cleaned = waypoints.map((w) => w.trim()).filter(Boolean)
  if (cleaned.length < 2) {
    throw new DistanceError('NEED_ORIGIN_DESTINATION')
  }

  // Parallel geocode — cache hits from field validation make this near-instant.
  const points = await Promise.all(
    cleaned.map((place) => geocodeAddress(place, signal)),
  )

  const path = points.map(([lon, lat]) => `${lon},${lat}`).join(';')
  const url = new URL(`${OSRM_ROUTE}/${path}`)
  url.searchParams.set('overview', 'false')
  url.searchParams.set('steps', 'false')
  url.searchParams.set('alternatives', 'false')

  const res = await fetch(url.toString(), {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new DistanceError(`DIRECTIONS_HTTP_${res.status}`)
  }

  const data = (await res.json()) as {
    code?: string
    routes?: Array<{ distance?: number }>
  }

  if (data.code && data.code !== 'Ok') {
    throw new DistanceError(`DIRECTIONS_${data.code}`)
  }

  const meters = data.routes?.[0]?.distance
  if (meters == null || !Number.isFinite(meters)) {
    throw new DistanceError('DIRECTIONS_NO_DISTANCE')
  }

  const km = Math.round((meters / 1000) * 10) / 10
  return { km, meters, points }
}

export function buildRouteWaypoints(input: {
  origin: string
  stops: string[]
  destination: string
  airport?: AirportCode | '' | null
}): string[] {
  const origin = input.origin.trim()
  const destinationRaw = input.destination.trim()
  const airport = input.airport || null

  let destination = destinationRaw
  if (airport && (!destination || resolveAirportCode(destination) === airport)) {
    destination = airport
  } else if (!destination && airport) {
    destination = airport
  }

  return [
    origin,
    ...input.stops.map((s) => s.trim()).filter(Boolean),
    destination,
  ].filter(Boolean)
}
