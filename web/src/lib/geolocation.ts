export type GeoPosition = {
  latitude: number
  longitude: number
  accuracy: number
  altitude: number | null
  heading: number | null
  speed: number | null
  timestamp: number
}

export type GeoPermissionState = PermissionState | 'unsupported'

export class GeolocationError extends Error {
  code: 'UNSUPPORTED' | 'DENIED' | 'UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN'

  constructor(
    message: string,
    code: 'UNSUPPORTED' | 'DENIED' | 'UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN',
  ) {
    super(message)
    this.name = 'GeolocationError'
    this.code = code
  }
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

export async function getGeolocationPermission(): Promise<GeoPermissionState> {
  if (!isGeolocationSupported()) return 'unsupported'
  if (!('permissions' in navigator) || !navigator.permissions?.query) {
    return 'prompt'
  }
  try {
    const status = await navigator.permissions.query({
      name: 'geolocation' as PermissionName,
    })
    return status.state
  } catch {
    return 'prompt'
  }
}

function mapPosition(pos: GeolocationPosition): GeoPosition {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    altitude: pos.coords.altitude,
    heading: pos.coords.heading,
    speed: pos.coords.speed,
    timestamp: pos.timestamp,
  }
}

function mapError(err: GeolocationPositionError): GeolocationError {
  if (err.code === err.PERMISSION_DENIED) {
    return new GeolocationError('Localização negada pelo usuário.', 'DENIED')
  }
  if (err.code === err.POSITION_UNAVAILABLE) {
    return new GeolocationError('Posição indisponível.', 'UNAVAILABLE')
  }
  if (err.code === err.TIMEOUT) {
    return new GeolocationError('Tempo esgotado ao obter localização.', 'TIMEOUT')
  }
  return new GeolocationError(err.message || 'Falha de geolocalização.', 'UNKNOWN')
}

export function getCurrentPosition(
  options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 15_000,
    maximumAge: 10_000,
  },
): Promise<GeoPosition> {
  if (!isGeolocationSupported()) {
    return Promise.reject(
      new GeolocationError('Geolocalização não suportada.', 'UNSUPPORTED'),
    )
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(mapPosition(pos)),
      (err) => reject(mapError(err)),
      options,
    )
  })
}

export function watchPosition(
  onUpdate: (pos: GeoPosition) => void,
  onError?: (err: GeolocationError) => void,
  options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 20_000,
    maximumAge: 5_000,
  },
): () => void {
  if (!isGeolocationSupported()) {
    onError?.(
      new GeolocationError('Geolocalização não suportada.', 'UNSUPPORTED'),
    )
    return () => undefined
  }

  const id = navigator.geolocation.watchPosition(
    (pos) => onUpdate(mapPosition(pos)),
    (err) => onError?.(mapError(err)),
    options,
  )

  return () => navigator.geolocation.clearWatch(id)
}
