import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageToggle } from '../../components/LanguageToggle'
import {
  RouteNavPicker,
  ViewRouteButton,
} from '../../components/admin/RouteNavPicker'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import { WEEK_DAYS } from '../../domain/drivers'
import {
  driverRespondAssignment,
  getDriverJobDetail,
  getMyDriverProfile,
  listMyDriverAssignments,
} from '../../services/coreV2'
import type {
  Driver,
  DriverJobDetail,
  JobAssignment,
} from '../../types/database'

type TabId = 'ofertas' | 'aceitas' | 'perfil'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'M'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

function statusBadgeClass(status: string): string {
  if (status === 'aceito') return 'is-aceito'
  if (status === 'concluido') return 'is-concluido'
  return ''
}

function IconBriefcase() {
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

function IconCheck() {
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

function IconUser() {
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

function IconMore() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  )
}

function IconRouteMark() {
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

export function DriverPortal() {
  const { t, i18n } = useTranslation()
  const { user, loading: authLoading, signOut } = useAuth()
  const tenant = useTenant()
  const locale = i18n.language.startsWith('en') ? 'en-US' : 'pt-BR'

  const [tab, setTab] = useState<TabId>('ofertas')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const [driver, setDriver] = useState<Driver | null>(null)
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [details, setDetails] = useState<Record<string, DriverJobDetail>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [refuseId, setRefuseId] = useState<string | null>(null)
  const [refuseReason, setRefuseReason] = useState('')
  const [routePlaces, setRoutePlaces] = useState<{
    origin: string
    destination: string
    stops: string[]
  } | null>(null)

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

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const offered = useMemo(
    () => assignments.filter((a) => a.status === 'oferecido'),
    [assignments],
  )
  const accepted = useMemo(
    () =>
      assignments.filter(
        (a) => a.status === 'aceito' || a.status === 'concluido',
      ),
    [assignments],
  )

  const visible =
    tab === 'ofertas' ? offered : tab === 'aceitas' ? accepted : []

  if (authLoading) {
    return (
      <div className="driver-app">
        <div className="driver-app__loading">{t('auth.loading')}</div>
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
      if (accept) setTab('aceitas')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('driver.respondError'))
    } finally {
      setBusyId(null)
    }
  }

  const displayName = driver?.full_name ?? user.email ?? '—'

  return (
    <div className="driver-app">
      <header className="driver-app__top">
        <Link to="/motorista" className="driver-app__brand">
          <img src="/logo-1.png" alt="" width={32} height={32} />
          <div className="driver-app__brand-copy">
            <p className="driver-app__brand-name">JMD</p>
            <p className="driver-app__brand-sub">{t('driver.appBadge')}</p>
          </div>
        </Link>

        <div className="driver-app__top-actions" ref={menuRef}>
          <button
            type="button"
            className="driver-app__icon-btn"
            aria-expanded={menuOpen}
            aria-label={t('driver.menu')}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <IconMore />
          </button>
          {menuOpen ? (
            <div className="driver-app__menu" role="menu">
              <div className="driver-app__lang">
                <LanguageToggle variant="admin" />
              </div>
              <Link to="/" role="menuitem" onClick={() => setMenuOpen(false)}>
                {t('admin.site')}
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  void signOut()
                }}
              >
                {t('admin.signOut')}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="driver-app__main">
        {tab !== 'perfil' ? (
          <div className="driver-app__greeting">
            <h1>
              {tab === 'ofertas'
                ? t('driver.tabOffersTitle')
                : t('driver.tabAcceptedTitle')}
            </h1>
            <p>
              {t('driver.hello', { name: displayName.split(/\s+/)[0] ?? displayName })}
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
        ) : null}

        {error ? <p className="driver-app__alert">{error}</p> : null}

        {loading ? <p className="driver-app__loading">…</p> : null}

        {!loading && !driver ? (
          <div className="driver-app__empty">
            <div className="driver-app__empty-mark">
              <IconUser />
            </div>
            <h2>{t('driver.notLinkedTitle')}</h2>
            <p>{t('driver.notLinkedLead')}</p>
          </div>
        ) : null}

        {!loading && driver && tab !== 'perfil' ? (
          visible.length === 0 ? (
            <div className="driver-app__empty">
              <div className="driver-app__empty-mark">
                <IconRouteMark />
              </div>
              <h2>
                {tab === 'ofertas'
                  ? t('driver.emptyOffersTitle')
                  : t('driver.emptyAcceptedTitle')}
              </h2>
              <p>
                {tab === 'ofertas'
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
                            <span className="driver-job__pin" aria-hidden="true" />
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
                      <p className="driver-job__meta">{t('driver.loadingJob')}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )
        ) : null}

        {!loading && driver && tab === 'perfil' ? (
          <div className="driver-profile">
            <div className="driver-profile__hero">
              <div className="driver-profile__avatar" aria-hidden="true">
                {initials(driver.full_name)}
              </div>
              <h2>{driver.full_name}</h2>
              <p>
                {driver.phone}
                {driver.email ? ` · ${driver.email}` : ''}
              </p>
            </div>

            <section className="driver-profile__block">
              <h3>{t('driver.profileVehicle')}</h3>
              <div className="driver-profile__rows">
                <div className="driver-profile__row">
                  <span>{t('admin.drivers.brand')}</span>
                  <strong>
                    {driver.vehicle_brand} {driver.vehicle_model}
                    {driver.vehicle_year ? ` · ${driver.vehicle_year}` : ''}
                  </strong>
                </div>
                <div className="driver-profile__row">
                  <span>{t('admin.drivers.color')}</span>
                  <strong>{driver.vehicle_color || '—'}</strong>
                </div>
                <div className="driver-profile__row">
                  <span>{t('admin.drivers.plate')}</span>
                  <strong>{driver.vehicle_plate || '—'}</strong>
                </div>
              </div>
            </section>

            <section className="driver-profile__block">
              <h3>{t('admin.drivers.skills')}</h3>
              {driver.skills?.length ? (
                <div className="driver-profile__tags">
                  {driver.skills.map((skill) => (
                    <span key={skill} className="driver-profile__tag">
                      {t(`admin.drivers.skill.${skill}`, {
                        defaultValue: skill,
                      })}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="driver-job__meta">{t('driver.noSkills')}</p>
              )}
            </section>

            <section className="driver-profile__block">
              <h3>{t('admin.drivers.availability')}</h3>
              {driver.availability?.length ? (
                <ul className="driver-profile__avail">
                  {driver.availability.map((slot, i) => {
                    const day = WEEK_DAYS.find(
                      (d) => d.value === slot.day_of_week,
                    )
                    return (
                      <li key={`${slot.day_of_week}-${i}`}>
                        <span>
                          {day ? t(day.labelKey) : slot.day_of_week}
                        </span>
                        <strong>
                          {slot.start_time} – {slot.end_time}
                        </strong>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="driver-job__meta">{t('driver.noAvailability')}</p>
              )}
            </section>
          </div>
        ) : null}
      </main>

      <nav className="driver-app__nav" aria-label={t('driver.navLabel')}>
        <button
          type="button"
          className={`driver-app__nav-btn${tab === 'ofertas' ? ' is-active' : ''}`}
          onClick={() => setTab('ofertas')}
        >
          <span
            className={
              offered.length ? 'driver-app__nav-badge' : undefined
            }
            data-count={offered.length || undefined}
          >
            <IconBriefcase />
          </span>
          {t('driver.navOffers')}
        </button>
        <button
          type="button"
          className={`driver-app__nav-btn${tab === 'aceitas' ? ' is-active' : ''}`}
          onClick={() => setTab('aceitas')}
        >
          <IconCheck />
          {t('driver.navAccepted')}
        </button>
        <button
          type="button"
          className={`driver-app__nav-btn${tab === 'perfil' ? ' is-active' : ''}`}
          onClick={() => setTab('perfil')}
        >
          <IconUser />
          {t('driver.navProfile')}
        </button>
      </nav>

      {routePlaces ? (
        <RouteNavPicker
          places={routePlaces}
          onClose={() => setRoutePlaces(null)}
        />
      ) : null}
    </div>
  )
}
