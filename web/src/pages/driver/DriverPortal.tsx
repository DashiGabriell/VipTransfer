import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageToggle } from '../../components/LanguageToggle'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import {
  driverRespondAssignment,
  getDriverJobDetail,
  getMyDriverProfile,
  listMyDriverAssignments,
} from '../../services/coreV2'
import type { Driver, DriverJobDetail, JobAssignment } from '../../types/database'

export function DriverPortal() {
  const { t, i18n } = useTranslation()
  const { user, loading: authLoading, signOut } = useAuth()
  const tenant = useTenant()
  const locale = i18n.language.startsWith('en') ? 'en-US' : 'pt-BR'

  const [driver, setDriver] = useState<Driver | null>(null)
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [details, setDetails] = useState<Record<string, DriverJobDetail>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [refuseId, setRefuseId] = useState<string | null>(null)
  const [refuseReason, setRefuseReason] = useState('')

  const orgId = tenant.organizationId

  const refresh = useCallback(async () => {
    if (!orgId || !user) return
    setLoading(true)
    setError(null)
    try {
      const me = await getMyDriverProfile(orgId)
      setDriver(me)
      if (!me) {
        setAssignments([])
        setDetails({})
        return
      }
      const rows = await listMyDriverAssignments(orgId)
      setAssignments(rows)
      const map: Record<string, DriverJobDetail> = {}
      await Promise.all(
        rows.map(async (row) => {
          try {
            map[row.id] = await getDriverJobDetail(row.id)
          } catch {
            /* skip detail errors per row */
          }
        }),
      )
      setDetails(map)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('driver.loadError'))
    } finally {
      setLoading(false)
    }
  }, [orgId, user, t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (authLoading) {
    return (
      <div className="driver-shell">
        <p>{t('auth.loading')}</p>
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent('/motorista')}`}
        replace
      />
    )
  }

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
    } catch (err) {
      setError(err instanceof Error ? err.message : t('driver.respondError'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="driver-shell">
      <header className="driver-top">
        <div>
          <p className="driver-top__brand">{tenant.name}</p>
          <h1>{t('driver.title')}</h1>
          <p>{driver?.full_name ?? user.email}</p>
        </div>
        <div className="driver-top__actions">
          <LanguageToggle variant="admin" />
          <Link to="/" className="admin-clients__btn is-ghost">
            {t('admin.site')}
          </Link>
          <button
            type="button"
            className="admin-clients__btn is-ghost"
            onClick={() => void signOut()}
          >
            {t('admin.signOut')}
          </button>
        </div>
      </header>

      <main className="driver-main">
        {error ? (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {loading ? <p>…</p> : null}

        {!loading && !driver ? (
          <div className="driver-card">
            <h2>{t('driver.notLinkedTitle')}</h2>
            <p>{t('driver.notLinkedLead')}</p>
          </div>
        ) : null}

        {!loading && driver && !assignments.length ? (
          <div className="driver-card">
            <p>{t('driver.empty')}</p>
          </div>
        ) : null}

        <ul className="driver-list">
          {assignments.map((a) => {
            const detail = details[a.id]
            const svc = detail?.service
            return (
              <li key={a.id} className="driver-card">
                <div className="driver-card__top">
                  <strong>{t(`admin.dispatch.status.${a.status === 'oferecido' ? 'oferecido' : a.status === 'aceito' ? 'aceito' : a.status === 'concluido' ? 'concluido' : 'sem_motorista'}`)}</strong>
                  <time dateTime={a.offered_at}>
                    {new Date(a.offered_at).toLocaleString(locale)}
                  </time>
                </div>

                {svc ? (
                  <div className="driver-card__body">
                    <p>
                      <span>{t('driver.customer')}</span>
                      <strong>{svc.customer_first_name}</strong>
                    </p>
                    <p>
                      <span>{t('admin.detailSlot')}</span>
                      <strong>
                        {new Date(svc.slot_start).toLocaleString(locale)}
                      </strong>
                    </p>
                    <p>
                      <span>{t('admin.routeLegOrigin')}</span>
                      <strong>{svc.origin_address}</strong>
                    </p>
                    {(svc.stops ?? []).filter(Boolean).map((stop, i) => (
                      <p key={`${a.id}-stop-${i}`}>
                        <span>{t('admin.routeLegStop', { n: i + 1 })}</span>
                        <strong>{stop}</strong>
                      </p>
                    ))}
                    <p>
                      <span>{t('admin.routeLegDestination')}</span>
                      <strong>{svc.destination_address}</strong>
                    </p>
                    <p>
                      <span>{t('reserve.serviceType')}</span>
                      <strong>{t(`reserve.services.${svc.service_type}`)}</strong>
                    </p>
                    {svc.estimated_km != null ? (
                      <p>
                        <span>{t('admin.detailKm')}</span>
                        <strong>{svc.estimated_km} km</strong>
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary-light">…</p>
                )}

                {a.status === 'oferecido' ? (
                  <div className="driver-card__actions">
                    <button
                      type="button"
                      className="admin-res-actions__confirm"
                      disabled={busyId === a.id}
                      onClick={() => void onRespond(a.id, true)}
                    >
                      {t('driver.accept')}
                    </button>
                    {refuseId === a.id ? (
                      <div className="driver-refuse">
                        <input
                          value={refuseReason}
                          onChange={(e) => setRefuseReason(e.target.value)}
                          placeholder={t('driver.refuseReason')}
                        />
                        <button
                          type="button"
                          className="admin-res-actions__cancel"
                          disabled={busyId === a.id}
                          onClick={() => void onRespond(a.id, false)}
                        >
                          {t('driver.confirmRefuse')}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="admin-res-actions__cancel"
                        disabled={busyId === a.id}
                        onClick={() => setRefuseId(a.id)}
                      >
                        {t('driver.refuse')}
                      </button>
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
