const DEFAULT_SLUG =
  (import.meta.env.VITE_DEFAULT_TENANT_SLUG as string | undefined)?.trim() ||
  'jmd'

/** TLDs compostos (apex tem 3 labels: exemplo.com.br). */
const COMPOUND_TLDS = new Set([
  'com.br',
  'net.br',
  'org.br',
  'co.uk',
  'com.au',
  'co.nz',
])

/**
 * Resolve tenant slug from hostname.
 * - jmd.localhost → jmd
 * - jmd.jmdtransfer.com.br → jmd
 * - jmdtransfer.com.br / www.… / *.vercel.app → VITE_DEFAULT_TENANT_SLUG (jmd)
 *
 * Não trata o nome do apex (ex.: "jmdtransfer" em jmdtransfer.com.br) como slug —
 * a org seed é `jmd`.
 */
export function resolveTenantSlug(
  hostname: string = typeof window !== 'undefined'
    ? window.location.hostname
    : 'localhost',
): string {
  const host = hostname.toLowerCase().split(':')[0]

  if (host === 'localhost' || host === '127.0.0.1') {
    return DEFAULT_SLUG
  }

  // Preview / hosts de plataforma: projeto ≠ tenant
  if (
    host.endsWith('.vercel.app') ||
    host.endsWith('.netlify.app') ||
    host.endsWith('.pages.dev')
  ) {
    return DEFAULT_SLUG
  }

  const parts = host.split('.').filter(Boolean)

  // jmd.localhost
  if (parts.length === 2 && parts[1] === 'localhost' && parts[0]) {
    return parts[0]
  }

  // remove www
  if (parts[0] === 'www') {
    parts.shift()
  }

  if (parts.length < 2) {
    return DEFAULT_SLUG
  }

  const lastTwo = parts.slice(-2).join('.')
  const apexLength = COMPOUND_TLDS.has(lastTwo) ? 3 : 2

  // Apex domain (jmdtransfer.com.br, example.com) → default tenant
  if (parts.length <= apexLength) {
    return DEFAULT_SLUG
  }

  const subdomain = parts[0]
  if (!subdomain || subdomain === 'www') {
    return DEFAULT_SLUG
  }

  return subdomain
}

export function defaultTenantSlug(): string {
  return DEFAULT_SLUG
}
