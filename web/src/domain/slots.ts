const DEFAULT_SLOT_MINUTES = 60
/** Hold padrão: 12 horas (alinhado a capacity_settings.hold_minutes). */
const DEFAULT_HOLD_MINUTES = 720

export function buildSlotRange(
  date: string,
  time: string,
  slotMinutes = DEFAULT_SLOT_MINUTES,
): { slotStart: Date; slotEnd: Date } {
  const slotStart = new Date(`${date}T${time}:00`)
  const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60_000)
  return { slotStart, slotEnd }
}

export function holdExpiresAt(
  from: Date = new Date(),
  holdMinutes = DEFAULT_HOLD_MINUTES,
): Date {
  return new Date(from.getTime() + holdMinutes * 60_000)
}

export function formatCurrencyBRL(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/** Valor para `<input type="datetime-local">` no fuso do browser. */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Converte datetime-local do browser para ISO timestamptz. */
export function fromDatetimeLocalValue(local: string): Date | null {
  const trimmed = local.trim()
  if (!trimmed) return null
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export function canRescheduleReservation(
  status: string,
): status is 'hold' | 'hold_expirado' | 'confirmado' {
  return status === 'hold' || status === 'hold_expirado' || status === 'confirmado'
}
