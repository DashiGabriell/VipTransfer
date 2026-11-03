import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createAvailabilityWindow,
  deleteAvailabilityWindow,
  listAvailabilityWindows,
  type AvailabilityWindow,
} from '../../services/admin'

type Props = {
  organizationId: string
  onError: (msg: string) => void
  onChanged?: () => void
}

export function AvailabilityPanel({
  organizationId,
  onError,
  onChanged,
}: Props) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<AvailabilityWindow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'weekly' | 'date'>('date')
  const [dayOfWeek, setDayOfWeek] = useState('1')
  const [specificDate, setSpecificDate] = useState('')
  const [startTime, setStartTime] = useState('06:00')
  const [endTime, setEndTime] = useState('22:00')
  const [isBlackout, setIsBlackout] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAvailabilityWindows(organizationId)
      setRows(data)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Availability load failed')
    } finally {
      setLoading(false)
    }
  }, [organizationId, onError])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await createAvailabilityWindow({
        organization_id: organizationId,
        day_of_week: mode === 'weekly' ? Number(dayOfWeek) : null,
        specific_date: mode === 'date' ? specificDate : null,
        start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
        end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
        is_blackout: isBlackout,
      })
      setSpecificDate('')
      await refresh()
      onChanged?.()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Availability create failed')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteAvailabilityWindow(id)
      await refresh()
      onChanged?.()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Availability delete failed')
    }
  }

  function formatWindow(row: AvailabilityWindow) {
    const when =
      row.specific_date != null
        ? row.specific_date
        : t(`admin.days.${row.day_of_week ?? 0}`)
    const start = String(row.start_time).slice(0, 5)
    const end = String(row.end_time).slice(0, 5)
    return `${when} · ${start}–${end}`
  }

  return (
    <section className="admin-panel-enter space-y-4 rounded-2xl border border-border-light bg-surface-light p-5">
      <div>
        <h2 className="font-semibold text-primary">
          {t('admin.availabilityTitle')}
        </h2>
        <p className="mt-1 text-sm text-text-secondary-light">
          {t('admin.availabilityLead')}
        </p>
      </div>

      <form onSubmit={onAdd} className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          {t('admin.availabilityType')}
          <select
            className="mt-1 w-full rounded-lg border border-border-light px-3 py-2"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'weekly' | 'date')}
          >
            <option value="date">{t('admin.typeDate')}</option>
            <option value="weekly">{t('admin.typeWeekly')}</option>
          </select>
        </label>

        {mode === 'weekly' ? (
          <label className="block text-sm">
            {t('admin.dayOfWeek')}
            <select
              className="mt-1 w-full rounded-lg border border-border-light px-3 py-2"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value)}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                <option key={d} value={d}>
                  {t(`admin.days.${d}`)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block text-sm">
            {t('admin.specificDate')}
            <input
              type="date"
              required
              className="mt-1 w-full rounded-lg border border-border-light px-3 py-2"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
            />
          </label>
        )}

        <label className="block text-sm">
          {t('admin.startTime')}
          <input
            type="time"
            required
            className="mt-1 w-full rounded-lg border border-border-light px-3 py-2"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </label>

        <label className="block text-sm">
          {t('admin.endTime')}
          <input
            type="time"
            required
            className="mt-1 w-full rounded-lg border border-border-light px-3 py-2"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </label>

        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={isBlackout}
            onChange={(e) => setIsBlackout(e.target.checked)}
          />
          {t('admin.isBlackout')}
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-text-primary-dark disabled:opacity-60 md:col-span-2"
        >
          {saving ? '…' : t('admin.addWindow')}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-text-secondary-light">{t('agenda.loading')}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 border-b border-border-light/70 py-2"
            >
              <div>
                <div className="font-medium">{formatWindow(row)}</div>
                <div className="text-xs text-text-secondary-light">
                  {row.is_blackout
                    ? t('admin.blackoutBadge')
                    : t('admin.openBadge')}
                </div>
              </div>
              <button
                type="button"
                className="rounded border border-border-light px-2 py-1 text-xs"
                onClick={() => void onDelete(row.id)}
              >
                {t('admin.deleteWindow')}
              </button>
            </li>
          ))}
          {!rows.length && (
            <li className="text-text-secondary-light">
              {t('admin.windowsEmpty')}
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
