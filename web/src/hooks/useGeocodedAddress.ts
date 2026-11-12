import { useEffect, useState } from 'react'
import {
  DistanceError,
  geocodePlace,
  resolveAirportCode,
} from '../services/distance'

export type GeocodeFieldStatus =
  | 'idle'
  | 'empty'
  | 'short'
  | 'checking'
  | 'ok'
  | 'error'

export type GeocodeFieldState = {
  status: GeocodeFieldStatus
  /** Endereço que o Photon devolveu (quando status === 'ok'). */
  label: string | null
}

const MIN_CHARS = 8
/** Wait for typing to settle before calling Photon (was 650ms — felt sluggish). */
const DEBOUNCE_MS = 380

/**
 * Valida endereço via Photon (geocodePlace).
 * enabled=false → idle (campo oculto / não aplicável).
 * Códigos de aeroporto (GRU/CGH/VCP) passam sem mínimo de caracteres.
 */
export function useGeocodedAddress(
  text: string,
  enabled = true,
): GeocodeFieldState {
  const [state, setState] = useState<GeocodeFieldState>({
    status: 'idle',
    label: null,
  })

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', label: null })
      return
    }

    const trimmed = text.trim()
    if (!trimmed) {
      setState({ status: 'empty', label: null })
      return
    }

    const isAirport = Boolean(resolveAirportCode(trimmed))
    if (!isAirport && trimmed.length < MIN_CHARS) {
      setState({ status: 'short', label: null })
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setState((prev) => ({
        status: 'checking',
        // Keep last good label while revalidating — feels less “stuck”.
        label: prev.status === 'ok' ? prev.label : null,
      }))
      void geocodePlace(trimmed, controller.signal)
        .then((hit) => {
          if (!controller.signal.aborted) {
            setState({ status: 'ok', label: hit.label })
          }
        })
        .catch((err) => {
          if (controller.signal.aborted) return
          if (err instanceof DOMException && err.name === 'AbortError') return
          if (err instanceof DistanceError && err.message === 'EMPTY_ADDRESS') {
            setState({ status: 'empty', label: null })
            return
          }
          setState({ status: 'error', label: null })
        })
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [text, enabled])

  return state
}

export function isGeocodeOk(state: GeocodeFieldState): boolean {
  return state.status === 'ok'
}
