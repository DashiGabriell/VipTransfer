import { isStandaloneDisplay } from './pwa'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type InstallState = {
  deferred: BeforeInstallPromptEvent | null
  standalone: boolean
  installed: boolean
}

type Listener = (state: InstallState) => void

let state: InstallState = {
  deferred: null,
  standalone: false,
  installed: false,
}

const listeners = new Set<Listener>()
let wired = false

function emit() {
  for (const listener of listeners) listener(state)
}

function refreshStandalone() {
  const next = isStandaloneDisplay() || state.installed
  if (next === state.standalone) return
  state = { ...state, standalone: next }
  emit()
}

function ensureWired() {
  if (wired || typeof window === 'undefined') return
  wired = true

  state = {
    ...state,
    standalone: isStandaloneDisplay(),
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    state = {
      ...state,
      deferred: event as BeforeInstallPromptEvent,
      installed: false,
      standalone: false,
    }
    emit()
  })

  window.addEventListener('appinstalled', () => {
    state = {
      deferred: null,
      installed: true,
      standalone: true,
    }
    emit()
  })

  const mq = window.matchMedia('(display-mode: standalone)')
  mq.addEventListener?.('change', refreshStandalone)
  refreshStandalone()
}

export function subscribePwaInstall(listener: Listener): () => void {
  ensureWired()
  listeners.add(listener)
  listener(state)
  return () => {
    listeners.delete(listener)
  }
}

export function getPwaInstallState(): InstallState {
  ensureWired()
  return state
}

export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  ensureWired()
  const deferred = state.deferred
  if (!deferred) return 'unavailable'

  await deferred.prompt()
  const choice = await deferred.userChoice
  state = {
    ...state,
    deferred: null,
    installed: choice.outcome === 'accepted',
    standalone: choice.outcome === 'accepted' || isStandaloneDisplay(),
  }
  emit()
  return choice.outcome
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
