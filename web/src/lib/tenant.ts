const DEFAULT_SLUG =
  (import.meta.env.VITE_DEFAULT_TENANT_SLUG as string | undefined) ?? 'jmd'

/**
 * Resolve tenant slug from hostname.
 * - jmd.localhost / jmd.example.com → jmd
 * - localhost / 127.0.0.1 → default slug (local without subdomain)
 */
export function resolveTenantSlug(
  hostname: string = window.location.hostname,
): string {
  const host = hostname.toLowerCase().split(':')[0]

  if (host === 'localhost' || host === '127.0.0.1') {
    return DEFAULT_SLUG
  }

  const parts = host.split('.')
  if (parts.length >= 2 && parts[0] && parts[0] !== 'www') {
    // jmd.localhost or jmd.app.com
    if (parts[1] === 'localhost' || parts.length >= 3) {
      return parts[0]
    }
  }

  return DEFAULT_SLUG
}
