import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  addDays,
  formatSlotLabel,
  slotSelectable,
  slotTone,
  toDateInputValue,
  type DaySlot,
} from '../domain/agenda'
import { listDaySlots } from '../services/agenda'

type Props = {
  organizationId: string | null
  selectedStart: string | null
  onSelect: (slot: DaySlot) => void
  /** Admin view shows occupancy counts always */
  mode?: 'book' | 'admin'
  className?: string
}

const toneClass: Record<ReturnType<typeof slotTone>, string> = {
  available:
    'border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-400',
  limited:
    'border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-400',
  full: 'cursor-not-allowed border-border-light bg-gray-100 text-gray-400',
  blocked: 'cursor-not-allowed border-border-light bg-gray-50 text-gray-400',
}

export function SlotAgenda({
  organizationId,
  selectedStart,
  onSelect,
  mode = 'book',
  className = '',
}: Props) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith('en') ? 'en-US' : 'pt-BR'
  const today = toDateInputValue(new Date())

  const [day, setDay] = useState(today)
  const [slots, setSlots] = useState<DaySlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId) {
      setSlots([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const rows = await listDaySlots(organizationId, day)
      setSlots(rows)
    } catch (err) {
      setSlots([])
      setError(err instanceof Error ? err.message : t('agenda.loadError'))
    } finally {
      setLoading(false)
    }
  }, [organizationId, day, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-border-light px-2 py-1 text-sm"
          onClick={() => setDay((d) => addDays(d, -1))}
          aria-label={t('agenda.prevDay')}
        >
          ‹
        </button>
        <input
          type="date"
          className="flex-1 rounded-lg border border-border-light px-3 py-2 text-sm"
          min={mode === 'book' ? today : undefined}
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        <button
          type="button"
          className="rounded-full border border-border-light px-2 py-1 text-sm"
          onClick={() => setDay((d) => addDays(d, 1))}
          aria-label={t('agenda.nextDay')}
        >
          ›
        </button>
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() => void load()}
        >
          {t('agenda.refresh')}
        </button>
      </div>

      <p className="text-xs text-text-secondary-light">
        {new Date(`${day}T12:00:00`).toLocaleDateString(locale, {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
        })}
      </p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {loading ? (
        <p className="text-xs text-text-secondary-light">{t('agenda.loading')}</p>
      ) : (
        <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {slots.map((slot) => {
            const tone = slotTone(slot)
            const selected = selectedStart === slot.slot_start
            const canPick = mode === 'admin' ? false : slotSelectable(slot)

            return (
              <button
                key={slot.slot_start}
                type="button"
                disabled={mode === 'book' && !canPick}
                onClick={() => {
                  if (mode === 'book' && canPick) onSelect(slot)
                  if (mode === 'admin') onSelect(slot)
                }}
                className={`rounded-xl border px-2 py-2 text-left text-xs transition ${toneClass[tone]} ${
                  selected ? 'ring-2 ring-primary ring-offset-1' : ''
                }`}
                title={`${slot.occupied}/${slot.capacity}`}
              >
                <div className="font-semibold">
                  {formatSlotLabel(slot.slot_start, locale)}
                </div>
                <div className="mt-0.5 opacity-80">
                  {slot.is_blackout
                    ? t('agenda.blackout')
                    : slot.is_past
                      ? t('agenda.past')
                      : slot.available <= 0
                        ? t('agenda.full')
                        : t('agenda.free', {
                            available: slot.available,
                            capacity: slot.capacity,
                          })}
                </div>
              </button>
            )
          })}
          {!slots.length && !error && (
            <p className="col-span-full py-6 text-center text-xs text-text-secondary-light">
              {t('agenda.empty')}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-[10px] text-text-secondary-light">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> {t('agenda.legendAvailable')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> {t('agenda.legendLimited')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-gray-300" /> {t('agenda.legendBlocked')}
        </span>
      </div>
    </div>
  )
}
