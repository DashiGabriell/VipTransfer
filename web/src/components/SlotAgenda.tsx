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
  mode?: 'book' | 'admin'
  className?: string
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
    <div className={`agenda-panel ${className}`.trim()}>
      <p className="agenda-panel__title">{t('agenda.title')}</p>
      <div className="agenda-nav">
        <button
          type="button"
          onClick={() => setDay((d) => addDays(d, -1))}
          aria-label={t('agenda.prevDay')}
        >
          ‹
        </button>
        <input
          type="date"
          min={mode === 'book' ? today : undefined}
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setDay((d) => addDays(d, 1))}
          aria-label={t('agenda.nextDay')}
        >
          ›
        </button>
        <button
          type="button"
          className="agenda-refresh"
          onClick={() => void load()}
        >
          {t('agenda.refresh')}
        </button>
      </div>

      <p className="agenda-day">
        {new Date(`${day}T12:00:00`).toLocaleDateString(locale, {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
        })}
      </p>

      {error && <p className="agenda-error">{error}</p>}

      {loading ? (
        <p className="agenda-day">{t('agenda.loading')}</p>
      ) : (
        <div className="agenda-grid">
          {slots.map((slot) => {
            const tone = slotTone(slot)
            const selected = selectedStart === slot.slot_start
            const canPick = mode === 'admin' ? true : slotSelectable(slot)

            return (
              <button
                key={slot.slot_start}
                type="button"
                disabled={mode === 'book' && !canPick}
                onClick={() => {
                  if (mode === 'book' && !canPick) return
                  onSelect(slot)
                }}
                className={`agenda-slot is-${tone}${selected ? ' is-selected' : ''}`}
                title={`${slot.occupied}/${slot.capacity}`}
              >
                <strong>{formatSlotLabel(slot.slot_start, locale)}</strong>
                <span>
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
                </span>
              </button>
            )
          })}
          {!slots.length && !error && (
            <p className="agenda-day" style={{ gridColumn: '1 / -1' }}>
              {t('agenda.empty')}
            </p>
          )}
        </div>
      )}

      <div className="agenda-legend">
        <span>
          <i className="dot-available" />
          {t('agenda.legendAvailable')}
        </span>
        <span>
          <i className="dot-limited" />
          {t('agenda.legendLimited')}
        </span>
        <span>
          <i className="dot-blocked" />
          {t('agenda.legendBlocked')}
        </span>
      </div>
    </div>
  )
}
