/** Full name: at least two non-empty words. */
export function isValidFullName(value: string): boolean {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  return parts.length >= 2
}

/**
 * Brazilian phone / WhatsApp: (DDD) + number.
 * Accepts: (11)987654321, (11) 98765-4321, (11) 9876-5432
 */
export function isValidBrazilPhone(value: string): boolean {
  const trimmed = value.trim()
  return /^\(\d{2}\)\s?\d{4,5}-?\d{4}$/.test(trimmed)
}

/** Practical e-mail shape (local@domain.tld). */
export function isValidEmail(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(trimmed)
}

/** Mask helper: keeps digits and formats as (DD) #####-#### while typing. */
export function formatBrazilPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)
  if (rest.length <= 4) return `(${ddd}) ${rest}`
  if (rest.length <= 8) {
    return `(${ddd}) ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`
  }
  // 9-digit mobile: #####-####
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
}
