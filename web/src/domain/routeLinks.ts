export type RoutePlaces = {
  origin: string
  destination: string
  stops?: string[] | null
}

function clean(value: string | null | undefined): string {
  return (value ?? '').trim()
}

/** Aceita text[], JSON string ou valor solto vindo do banco/cliente. */
export function normalizeStops(stops: unknown): string[] {
  if (stops == null) return []

  if (Array.isArray(stops)) {
    return stops.map((s) => clean(String(s ?? ''))).filter(Boolean)
  }

  if (typeof stops === 'string') {
    const trimmed = stops.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[')) {
      try {
        return normalizeStops(JSON.parse(trimmed) as unknown)
      } catch {
        /* fall through */
      }
    }
    return [trimmed]
  }

  return []
}

export function routeWaypointList(places: RoutePlaces): string[] {
  const origin = clean(places.origin)
  const destination = clean(places.destination)
  const stops = normalizeStops(places.stops)
  return [origin, ...stops, destination].filter(Boolean)
}

/**
 * Google Maps: origem → paradas → destino.
 * Usa path segments (pins em cada endereço) + travelmode=driving.
 * Mais confiável no app mobile do que só `waypoints=` na query.
 */
export function buildGoogleMapsDirectionsUrl(places: RoutePlaces): string | null {
  const points = routeWaypointList(places)
  if (points.length < 2) return null

  const path = points.map((p) => encodeURIComponent(p)).join('/')
  const url = new URL(`https://www.google.com/maps/dir/${path}`)
  url.searchParams.set('api', '1')
  url.searchParams.set('travelmode', 'driving')

  // Reforço: também envia origin/destination/waypoints na query
  // (alguns clients mobile preferem o formato oficial Maps URLs).
  url.searchParams.set('origin', points[0]!)
  url.searchParams.set('destination', points[points.length - 1]!)
  const waypoints = points.slice(1, -1)
  if (waypoints.length) {
    url.searchParams.set('waypoints', waypoints.join('|'))
  }

  return url.toString()
}

/**
 * Waze deep link.
 * Multi-stop não é suportado pelo scheme do Waze — navega até o destino final.
 */
export function buildWazeNavigateUrl(places: RoutePlaces): string | null {
  const points = routeWaypointList(places)
  if (!points.length) return null
  const destination = points[points.length - 1]!
  const url = new URL('https://waze.com/ul')
  url.searchParams.set('q', destination)
  url.searchParams.set('navigate', 'yes')
  return url.toString()
}
