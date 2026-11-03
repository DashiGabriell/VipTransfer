export type DaySlot = {
  slot_start: string
  slot_end: string
  capacity: number
  occupied: number
  available: number
  is_past: boolean
  is_blackout: boolean
}

export function slotSelectable(slot: DaySlot): boolean {
  return !slot.is_past && !slot.is_blackout && slot.available > 0
}

export function slotTone(
  slot: DaySlot,
): 'available' | 'limited' | 'full' | 'blocked' {
  if (slot.is_past || slot.is_blackout) return 'blocked'
  if (slot.available <= 0) return 'full'
  if (slot.occupied > 0) return 'limited'
  return 'available'
}

export function formatSlotLabel(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(dateStr: string, days: number): string {
  const dt = new Date(`${dateStr}T12:00:00`)
  dt.setDate(dt.getDate() + days)
  return toDateInputValue(dt)
}
