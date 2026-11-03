const DEFAULT_SLOT_MINUTES = 30
const DEFAULT_HOLD_MINUTES = 60

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
