import type { DriverAvailabilitySlot } from '../types/database'

export const DRIVER_SKILL_OPTIONS = [
  'executivo',
  'aeroporto',
  'blindado',
  'idiomas',
  'eventos',
  'longa_distancia',
] as const

export type DriverSkillOption = (typeof DRIVER_SKILL_OPTIONS)[number]

export const WEEK_DAYS = [
  { value: 0, labelKey: 'admin.days.0' },
  { value: 1, labelKey: 'admin.days.1' },
  { value: 2, labelKey: 'admin.days.2' },
  { value: 3, labelKey: 'admin.days.3' },
  { value: 4, labelKey: 'admin.days.4' },
  { value: 5, labelKey: 'admin.days.5' },
  { value: 6, labelKey: 'admin.days.6' },
] as const

export function emptyAvailability(): DriverAvailabilitySlot[] {
  return [{ day_of_week: 1, start_time: '08:00', end_time: '18:00' }]
}
