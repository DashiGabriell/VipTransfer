import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import {
  AdminSidebar,
  isAdminNavId,
  type AdminNavId,
} from '../../components/admin/AdminSidebar'
import { AvailabilityPanel } from '../../components/admin/AvailabilityPanel'
import { ProfilePanel } from '../../components/admin/ProfilePanel'
import { LanguageToggle } from '../../components/LanguageToggle'
import {
  cancelReservation,
  canAdmin,
  canOperate,
  claimOrgOwner,
  confirmReservation,
  createVehicleCategory,
  listFreightRulesAdmin,
  listMyMemberships,
  listReservations,
  listVehiclesAdmin,
  updateAirportFee,
  upsertFreightRule,
  type Membership,
} from '../../services/admin'
import type {
  AirportCode,
  FreightRule,
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
  const { section } = useParams<{ section: string }>()
  const { user, signOut } = useAuth()
  const tenant = useTenant()
  const tab: Tab = isAdminNavId(section) ? section : 'reservas'
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>(
    'hold',
  )
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [vehicles, setVehicles] = useState<VehicleCategory[]>([])
  const [freightRules, setFreightRules] = useState<FreightRule[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [agendaFocus, setAgendaFocus] = useState<DaySlot | null>(null)
  const [agendaKey, setAgendaKey] = useState(0)

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
  }, [orgId, role, statusFilter, tab])

  const refreshCatalogAdmin = useCallback(async () => {
    if (!orgId || !canAdmin(role)) return
    const [v, f] = await Promise.all([
      listVehiclesAdmin(orgId),
      listFreightRulesAdmin(orgId),
    ])
    setVehicles(v)
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
    void (async () => {
      try {
        setError(null)
        await refreshReservations()
        await refreshCatalogAdmin()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar painel')
      }
    })()
  }, [refreshReservations, refreshCatalogAdmin])

  const title = useMemo(() => {
    const labels: Record<Tab, string> = {
      reservas: t('admin.navReservas'),
      agenda: t('admin.navAgenda'),
      frota: t('admin.navFrota'),
      frete: t('admin.navFrete'),
      perfil: t('admin.navPerfil'),
    }
    return labels[tab]
  }, [t, tab, i18n.language])

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

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
    mobileOpen ? 'is-mobile-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (!isAdminNavId(section)) {
    return <Navigate to="/admin/reservas" replace />
  }

  return (
    <div className={layoutClass}>
      <button
        type="button"
        className="admin-backdrop"
        aria-label="Fechar menu"
        onClick={() => setMobileOpen(false)}
      />

      <AdminSidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        brand={tenant.name}
        email={user?.email}
        role={role}
        onToggleCollapsed={() => {
          // Mobile: toggle acts as close; desktop: collapse/expand
          if (window.matchMedia('(max-width: 900px)').matches) {
            setMobileOpen(false)
            return
          }
          setCollapsed((v) => !v)
        }}
        onCloseMobile={() => setMobileOpen(false)}
        onSignOut={() => {
          void signOut().then(() =>
            navigate('/admin/reservas', { replace: true }),
          )
        }}
      />

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar__left">
            <button
              type="button"
              className="admin-mobile-toggle"
              aria-label={t('admin.openMenu')}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div>
              <h1>{title}</h1>
              <p>
                {tenant.name}
                {role ? ` · ${role}` : ` · ${t('admin.noAccess')}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle variant="admin" />
            <button
              type="button"
              className="rounded-none border border-[var(--admin-line)] bg-[var(--admin-paper-warm)] px-3 py-2 text-xs tracking-wide uppercase"
              onClick={() => {
                if (window.matchMedia('(max-width: 900px)').matches) {
                  setMobileOpen((v) => !v)
                  return
                }
                setCollapsed((v) => !v)
              }}
              aria-label={
                collapsed ? t('admin.expand') : t('admin.collapse')
              }
            >
              {t('admin.menu')}
            </button>
          </div>
        </header>

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
                />
              )}

              {tab === 'agenda' && canOperate(role) && (
                <section className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border-light bg-surface-light p-5">
                    <h2 className="mb-3 font-semibold text-primary">
                      {t('admin.agendaVisual')}
                    </h2>
                    <SlotAgenda
                      key={agendaKey}
                      organizationId={orgId}
                      selectedStart={agendaFocus?.slot_start ?? null}
                      onSelect={setAgendaFocus}
                      mode="admin"
                    />
                  </div>
                  <div className="rounded-2xl border border-border-light bg-surface-light p-5">
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
                              className="rounded-lg border border-border-light px-3 py-2"
                            >
                              <div className="font-medium">
                                {r.customer_name} ·{' '}
                                {t(`admin.status.${r.status}`)}
                              </div>
                              <div className="text-xs text-text-secondary-light">
                                {r.customer_phone} · {r.service_type}
                              </div>
                              {(r.status === 'hold' ||
                                r.status === 'hold_expirado') && (
                                <div className="mt-2 flex gap-2">
                                  <button
                                    type="button"
                                    className="rounded bg-primary px-2 py-1 text-xs text-text-primary-dark"
                                    onClick={() => void onConfirm(r.id)}
                                  >
                                    {t('admin.confirm')}
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded border border-border-light px-2 py-1 text-xs"
                                    onClick={() => void onCancel(r.id)}
                                  >
                                    {t('admin.cancel')}
                                  </button>
                                </div>
                              )}
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
                        }}
                      />
                    </div>
                  )}
                </section>
              )}

              {tab === 'frota' && canAdmin(role) && (
                <FleetPanel
                  organizationId={orgId!}
                  vehicles={vehicles}
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

              {tab === 'perfil' && (
                <ProfilePanel onError={setError} />
              )}

              {(tab === 'frota' || tab === 'frete') && !canAdmin(role) && (
                <p className="text-sm text-text-secondary-light">
                  {t('admin.roleDenied', { role })}
                </p>
              )}
            </div>
          )}
        </main>
      </div>
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
}) {
  const { t, i18n } = useTranslation()
  const locale = localeFromLang(i18n.language)

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
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

      <div className="overflow-x-auto rounded-2xl border border-border-light bg-surface-light">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border-light text-xs text-text-secondary-light">
            <tr>
              <th className="px-4 py-3">Slot</th>
              <th className="px-4 py-3">
                {i18n.language.startsWith('en') ? 'Customer' : 'Cliente'}
              </th>
              <th className="px-4 py-3">
                {i18n.language.startsWith('en') ? 'Route' : 'Trecho'}
              </th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Est.</th>
              <th className="px-4 py-3">
                {i18n.language.startsWith('en') ? 'Actions' : 'Ações'}
              </th>
            </tr>
          </thead>
          <tbody>
            {props.reservations.map((r, index) => (
              <tr
                key={r.id}
                className="admin-row-enter border-b border-border-light/70"
                style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
              >
                <td className="px-4 py-3 whitespace-nowrap">
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
                <td className="px-4 py-3">
                  <div className="font-medium">{r.customer_name}</div>
                  <div className="text-xs text-text-secondary-light">
                    {r.customer_phone}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="max-w-[220px] truncate">{r.origin_address}</div>
                  <div className="max-w-[220px] truncate text-xs text-text-secondary-light">
                    → {r.destination_address}
                  </div>
                </td>
                <td className="px-4 py-3">{t(`admin.status.${r.status}`)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {r.estimated_price != null
                    ? `R$ ${Number(r.estimated_price).toFixed(2)}`
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {(r.status === 'hold' || r.status === 'hold_expirado') && (
                      <button
                        type="button"
                        disabled={props.busyId === r.id}
                        onClick={() => props.onConfirm(r.id)}
                        className="rounded bg-primary px-2 py-1 text-xs text-text-primary-dark disabled:opacity-50"
                      >
                        {t('admin.confirm')}
                      </button>
                    )}
                    {r.status !== 'cancelado' && r.status !== 'concluido' && (
                      <button
                        type="button"
                        disabled={props.busyId === r.id}
                        onClick={() => props.onCancel(r.id)}
                        className="rounded border border-border-light px-2 py-1 text-xs disabled:opacity-50"
                      >
                        {t('admin.cancel')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!props.reservations.length && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-text-secondary-light"
                >
                  Nenhuma reserva neste filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function FleetPanel(props: {
  organizationId: string
  vehicles: VehicleCategory[]
  onChanged: () => void
  onError: (msg: string) => void
}) {
  const [namePt, setNamePt] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [armored, setArmored] = useState(false)
  const [saving, setSaving] = useState(false)

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await createVehicleCategory({
        organization_id: props.organizationId,
        name_pt: namePt,
        name_en: nameEn || namePt,
        is_armored: armored,
      })
      setNamePt('')
      setNameEn('')
      setArmored(false)
      props.onChanged()
    } catch (err) {
      props.onError(err instanceof Error ? err.message : 'Falha ao criar veículo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <form
        onSubmit={onCreate}
        className="space-y-3 rounded-2xl border border-border-light bg-surface-light p-5"
      >
        <h2 className="font-semibold text-primary">Nova categoria</h2>
        <input
          className="w-full rounded-lg border border-border-light px-3 py-2 text-sm"
          placeholder="Nome (pt)"
          value={namePt}
          onChange={(e) => setNamePt(e.target.value)}
          required
        />
        <input
          className="w-full rounded-lg border border-border-light px-3 py-2 text-sm"
          placeholder="Name (en)"
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={armored}
            onChange={(e) => setArmored(e.target.checked)}
          />
          Blindado
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-text-primary-dark disabled:opacity-60"
        >
          Cadastrar
        </button>
      </form>

      <div className="rounded-2xl border border-border-light bg-surface-light p-5">
        <h2 className="mb-3 font-semibold text-primary">Categorias</h2>
        <ul className="space-y-2 text-sm">
          {props.vehicles.map((v) => (
            <li
              key={v.id}
              className="flex justify-between border-b border-border-light/60 py-2"
            >
              <span>
                {(v.name_i18n as { pt?: string }).pt || '—'}
                {v.is_armored ? ' · blindado' : ''}
              </span>
              <span className="text-xs text-text-secondary-light">
                {v.active ? 'ativo' : 'inativo'}
              </span>
            </li>
          ))}
          {!props.vehicles.length && (
            <li className="text-text-secondary-light">Nenhuma categoria ainda.</li>
          )}
        </ul>
      </div>
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
      props.onError(err instanceof Error ? err.message : 'Falha ao salvar frete')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={onSave}
      className="max-w-lg space-y-3 rounded-2xl border border-border-light bg-surface-light p-5"
    >
      <h2 className="font-semibold text-primary">Regra base de frete</h2>
      <label className="block text-sm">
        R$/km
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
        Mínimo
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
        R$/hora
        <input
          className="mt-1 w-full rounded-lg border border-border-light px-3 py-2"
          type="number"
          step="0.01"
          value={hourly}
          onChange={(e) => setHourly(e.target.value)}
          required
        />
      </label>
      {(['GRU', 'CGH', 'VCP'] as AirportCode[]).map((airport) => (
        <label key={airport} className="block text-sm">
          Taxa {airport}
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
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-primary px-4 py-2 text-sm text-text-primary-dark disabled:opacity-60"
      >
        Salvar frete
      </button>
    </form>
  )
}
