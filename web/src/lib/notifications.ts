export type NotificationPermissionState =
  | NotificationPermission
  | 'unsupported'

export class AppNotificationError extends Error {
  code: 'UNSUPPORTED' | 'DENIED' | 'SECURE_CONTEXT' | 'UNKNOWN'

  constructor(
    message: string,
    code: 'UNSUPPORTED' | 'DENIED' | 'SECURE_CONTEXT' | 'UNKNOWN',
  ) {
    super(message)
    this.name = 'AppNotificationError'
    this.code = code
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * Requests browser notification permission (must run from a user gesture).
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) return 'unsupported'
  if (!window.isSecureContext) {
    throw new AppNotificationError(
      'Notificações exigem HTTPS (ou localhost).',
      'SECURE_CONTEXT',
    )
  }

  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'

  try {
    const result = await Notification.requestPermission()
    return result
  } catch (err) {
    throw new AppNotificationError(
      err instanceof Error ? err.message : 'Falha ao pedir permissão.',
      'UNKNOWN',
    )
  }
}

export type LocalNotificationInput = {
  title: string
  body?: string
  icon?: string
  badge?: string
  tag?: string
  data?: unknown
  requireInteraction?: boolean
}

/**
 * Shows a local notification. Prefers the active service worker when available
 * (required for installed PWAs / background).
 */
export async function showLocalNotification(
  input: LocalNotificationInput,
): Promise<void> {
  const permission = getNotificationPermission()
  if (permission === 'unsupported') {
    throw new AppNotificationError(
      'Notificações não suportadas neste navegador.',
      'UNSUPPORTED',
    )
  }
  if (permission !== 'granted') {
    throw new AppNotificationError(
      'Permissão de notificação não concedida.',
      'DENIED',
    )
  }

  const options: NotificationOptions = {
    body: input.body,
    icon: input.icon ?? '/icons/pwa-192.png',
    badge: input.badge ?? '/icons/pwa-192.png',
    tag: input.tag,
    data: input.data,
    requireInteraction: input.requireInteraction,
  }

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(input.title, options)
    return
  }

  // Fallback (desktop browsers without SW ready)
  // eslint-disable-next-line no-new
  new Notification(input.title, options)
}

/**
 * Placeholder for future Web Push subscription (VAPID).
 * Returns null until a public VAPID key is configured.
 */
export async function subscribePushNotifications(
  vapidPublicKey: string | undefined,
): Promise<PushSubscription | null> {
  if (!vapidPublicKey?.trim()) return null
  if (!isPushSupported()) {
    throw new AppNotificationError(
      'Push não suportado neste dispositivo.',
      'UNSUPPORTED',
    )
  }

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') {
    throw new AppNotificationError(
      'Permissão de notificação negada.',
      'DENIED',
    )
  }

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  if (existing) return existing

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}
