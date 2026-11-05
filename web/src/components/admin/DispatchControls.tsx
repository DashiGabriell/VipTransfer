import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  assignReservationToDriver,
  completeReservationJob,
  dispatchLabel,
} from '../../services/coreV2'
import type { Driver, JobAssignment, Reservation } from '../../types/database'

type Props = {
  reservation: Reservation
  drivers: Driver[]
  assignments: JobAssignment[]
  onChanged: () => void
  onError: (msg: string) => void
}

export function DispatchControls({
  reservation,
  drivers,
  assignments,
  onChanged,
  onError,
}: Props) {
  const { t } = useTranslation()
  const [driverId, setDriverId] = useState('')
  const [busy, setBusy] = useState(false)

  const label = dispatchLabel(assignments, reservation.id)
  const eligible = useMemo(() => {
    return drivers.filter((d) => {
      if (!d.active || !d.profile_complete) return false
      if (
        reservation.vehicle_category_id &&
        d.vehicle_category_id !== reservation.vehicle_category_id
      ) {
        return false
      }
      return true
    })
  }, [drivers, reservation.vehicle_category_id])

  if (reservation.status !== 'confirmado' && reservation.status !== 'concluido') {
    return null
  }

  async function onAssign() {
    if (!driverId) {
      onError(t('admin.dispatch.pickDriver'))
      return
    }
    setBusy(true)
    onError('')
    try {
      await assignReservationToDriver(reservation.id, driverId)
      setDriverId('')
      onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : t('admin.dispatch.assignError'))
    } finally {
      setBusy(false)
    }
  }

  async function onComplete() {
    setBusy(true)
    onError('')
    try {
      await completeReservationJob(reservation.id)
      onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : t('admin.dispatch.completeError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-dispatch">
      <span className="admin-dispatch__badge">
        {t(`admin.dispatch.status.${label}`)}
      </span>

      {label === 'sem_motorista' && reservation.status === 'confirmado' ? (
        <div className="admin-dispatch__row">
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            disabled={busy || !eligible.length}
          >
            <option value="">
              {eligible.length
                ? t('admin.dispatch.pickDriver')
                : t('admin.dispatch.noDrivers')}
            </option>
            {eligible.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="admin-res-actions__confirm"
            disabled={busy || !driverId}
            onClick={() => void onAssign()}
          >
            {t('admin.dispatch.send')}
          </button>
        </div>
      ) : null}

      {label === 'aceito' && reservation.status === 'confirmado' ? (
        <button
          type="button"
          className="admin-res-actions__confirm"
          disabled={busy}
          onClick={() => void onComplete()}
        >
          {t('admin.dispatch.complete')}
        </button>
      ) : null}
    </div>
  )
}
