/** Production site used in WhatsApp / share links when running on localhost. */
const DEFAULT_PUBLIC_SITE_URL = 'https://jmdtrasnfer.vercel.app'

/**
 * Absolute public origin for links sent outside the current browser
 * (WhatsApp, e-mail). Never returns localhost.
 */
export function publicSiteOrigin(): string {
  const fromEnv = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)
    ?.trim()
    .replace(/\/$/, '')
  if (fromEnv) return fromEnv

  if (typeof window !== 'undefined') {
    const { protocol, hostname, origin } = window.location
    const local =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.localhost')
    if (!local && (protocol === 'http:' || protocol === 'https:')) {
      return origin
    }
  }

  return DEFAULT_PUBLIC_SITE_URL
}

export function driverOffersPageUrl(): string {
  return `${publicSiteOrigin()}/motorista/ofertas`
}
