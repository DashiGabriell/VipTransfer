/** Formato canônico: JAN26-0001 (mês PT + ano 2 dígitos + seq). */
const SERVICE_CODE_RE = /^[A-Z]{3}\d{2}-\d{4}$/

export function isServiceCode(value: string | null | undefined): boolean {
  return Boolean(value && SERVICE_CODE_RE.test(value.trim().toUpperCase()))
}

export function formatServiceCode(
  value: string | null | undefined,
  fallback = '—',
): string {
  const code = (value ?? '').trim().toUpperCase()
  return code || fallback
}
