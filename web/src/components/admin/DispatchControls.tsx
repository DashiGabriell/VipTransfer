import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildDriverDemandWhatsAppUrl } from '../../domain/whatsapp'
import {
  assignReservationToDriver,
  completeReservationJob,
  dispatchLabel,
} from '../../services/coreV2'
import type {
  Driver,
  JobAssignment,
  Reservation,
  VehicleCategory,
} from '../../types/database'

type Props = {
  reservation: Reservation
  drivers: Driver[]
  assignments: JobAssignment[]
  categories?: VehicleCategory[]
  onChanged: () => void
  onError: (msg: string) => void
}

export function DispatchControls({
  reservation,
  drivers,
  assignments,
  categories = [],
  onChanged,
  onError,
}: Props) {
  const { t, i18n } = useTranslation()
  const [driverId, setDriverId] = useState('')
  const [busy, setBusy] = useState(false)
  const locale = i18n.language.startsWith('en') ? 'en' : 'pt'
  const waLocale = locale === 'en' ? 'en' : 'pt-BR'

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

  function vehicleLabel(): string | null {
    if (!reservation.vehicle_category_id) return null
    const cat = categories.find((c) => c.id === reservation.vehicle_category_id)
    if (!cat) return null
    return (
      (cat.name_i18n as { pt?: string; en?: string })[locale] ||
      cat.name_i18n.pt ||
      cat.code
    )
  }

  function openDriverWhatsApp(driver: Driver) {
    const slotLabel = new Date(reservation.slot_start).toLocaleString(
      waLocale === 'en' ? 'en-US' : 'pt-BR',
      {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    )
    const url = buildDriverDemandWhatsAppUrl(driver.phone, {
      driverFirstName: driver.full_name.split(/\s+/)[0] ?? driver.full_name,
      origin: reservation.origin_address,
      destination: reservation.destination_address,
      stops: reservation.stops,
      serviceLabel: t(`reserve.services.${reservation.service_type}`),
      vehicleLabel: vehicleLabel(),
      slotLabel,
      distanceKm: reservation.estimated_km,
      hoursRequested: reservation.hours_requested,
      airport: reservation.airport,
      serviceNotes: reservation.service_notes,
      offersUrl: `${window.location.origin}/motorista/ofertas`,
      locale: waLocale,
    })
    if (!url) {
      onError(t('admin.dispatch.whatsappPhoneInvalid'))
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function onAssign() {
    if (!driverId) {
      onError(t('admin.dispatch.pickDriver'))
      return
    }
    const driver = drivers.find((d) => d.id === driverId)
    if (!driver) {
      onError(t('admin.dispatch.pickDriver'))
      return
    }
    setBusy(true)
    onError('')
    try {
      await assignReservationToDriver(reservation.id, driverId)
      setDriverId('')
      onChanged()
      openDriverWhatsApp(driver)
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
