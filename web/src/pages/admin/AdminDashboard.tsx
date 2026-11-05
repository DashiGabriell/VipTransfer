import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import { AdminMobileNav } from '../../components/admin/AdminMobileNav'
import {
  AdminSidebar,
  isAdminNavId,
  type AdminNavId,
} from '../../components/admin/AdminSidebar'
import { AgendaSlotModal } from '../../components/admin/AgendaSlotModal'
import { AvailabilityPanel } from '../../components/admin/AvailabilityPanel'
import { ClientDetailPanel } from '../../components/admin/ClientDetailPanel'
import { ClientsPanel } from '../../components/admin/ClientsPanel'
import { DispatchControls } from '../../components/admin/DispatchControls'
import { DriverDetailPanel } from '../../components/admin/DriverDetailPanel'
import { DriversPanel } from '../../components/admin/DriversPanel'
import { FinancePanel } from '../../components/admin/FinancePanel'
import { FleetPanel } from '../../components/admin/FleetPanel'
import { ProfilePanel } from '../../components/admin/ProfilePanel'
import {
  RouteNavPicker,
  ViewRouteButton,
} from '../../components/admin/RouteNavPicker'
import { LanguageToggle } from '../../components/LanguageToggle'
import {
  cancelReservation,
  canAdmin,
  canOperate,
  claimOrgOwner,
  confirmReservation,
  listFleetVehiclesAdmin,
  listFreightRulesAdmin,
  listMyMemberships,
  listReservations,
  listVehicleCategoriesAdmin,
  updateAirportFee,
  upsertFreightRule,
  type Membership,
} from '../../services/admin'
import {
  listAssignmentsForReservations,
  listDrivers,
} from '../../services/coreV2'
import type {
  AirportCode,
  Driver,
  FleetVehicle,
  FreightRule,
  JobAssignment,
  OrgRole,
  Reservation,
  ReservationStatus,
  VehicleCategory,
} from '../../types/database'
import { SlotAgenda } from '../../components/SlotAgenda'
import type { DaySlot } from '../../domain/agenda'

type Tab = AdminNavId

const SIDEBAR_KEY = 'jmd.admin.sidebarCollapsed'

const STATUS_FILTERS: Array<ReservationStatus | 'all'> = [
  'all',
  'hold',
  'hold_expirado',
  'confirmado',
  'cancelado',
  'concluido',
]

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

function localeFromLang(lang: string): string {
  return lang.startsWith('en') ? 'en-US' : 'pt-BR'
}

export function AdminDashboard() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { section, customerId, driverId } = useParams<{
    section?: string
    customerId?: string
    driverId?: string
  }>()
  const { user, signOut } = useAuth()
  const tenant = useTenant()
  const tab: Tab = customerId
    ? 'clientes'
    : driverId
      ? 'motoristas'
      : isAdminNavId(section)
        ? section
        : 'reservas'
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [moreOpen, setMoreOpen] = useState(false)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>(
    'hold',
  )
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [categories, setCategories] = useState<VehicleCategory[]>([])
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([])
  const [freightRules, setFreightRules] = useState<FreightRule[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [agendaFocus, setAgendaFocus] = useState<DaySlot | null>(null)
  const [agendaKey, setAgendaKey] = useState(0)
  const [agendaDetailId, setAgendaDetailId] = useState<string | null>(null)
  const [routeNavReservation, setRouteNavReservation] =
    useState<Reservation | null>(null)

  const orgId = tenant.organizationId
  const role: OrgRole | null = membership?.role ?? null

  const agendaDayReservations = useMemo(() => {
    if (!agendaFocus) return []
    const start = new Date(agendaFocus.slot_start).getTime()
    const end = new Date(agendaFocus.slot_end).getTime()
    return reservations.filter((r) => {
      const rs = new Date(r.slot_start).getTime()
      const re = new Date(r.slot_end).getTime()
      return rs < end && re > start
    })
  }, [agendaFocus, reservations])

  const agendaDetailReservations = useMemo(() => {
    if (!agendaDetailId) return []
    return agendaDayReservations.filter((r) => r.id === agendaDetailId)
  }, [agendaDayReservations, agendaDetailId])

  const refreshMembership = useCallback(async () => {
    if (!orgId) return
    const rows = await listMyMemberships()
    setMembership(rows.find((m) => m.organization_id === orgId) ?? null)
  }, [orgId])

  const refreshReservations = useCallback(async () => {
    if (!orgId || !canOperate(role)) return
    const filter = tab === 'agenda' ? 'all' : statusFilter
    const rows = await listReservations(orgId, filter)
    setReservations(rows)
    const asg = await listAssignmentsForReservations(
      orgId,
      rows.map((r) => r.id),
    )
    setAssignments(asg)
  }, [orgId, role, statusFilter, tab])

  const refreshDrivers = useCallback(async () => {
    if (!orgId || !canOperate(role)) return
    const rows = await listDrivers(orgId, { includeInactive: true })
    setDrivers(rows)
  }, [orgId, role])

  const refreshCatalogAdmin = useCallback(async () => {
    if (!orgId || !canAdmin(role)) return
    const [cats, fleet, f] = await Promise.all([
      listVehicleCategoriesAdmin(orgId),
      listFleetVehiclesAdmin(orgId),
      listFreightRulesAdmin(orgId),
    ])
    setCategories(cats)
    setFleetVehicles(fleet)
    setFreightRules(f)
  }, [orgId, role])

  useEffect(() => {
    void (async () => {
      try {
        setError(null)
        await refreshMembership()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar membership')
      }
    })()
  }, [refreshMembership])

  useEffect(() => {
    if (!moreOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  useEffect(() => {
    void (async () => {
      try {
        setError(null)
        await refreshReservations()
        await refreshDrivers()
        await refreshCatalogAdmin()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar painel')
      }
    })()
  }, [refreshReservations, refreshDrivers, refreshCatalogAdmin])

  const title = useMemo(() => {
    if (customerId) return t('admin.clients.detailTitle')
    if (driverId) return t('admin.drivers.detailTitle')
    const labels: Record<Tab, string> = {
      reservas: t('admin.navReservas'),
      agenda: t('admin.navAgenda'),
      frota: t('admin.navFrota'),
      frete: t('admin.navFrete'),
      clientes: t('admin.navClientes'),
      motoristas: t('admin.navMotoristas'),
      financeiro: t('admin.navFinanceiro'),
      perfil: t('admin.navPerfil'),
    }
    return labels[tab]
  }, [t, tab, i18n.language, customerId, driverId])

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  async function onClaimOwner() {
    setBootstrapping(true)
    setError(null)
    try {
      await claimOrgOwner(tenant.slug)
      await refreshMembership()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no bootstrap')
    } finally {
      setBootstrapping(false)
    }
  }

  async function onConfirm(id: string) {
    setBusyId(id)
    try {
      await confirmReservation(id)
      await refreshReservations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao confirmar')
    } finally {
      setBusyId(null)
    }
  }

  async function onCancel(id: string) {
    setBusyId(id)
    try {
      await cancelReservation(id)
      await refreshReservations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao cancelar')
    } finally {
      setBusyId(null)
    }
  }

  const layoutClass = [
    'admin-layout',
    collapsed ? 'is-collapsed' : '',
    moreOpen ? 'is-more-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  function handleSignOut() {
    setMoreOpen(false)
    void signOut().then(() => navigate('/login', { replace: true }))
  }

  if (!customerId && !driverId && !isAdminNavId(section)) {
    return <Navigate to="/admin/reservas" replace />
  }

  return (
    <div className={layoutClass}>
      <AdminSidebar
        collapsed={collapsed}
        brand={tenant.name}
        email={user?.email}
        role={role}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        onSignOut={handleSignOut}
      />

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar__brand" aria-hidden="true">
            <span className="admin-topbar__mark">JMD</span>
          </div>
          <div className="admin-topbar__left">
            <div>
              <h1>{title}</h1>
              <p>
                {tenant.name}
                {role ? ` · ${role}` : ` · ${t('admin.noAccess')}`}
              </p>
            </div>
          </div>
          <div className="admin-topbar__actions">
            <LanguageToggle variant="admin" />
            <button
              type="button"
              className="admin-topbar__desktop-menu"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={
                collapsed ? t('admin.expand') : t('admin.collapse')
              }
            >
              {t('admin.menu')}
            </button>
            <button
              type="button"
              className="admin-topbar__more"
              aria-expanded={moreOpen}
              aria-controls="adminMoreSheet"
              aria-label={t('admin.more')}
              onClick={() => setMoreOpen((v) => !v)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
          </div>
        </header>

        {moreOpen && (
          <>
            <button
              type="button"
              className="admin-more-backdrop"
              aria-label={t('admin.closeMenu')}
              onClick={() => setMoreOpen(false)}
            />
            <div
              className="admin-more-sheet"
              id="adminMoreSheet"
              role="dialog"
              aria-label={t('admin.more')}
            >
              <div className="admin-more-sheet__handle" aria-hidden="true" />
              <p className="admin-more-sheet__meta">
                {user?.email ?? '—'}
                {role ? ` · ${role}` : ''}
              </p>
              <Link
                className="admin-more-sheet__action"
                to="/admin/frete"
                onClick={() => setMoreOpen(false)}
              >
                {t('admin.navFrete')}
              </Link>
              <Link
                className="admin-more-sheet__action"
                to="/admin/motoristas"
                onClick={() => setMoreOpen(false)}
              >
                {t('admin.navMotoristas')}
              </Link>
              <Link
                className="admin-more-sheet__action"
                to="/admin/financeiro"
                onClick={() => setMoreOpen(false)}
              >
                {t('admin.navFinanceiro')}
              </Link>
              <Link
                className="admin-more-sheet__action"
                to="/"
                onClick={() => setMoreOpen(false)}
              >
                {t('admin.site')}
              </Link>
              <button
                type="button"
                className="admin-more-sheet__action is-danger"
                onClick={handleSignOut}
              >
                {t('admin.signOut')}
              </button>
            </div>
          </>
        )}

        <main className="admin-content">
          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {!membership && (
            <div className="admin-panel-enter mb-8 rounded-2xl border border-border-light bg-surface-light p-6">
              <h2 className="text-lg font-semibold text-primary">
                {t('admin.bootstrapTitle')}
              </h2>
              <p className="mt-2 text-sm text-text-secondary-light">
                {t('admin.bootstrapLead', { slug: tenant.slug })}
              </p>
              <button
                type="button"
                disabled={bootstrapping || !orgId}
                onClick={() => void onClaimOwner()}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-text-primary-dark hover:bg-primary-dark disabled:opacity-60"
              >
                {bootstrapping
                  ? '…'
                  : t('admin.bootstrapCta', { slug: tenant.slug })}
              </button>
            </div>
          )}

          {membership && (
            <div key={tab} className="admin-panel-enter">
              {tab === 'reservas' && canOperate(role) && (
                <ReservationsPanel
                  reservations={reservations}
                  statusFilter={statusFilter}
                  onFilter={setStatusFilter}
                  busyId={busyId}
                  onConfirm={onConfirm}
                  onCancel={onCancel}
                  onRefresh={() => void refreshReservations()}
                  drivers={drivers}
                  assignments={assignments}
                  onDispatchChanged={() => {
                    void refreshReservations()
                    void refreshDrivers()
                  }}
                  onError={setError}
                />
              )}

              {tab === 'agenda' && canOperate(role) && (
                <section className="grid min-w-0 max-w-full gap-6 lg:grid-cols-2">
                  <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5">
                    <h2 className="mb-3 font-semibold text-primary">
                      {t('admin.agendaVisual')}
                    </h2>
                    <SlotAgenda
                      key={agendaKey}
                      organizationId={orgId}
                      selectedStart={agendaFocus?.slot_start ?? null}
                      onSelect={(slot) => {
                        setAgendaFocus(slot)
                        setAgendaDetailId(null)
                      }}
                      mode="admin"
                    />
                  </div>
                  <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5">
                    <h2 className="mb-3 font-semibold text-primary">
                      {t('admin.slotReservations')}
                    </h2>
                    {!agendaFocus && (
                      <p className="text-sm text-text-secondary-light">
                        {t('admin.slotHint')}
                      </p>
                    )}
                    {agendaFocus && (
                      <>
                        <p className="mb-3 text-sm">
                          {new Date(agendaFocus.slot_start).toLocaleString(
                            localeFromLang(i18n.language),
                          )}{' '}
                          ·{' '}
                          {t('admin.slotMeta', {
                            occupied: agendaFocus.occupied,
                            capacity: agendaFocus.capacity,
                            available: agendaFocus.available,
                          })}
                        </p>
                        <ul className="space-y-2 text-sm">
                          {agendaDayReservations.map((r) => (
                            <li
                              key={r.id}
                              className="admin-agenda-booking rounded-lg border border-border-light px-3 py-2"
                            >
                              <button
                                type="button"
                                className="w-full text-left transition hover:opacity-90"
                                onClick={() => setAgendaDetailId(r.id)}
                              >
                                <div className="font-medium">
                                  {r.customer_name} ·{' '}
                                  {t(`admin.status.${r.status}`)}
                                </div>
                                <div className="text-xs text-text-secondary-light">
                                  {r.customer_phone} · {r.service_type}
                                </div>
                              </button>
                              <div className="mt-2">
                                <ViewRouteButton
                                  places={{
                                    origin: r.origin_address,
                                    destination: r.destination_address,
                                    stops: r.stops,
                                  }}
                                  onOpen={() => setRouteNavReservation(r)}
                                />
                              </div>
                            </li>
                          ))}
                          {!agendaDayReservations.length && (
                            <li className="text-text-secondary-light">
                              {t('admin.slotEmpty')}
                            </li>
                          )}
                        </ul>
                      </>
                    )}
                  </div>
                  {canAdmin(role) && orgId && (
                    <div className="lg:col-span-2">
                      <AvailabilityPanel
                        organizationId={orgId}
                        onError={setError}
                        onChanged={() => {
                          setAgendaKey((k) => k + 1)
                          setAgendaFocus(null)
                          setAgendaDetailId(null)
                        }}
                      />
                    </div>
                  )}
                  {agendaFocus && agendaDetailId && agendaDetailReservations.length > 0 && (
                    <AgendaSlotModal
                      slot={agendaFocus}
                      reservations={agendaDetailReservations}
                      busyId={busyId}
                      onClose={() => setAgendaDetailId(null)}
                      onConfirm={onConfirm}
                      onCancel={onCancel}
                    />
                  )}
                  {routeNavReservation && (
                    <RouteNavPicker
                      places={{
                        origin: routeNavReservation.origin_address,
                        destination: routeNavReservation.destination_address,
                        stops: routeNavReservation.stops,
                      }}
                      onClose={() => setRouteNavReservation(null)}
                    />
                  )}
                </section>
              )}

              {tab === 'frota' && canAdmin(role) && (
                <FleetPanel
                  organizationId={orgId!}
                  categories={categories}
                  fleetVehicles={fleetVehicles}
                  onChanged={() => void refreshCatalogAdmin()}
                  onError={setError}
                />
              )}

              {tab === 'frete' && canAdmin(role) && (
                <FreightPanel
                  organizationId={orgId!}
                  rules={freightRules}
                  airportFees={tenant.catalog?.airportFees ?? []}
                  onChanged={() => void refreshCatalogAdmin()}
                  onError={setError}
                />
              )}

              {tab === 'clientes' && canOperate(role) && orgId && (
                customerId ? (
                  <ClientDetailPanel
                    organizationId={orgId}
                    customerId={customerId}
                    onError={setError}
                  />
                ) : (
                  <ClientsPanel organizationId={orgId} onError={setError} />
                )
              )}

              {tab === 'motoristas' && canAdmin(role) && orgId && (
                driverId ? (
                  <DriverDetailPanel
                    organizationId={orgId}
                    driverId={driverId}
                    categories={categories}
                    onError={setError}
                  />
                ) : (
                  <DriversPanel
                    organizationId={orgId}
                    categories={categories}
                    onError={setError}
                  />
                )
              )}

              {tab === 'financeiro' && canAdmin(role) && orgId && (
                <FinancePanel
                  organizationId={orgId}
                  orgSettings={tenant.catalog?.organization.settings}
                  onError={setError}
                  onSettingsChanged={() => undefined}
                />
              )}

              {tab === 'perfil' && (
                <ProfilePanel onError={setError} />
              )}

              {(tab === 'frota' || tab === 'frete' || tab === 'motoristas' || tab === 'financeiro') &&
                !canAdmin(role) && (
                <p className="text-sm text-text-secondary-light">
                  {t('admin.roleDenied', { role })}
                </p>
              )}

              {tab === 'clientes' && !canOperate(role) && (
                <p className="text-sm text-text-secondary-light">
                  {t('admin.clients.roleDenied', { role })}
                </p>
              )}
            </div>
          )}
        </main>
      </div>

      <AdminMobileNav />
    </div>
  )
}

function reservationEstimate(price: number | null | undefined) {
  // Cliente não vê preço; no admin, null = combinado no WhatsApp
  if (price == null) return 'WhatsApp'
  return `R$ ${Number(price).toFixed(2)}`
}

function ReservationActions(props: {
  reservation: Reservation
  busyId: string | null
  onConfirm: (id: string) => void
  onCancel: (id: string) => void
  onViewRoute: (reservation: Reservation) => void
  drivers: Driver[]
  assignments: JobAssignment[]
  onDispatchChanged: () => void
  onError: (msg: string) => void
}) {
  const { t } = useTranslation()
  const r = props.reservation
  const busy = props.busyId === r.id

  return (
    <div className="admin-res-actions">
      <ViewRouteButton
        places={{
          origin: r.origin_address,
          destination: r.destination_address,
          stops: r.stops,
        }}
        onOpen={() => props.onViewRoute(r)}
      />
      {(r.status === 'hold' || r.status === 'hold_expirado') && (
        <button
          type="button"
          disabled={busy}
          onClick={() => props.onConfirm(r.id)}
          className="admin-res-actions__confirm"
        >
          {t('admin.confirm')}
        </button>
      )}
      {r.status !== 'cancelado' && r.status !== 'concluido' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => props.onCancel(r.id)}
          className="admin-res-actions__cancel"
        >
          {t('admin.cancel')}
        </button>
      )}
      <DispatchControls
        reservation={r}
        drivers={props.drivers}
        assignments={props.assignments}
        onChanged={props.onDispatchChanged}
        onError={props.onError}
      />
    </div>
  )
}

function ReservationsPanel(props: {
  reservations: Reservation[]
  statusFilter: ReservationStatus | 'all'
  onFilter: (s: ReservationStatus | 'all') => void
  busyId: string | null
  onConfirm: (id: string) => void
  onCancel: (id: string) => void
  onRefresh: () => void
  drivers: Driver[]
  assignments: JobAssignment[]
  onDispatchChanged: () => void
  onError: (msg: string) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = localeFromLang(i18n.language)
  const emptyLabel = t('admin.reservationsEmpty')
  const [routeReservation, setRouteReservation] = useState<Reservation | null>(
    null,
  )

  return (
    <section className="admin-res space-y-4">
      <div className="admin-res-filters flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => props.onFilter(status)}
            className={`rounded-full px-3 py-1 text-xs ${
              props.statusFilter === status
                ? 'bg-primary text-text-primary-dark'
                : 'bg-surface-light text-text-secondary-light'
            }`}
          >
            {t(`admin.status.${status}`)}
          </button>
        ))}
        <button
          type="button"
          onClick={props.onRefresh}
          className="ml-auto text-xs text-primary hover:underline"
        >
          {t('admin.refresh')}
        </button>
      </div>

      {/* Mobile cards; desktop table only (visibility in admin-layout.css) */}
      <ul className="admin-res-cards">
        {props.reservations.map((r, index) => (
          <li
            key={r.id}
            className="admin-res-card admin-row-enter"
            style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
          >
            <div className="admin-res-card__top">
              <time dateTime={r.slot_start} className="admin-res-card__slot">
                {new Date(r.slot_start).toLocaleString(locale, {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
              <span className="admin-res-card__status">
                {t(`admin.status.${r.status}`)}
              </span>
            </div>

            {r.hold_expires_at && r.status === 'hold' && (
              <p className="admin-res-card__hold">
                {t('admin.holdExpires', {
                  time: new Date(r.hold_expires_at).toLocaleTimeString(locale),
                })}
              </p>
            )}

            <div className="admin-res-card__customer">
              <strong>{r.customer_name}</strong>
              <span>{r.customer_phone}</span>
            </div>

            <div className="admin-res-card__route">
              <p>{r.origin_address}</p>
              {(r.stops ?? []).filter(Boolean).map((stop, i) => (
                <p key={`${r.id}-m-stop-${i}`}>→ {stop}</p>
              ))}
              <p>→ {r.destination_address}</p>
            </div>

            <div className="admin-res-card__meta">
              <span>{reservationEstimate(r.estimated_price)}</span>
            </div>

            <ReservationActions
              reservation={r}
              busyId={props.busyId}
              onConfirm={props.onConfirm}
              onCancel={props.onCancel}
              onViewRoute={setRouteReservation}
              drivers={props.drivers}
              assignments={props.assignments}
              onDispatchChanged={props.onDispatchChanged}
              onError={props.onError}
            />
          </li>
        ))}
        {!props.reservations.length && (
          <li className="admin-res-card admin-res-card--empty">{emptyLabel}</li>
        )}
      </ul>

      <div className="admin-res-table-wrap">
        <table className="admin-res-table min-w-full text-left text-sm">
          <thead>
            <tr>
              <th>Slot</th>
              <th>
                {i18n.language.startsWith('en') ? 'Customer' : 'Cliente'}
              </th>
              <th>{i18n.language.startsWith('en') ? 'Route' : 'Trecho'}</th>
              <th>Status</th>
              <th>Est.</th>
              <th>{i18n.language.startsWith('en') ? 'Actions' : 'Ações'}</th>
            </tr>
          </thead>
          <tbody>
            {props.reservations.map((r, index) => (
              <tr
                key={r.id}
                className="admin-row-enter"
                style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
              >
                <td className="whitespace-nowrap">
                  {new Date(r.slot_start).toLocaleString(locale)}
                  {r.hold_expires_at && r.status === 'hold' && (
                    <div className="text-[11px] text-amber-700">
                      {t('admin.holdExpires', {
                        time: new Date(r.hold_expires_at).toLocaleTimeString(
                          locale,
                        ),
                      })}
                    </div>
                  )}
                </td>
                <td>
                  <div className="font-medium">{r.customer_name}</div>
                  <div className="text-xs text-text-secondary-light">
                    {r.customer_phone}
                  </div>
                </td>
                <td>
                  <div className="admin-res-table__route">{r.origin_address}</div>
                  {(r.stops ?? []).filter(Boolean).map((stop, i) => (
                    <div
                      key={`${r.id}-t-stop-${i}`}
                      className="admin-res-table__route is-dest"
                    >
                      → {stop}
                    </div>
                  ))}
                  <div className="admin-res-table__route is-dest">
                    → {r.destination_address}
                  </div>
                </td>
                <td>{t(`admin.status.${r.status}`)}</td>
                <td className="whitespace-nowrap">
                  {reservationEstimate(r.estimated_price)}
                </td>
                <td>
                  <ReservationActions
                    reservation={r}
                    busyId={props.busyId}
                    onConfirm={props.onConfirm}
                    onCancel={props.onCancel}
                    onViewRoute={setRouteReservation}
                    drivers={props.drivers}
                    assignments={props.assignments}
                    onDispatchChanged={props.onDispatchChanged}
                    onError={props.onError}
                  />
                </td>
              </tr>
            ))}
            {!props.reservations.length && (
              <tr>
                <td colSpan={6} className="admin-res-table__empty">
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {routeReservation && (
        <RouteNavPicker
          places={{
            origin: routeReservation.origin_address,
            destination: routeReservation.destination_address,
            stops: routeReservation.stops,
          }}
          onClose={() => setRouteReservation(null)}
        />
      )}
    </section>
  )
}

function FreightPanel(props: {
  organizationId: string
  rules: FreightRule[]
  airportFees: Array<{ airport: AirportCode; flat_fee: number }>
  onChanged: () => void
  onError: (msg: string) => void
}) {
  const { t } = useTranslation()
  const base = props.rules.find(
    (r) => r.vehicle_category_id == null && r.service_type == null,
  )
  const [pricePerKm, setPricePerKm] = useState(String(base?.price_per_km ?? 8))
  const [minimum, setMinimum] = useState(String(base?.minimum_fare ?? 120))
  const [hourly, setHourly] = useState(String(base?.price_per_hour ?? 180))
  const [fees, setFees] = useState<Record<AirportCode, string>>({
    GRU: String(
      props.airportFees.find((f) => f.airport === 'GRU')?.flat_fee ?? 40,
    ),
    CGH: String(
      props.airportFees.find((f) => f.airport === 'CGH')?.flat_fee ?? 40,
    ),
    VCP: String(
      props.airportFees.find((f) => f.airport === 'VCP')?.flat_fee ?? 40,
    ),
  })
  const [saving, setSaving] = useState(false)

  async function onSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await upsertFreightRule({
        id: base?.id,
        organization_id: props.organizationId,
        price_per_km: Number(pricePerKm),
        minimum_fare: Number(minimum),
        price_per_hour: Number(hourly),
      })
      await Promise.all(
        (['GRU', 'CGH', 'VCP'] as AirportCode[]).map((airport) =>
          updateAirportFee({
            organization_id: props.organizationId,
            airport,
            flat_fee: Number(fees[airport] || 0),
          }),
        ),
      )
      props.onChanged()
    } catch (err) {
      props.onError(err instanceof Error ? err.message : 'Falha ao salvar transfer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={onSave}
      className="w-full max-w-4xl space-y-5 rounded-2xl border border-border-light bg-surface-light p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <h2 className="font-semibold text-primary">{t('admin.freightTitle')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary-light">
            {t('admin.freightLead')}
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm text-text-primary-dark disabled:opacity-60"
        >
          {saving ? '…' : t('admin.freightSave')}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          {t('admin.freightPricePerKm')}
          <input
            className="mt-1 w-full rounded-lg border border-border-light px-3 py-2"
            type="number"
            step="0.01"
            value={pricePerKm}
            onChange={(e) => setPricePerKm(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          {t('admin.freightMinimum')}
          <input
            className="mt-1 w-full rounded-lg border border-border-light px-3 py-2"
            type="number"
            step="0.01"
            value={minimum}
            onChange={(e) => setMinimum(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          {t('admin.freightPricePerHour')}
          <input
            className="mt-1 w-full rounded-lg border border-border-light px-3 py-2"
            type="number"
            step="0.01"
            value={hourly}
            onChange={(e) => setHourly(e.target.value)}
            required
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(['GRU', 'CGH', 'VCP'] as AirportCode[]).map((airport) => (
          <label key={airport} className="block text-sm">
            {t('admin.freightAirportFee', { airport })}
            <input
              className="mt-1 w-full rounded-lg border border-border-light px-3 py-2"
              type="number"
              step="0.01"
              value={fees[airport]}
              onChange={(e) =>
                setFees((prev) => ({ ...prev, [airport]: e.target.value }))
              }
            />
          </label>
        ))}
      </div>
    </form>
  )
}
