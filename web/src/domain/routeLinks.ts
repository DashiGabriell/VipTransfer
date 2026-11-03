export type RoutePlaces = {
  origin: string
  destination: string
  stops?: string[] | null
}

function clean(value: string | null | undefined): string {
  return (value ?? '').trim()
}

export function routeWaypointList(places: RoutePlaces): string[] {
  const origin = clean(places.origin)
  const destination = clean(places.destination)
  const stops = (places.stops ?? []).map(clean).filter(Boolean)
  const points = [origin, ...stops, destination].filter(Boolean)
  return points
}

/** Google Maps driving directions with intermediate stops. */
export function buildGoogleMapsDirectionsUrl(places: RoutePlaces): string | null {
  const points = routeWaypointList(places)
  if (points.length < 2) return null

  const origin = points[0]
  const destination = points[points.length - 1]
  const waypoints = points.slice(1, -1)

  const url = new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api', '1')
  url.searchParams.set('travelmode', 'driving')
  url.searchParams.set('origin', origin)
  url.searchParams.set('destination', destination)
  if (waypoints.length) {
    url.searchParams.set('waypoints', waypoints.join('|'))
  }
  return url.toString()
}

/**
 * Waze deep link.
 * Multi-stop isn't supported by Waze URL scheme — opens navigation to the final destination.
 * When only origin+destination exist, still navigate to destination (driver starts from current GPS).
 */
export function buildWazeNavigateUrl(places: RoutePlaces): string | null {
  const points = routeWaypointList(places)
  if (!points.length) return null
  const destination = points[points.length - 1]
  const url = new URL('https://waze.com/ul')
  url.searchParams.set('q', destination)
  url.searchParams.set('navigate', 'yes')
  return url.toString()
}
