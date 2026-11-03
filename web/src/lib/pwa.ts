import { registerSW } from 'virtual:pwa-register'

export type PwaUpdateHandle = {
  needRefresh: boolean
  offlineReady: boolean
  update: () => void
}

type Listener = (state: PwaUpdateHandle) => void

let state: PwaUpdateHandle = {
  needRefresh: false,
  offlineReady: false,
  update: () => undefined,
}

const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener(state)
}

/**
 * Registers the service worker (production / preview).
 * Safe to call once from app bootstrap.
 */
export function setupPwa(): () => void {
  if (typeof window === 'undefined') return () => undefined

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      state = {
        ...state,
        needRefresh: true,
        update: () => {
          void updateSW(true)
        },
      }
      emit()
    },
    onOfflineReady() {
      state = { ...state, offlineReady: true }
      emit()
    },
    onRegisteredSW(swUrl, registration) {
      if (import.meta.env.DEV) {
        console.info('[pwa] SW registered', swUrl, registration?.scope)
      }
    },
    onRegisterError(error) {
      console.warn('[pwa] SW registration failed', error)
    },
  })

  state = {
    ...state,
    update: () => {
      void updateSW(true)
    },
  }

  return () => {
    listeners.clear()
  }
}

export function subscribePwa(listener: Listener): () => void {
  listeners.add(listener)
  listener(state)
  return () => listeners.delete(listener)
}

export function getPwaState(): PwaUpdateHandle {
  return state
}

/** True when running as installed PWA (standalone / iOS home screen). */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia('(display-mode: standalone)').matches
  const ios = 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return mq || ios
}
