import { useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  RouteNavPicker,
  ViewRouteButton,
} from '../../components/admin/RouteNavPicker'
import { driverRespondAssignment } from '../../services/coreV2'
import {
  IconRouteMark,
  statusBadgeClass,
  useDriverApp,
} from './driverShared'

type Mode = 'ofertas' | 'aceitas'

export function DriverJobsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const mode: Mode = pathname.includes('/aceitas') ? 'aceitas' : 'ofertas'
  const {
    driver,
    assignments,
    details,
    loading,
    refreshing,
    error,
    setError,
    refresh,
    locale,
  } = useDriverApp()

  const [busyId, setBusyId] = useState<string | null>(null)
  const [refuseId, setRefuseId] = useState<string | null>(null)
  const [refuseReason, setRefuseReason] = useState('')
  const [routePlaces, setRoutePlaces] = useState<{
    origin: string
    destination: string
    stops: string[]
  } | null>(null)

  const visible = useMemo(() => {
    if (mode === 'ofertas') {
      return assignments.filter((a) => a.status === 'oferecido')
    }
    return assignments.filter(
      (a) => a.status === 'aceito' || a.status === 'concluido',
    )
  }, [assignments, mode])

  const displayName = driver?.full_name ?? '—'

  async function onRespond(assignmentId: string, accept: boolean) {
    setBusyId(assignmentId)
    setError(null)
    try {
      await driverRespondAssignment(
        assignmentId,
        accept,
        accept ? undefined : refuseReason,
      )
      setRefuseId(null)
      setRefuseReason('')
      await refresh()
      if (accept) navigate('/motorista/aceitas')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('driver.respondError'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <Outlet />
      <div className="driver-app__greeting" data-mode={mode}>
        <h1>
          {mode === 'ofertas'
            ? t('driver.tabOffersTitle')
            : t('driver.tabAcceptedTitle')}
        </h1>
        <p>
          {t('driver.hello', {
            name: displayName.split(/\s+/)[0] ?? displayName,
          })}
        </p>
        {driver ? (
          <span
            className={`driver-app__chip${driver.active ? '' : ' is-off'}`}
          >
            <span className="driver-app__chip-dot" aria-hidden="true" />
            {driver.active
              ? t('driver.statusActive')
              : t('driver.statusInactive')}
          </span>
        ) : null}
      </div>

      {error ? <p className="driver-app__alert">{error}</p> : null}
      {loading ? <p className="driver-app__loading">…</p> : null}
      {!loading && refreshing ? (
        <p className="driver-app__refreshing" aria-live="polite">
          {t('driver.refreshing')}
        </p>
      ) : null}

      {!loading && !driver ? (
        <div className="driver-app__empty">
          <div className="driver-app__empty-mark">
            <IconRouteMark />
          </div>
          <h2>{t('driver.notLinkedTitle')}</h2>
          <p>{t('driver.notLinkedLead')}</p>
        </div>
      ) : null}

      {!loading && driver ? (
        visible.length === 0 ? (
          <div className="driver-app__empty">
            <div className="driver-app__empty-mark">
              <IconRouteMark />
            </div>
            <h2>
              {mode === 'ofertas'
                ? t('driver.emptyOffersTitle')
                : t('driver.emptyAcceptedTitle')}
            </h2>
            <p>
              {mode === 'ofertas'
                ? t('driver.emptyOffersLead')
                : t('driver.emptyAcceptedLead')}
            </p>
            <div className="driver-app__empty-actions">
              <button
                type="button"
                className="driver-app__btn is-primary"
                onClick={() => void refresh()}
              >
                {t('driver.refresh')}
              </button>
            </div>
          </div>
        ) : (
          <ul className="driver-app__list">
            {visible.map((a) => {
              const detail = details[a.id]
              const svc = detail?.service
              const when = svc
                ? new Date(svc.slot_start)
                : new Date(a.offered_at)
              return (
                <li key={a.id} className="driver-job">
                  <div className="driver-job__head">
                    <div>
                      {svc?.service_code ? (
                        <p className="driver-job__code">
                          <span className="service-code">{svc.service_code}</span>
                        </p>
                      ) : null}
                      <p className="driver-job__when">
                        {when.toLocaleString(locale, {
                          weekday: 'short',
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="driver-job__meta">
                        {svc
                          ? t(`reserve.services.${svc.service_type}`)
                          : t('driver.loadingJob')}
                        {svc?.estimated_km != null
                          ? ` · ${svc.estimated_km} km`
                          : ''}
                      </p>
                    </div>
                    <span
                      className={`driver-job__badge ${statusBadgeClass(a.status)}`}
                    >
                      {t(`admin.dispatch.status.${a.status}`, {
                        defaultValue: a.status,
                      })}
                    </span>
                  </div>

                  {svc ? (
                    <>
                      <div className="driver-job__route">
                        <div className="driver-job__leg">
                          <span
                            className="driver-job__pin"
                            aria-hidden="true"
                          />
                          <div>
                            <span className="driver-job__leg-label">
                              {t('admin.routeLegOrigin')}
                            </span>
                            <span className="driver-job__leg-value">
                              {svc.origin_address}
                            </span>
                          </div>
                        </div>
                        {(svc.stops ?? []).filter(Boolean).map((stop, i) => (
                          <div
                            className="driver-job__leg"
                            key={`${a.id}-stop-${i}`}
                          >
                            <span
                              className="driver-job__pin is-stop"
                              aria-hidden="true"
                            />
                            <div>
                              <span className="driver-job__leg-label">
                                {t('admin.routeLegStop', { n: i + 1 })}
                              </span>
                              <span className="driver-job__leg-value">
                                {stop}
                              </span>
                            </div>
                          </div>
                        ))}
                        {svc.destination_address ? (
                          <div className="driver-job__leg">
                            <span
                              className="driver-job__pin is-end"
                              aria-hidden="true"
                            />
                            <div>
                              <span className="driver-job__leg-label">
                                {t('admin.routeLegDestination')}
                              </span>
                              <span className="driver-job__leg-value">
                                {svc.destination_address}
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="driver-job__facts">
                        <span className="driver-job__fact">
                          {t('driver.customer')}: {svc.customer_first_name}
                        </span>
                        {svc.airport ? (
                          <span className="driver-job__fact">
                            {svc.airport}
                          </span>
                        ) : null}
                        {svc.hours_requested != null ? (
                          <span className="driver-job__fact">
                            {svc.hours_requested}h
                          </span>
                        ) : null}
                        {svc.notes ? (
                          <span className="driver-job__fact">{svc.notes}</span>
                        ) : null}
                      </div>

                      <div className="driver-job__actions">
                        <ViewRouteButton
                          className="driver-app__btn is-ghost"
                          places={{
                            origin: svc.origin_address,
                            destination: svc.destination_address,
                            stops: svc.stops,
                          }}
                          onOpen={() =>
                            setRoutePlaces({
                              origin: svc.origin_address,
                              destination: svc.destination_address,
                              stops: svc.stops ?? [],
                            })
                          }
                        />

                        {a.status === 'oferecido' ? (
                          <>
                            <button
                              type="button"
                              className="driver-app__btn is-primary"
                              disabled={busyId === a.id}
                              onClick={() => void onRespond(a.id, true)}
                            >
                              {t('driver.accept')}
                            </button>
                            {refuseId === a.id ? (
                              <div className="driver-job__refuse">
                                <input
                                  value={refuseReason}
                                  onChange={(e) =>
                                    setRefuseReason(e.target.value)
                                  }
                                  placeholder={t('driver.refuseReason')}
                                />
                                <button
                                  type="button"
                                  className="driver-app__btn is-danger"
                                  disabled={busyId === a.id}
                                  onClick={() => void onRespond(a.id, false)}
                                >
                                  {t('driver.confirmRefuse')}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="driver-app__btn is-danger"
                                disabled={busyId === a.id}
                                onClick={() => setRefuseId(a.id)}
                              >
                                {t('driver.refuse')}
                              </button>
                            )}
                          </>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="driver-job__meta">
                      {t('driver.loadingJob')}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )
      ) : null}

      {routePlaces ? (
        <RouteNavPicker
          places={routePlaces}
          onClose={() => setRoutePlaces(null)}
        />
      ) : null}
    </>
  )
}
