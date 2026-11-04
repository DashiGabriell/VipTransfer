import { useEffect, useState } from 'react'
import {
  DistanceError,
  geocodeAddress,
  resolveAirportCode,
} from '../services/distance'

export type GeocodeFieldStatus =
  | 'idle'
  | 'empty'
  | 'short'
  | 'checking'
  | 'ok'
  | 'error'

const MIN_CHARS = 8
const DEBOUNCE_MS = 650

/**
 * Valida endereço via Photon (geocodeAddress).
 * enabled=false → idle (campo oculto / não aplicável).
 * Códigos de aeroporto (GRU/CGH/VCP) passam sem mínimo de caracteres.
 */
export function useGeocodedAddress(
  text: string,
  enabled = true,
): GeocodeFieldStatus {
  const [status, setStatus] = useState<GeocodeFieldStatus>('idle')

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      return
    }

    const trimmed = text.trim()
    if (!trimmed) {
      setStatus('empty')
      return
    }

    const isAirport = Boolean(resolveAirportCode(trimmed))
    if (!isAirport && trimmed.length < MIN_CHARS) {
      setStatus('short')
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setStatus('checking')
      void geocodeAddress(trimmed, controller.signal)
        .then(() => {
          if (!controller.signal.aborted) setStatus('ok')
        })
        .catch((err) => {
          if (controller.signal.aborted) return
          if (err instanceof DOMException && err.name === 'AbortError') return
          if (err instanceof DistanceError && err.message === 'EMPTY_ADDRESS') {
            setStatus('empty')
            return
          }
          setStatus('error')
        })
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [text, enabled])

  return status
}

export function isGeocodeOk(status: GeocodeFieldStatus): boolean {
  return status === 'ok'
}
