import { createContext, useContext } from 'react'
import type {
  Driver,
  DriverJobDetail,
  JobAssignment,
} from '../../types/database'

export type DriverAppContextValue = {
  driver: Driver | null
  assignments: JobAssignment[]
  details: Record<string, DriverJobDetail>
  loading: boolean
  error: string | null
  setError: (msg: string | null) => void
  offeredCount: number
  refresh: () => Promise<void>
  locale: string
}

export const DriverAppContext = createContext<DriverAppContextValue | null>(
  null,
)

export function useDriverApp(): DriverAppContextValue {
  const ctx = useContext(DriverAppContext)
  if (!ctx) {
    throw new Error('useDriverApp must be used inside DriverLayout')
  }
  return ctx
}

export function driverInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'M'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

export function statusBadgeClass(status: string): string {
  if (status === 'aceito') return 'is-aceito'
  if (status === 'concluido') return 'is-concluido'
  return ''
}

export function IconBriefcase() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 7V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1m-10 0h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 13l4 4L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconUser() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20 21a8 8 0 1 0-16 0m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconMore() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  )
}

export function IconRouteMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="10" r="2.2" fill="currentColor" />
    </svg>
  )
}
