import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { WEEK_DAYS } from '../../domain/drivers'
import {
  getDriver,
  listAssignmentsForDriver,
  type DriverAssignmentRow,
} from '../../services/coreV2'
import type { Driver, VehicleCategory } from '../../types/database'

type Props = {
  organizationId: string
  driverId: string
  categories: VehicleCategory[]
  onError: (msg: string) => void
}

function localeFromLang(lang: string): string {
  return lang.startsWith('en') ? 'en-US' : 'pt-BR'
}

function brandLabel(brand: string): string {
  if (brand === 'LandRover') return 'Land Rover'
  if (brand === 'CaoaChery') return 'Caoa Chery'
  return brand
}

export function DriverDetailPanel({
  organizationId,
  driverId,
  categories,
  onError,
}: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.startsWith('en') ? 'en' : 'pt'
  const locale = localeFromLang(i18n.language)

  const [driver, setDriver] = useState<Driver | null>(null)
  const [jobs, setJobs] = useState<DriverAssignmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    onError('')

    void getDriver(organizationId, driverId)
      .then((row) => {
        if (cancelled) return
        if (!row) {
          setDriver(null)
          setNotFound(true)
          return
        }
        setDriver(row)
      })
      .catch((err) => {
        if (!cancelled) {
          onError(
            err instanceof Error ? err.message : t('admin.drivers.loadError'),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [organizationId, driverId, onError, t])

  useEffect(() => {
    if (!driver) {
      setJobs([])
      return
    }
    let cancelled = false
    setJobsLoading(true)
    void listAssignmentsForDriver(organizationId, driver.id)
      .then((rows) => {
        if (!cancelled) setJobs(rows)
      })
      .catch(() => {
        if (!cancelled) setJobs([])
      })
      .finally(() => {
        if (!cancelled) setJobsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [organizationId, driver])

  const stats = useMemo(() => {
    const base = { oferecido: 0, aceito: 0, recusado: 0, concluido: 0, cancelado: 0 }
    for (const j of jobs) {
      if (j.status in base) base[j.status as keyof typeof base] += 1
    }
    return base
  }, [jobs])

  const categoryLabel = useMemo(() => {
    if (!driver) return '—'
    const cat = categories.find((c) => c.id === driver.vehicle_category_id)
    if (!cat) return '—'
    return (
      (cat.name_i18n as { pt?: string; en?: string })[lang] ||
      cat.name_i18n.pt ||
      cat.code
    )
  }, [categories, driver, lang])

  if (loading) {
    return (
      <section className="admin-client-detail">
        <p className="text-sm text-text-secondary-light">…</p>
      </section>
    )
  }

  if (notFound || !driver) {
    return (
      <section className="admin-client-detail rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5">
        <p className="mb-4 text-sm text-text-secondary-light">
          {t('admin.drivers.detailNotFound')}
        </p>
        <Link to="/admin/motoristas" className="admin-clients__btn is-ghost">
          {t('admin.drivers.backToList')}
        </Link>
      </section>
    )
  }

  const skills =
    driver.skills?.length > 0
      ? driver.skills.map((s) => t(`admin.drivers.skill.${s}`, { defaultValue: s })).join(', ')
      : '—'
  const availability =
    driver.availability?.length > 0
      ? driver.availability
          .map((slot) => {
            const day =
              WEEK_DAYS.find((d) => d.value === slot.day_of_week)?.labelKey ??
              'admin.days.0'
            return `${t(day)} ${slot.start_time}–${slot.end_time}`
          })
          .join(' · ')
      : '—'

  return (
    <section className="admin-client-detail">
      <div className="admin-client-detail__toolbar">
        <Link to="/admin/motoristas" className="admin-clients__btn is-ghost">
          {t('admin.drivers.backToList')}
        </Link>
      </div>

      <div className="admin-client-detail__panel rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5">
        <header className="admin-client-detail__header">
          <h2>{t('admin.drivers.detailTitle')}</h2>
          <p>{driver.full_name}</p>
        </header>

        <div className="admin-table-wrap">
          <table className="admin-kv-table">
            <caption className="sr-only">
              {t('admin.drivers.detailTitle')}: {driver.full_name}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('admin.clients.tableField')}</th>
                <th scope="col">{t('admin.clients.tableValue')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{t('reserve.name')}</th>
                <td data-label={t('reserve.name')}>{driver.full_name}</td>
              </tr>
              <tr>
                <th scope="row">{t('reserve.phone')}</th>
                <td data-label={t('reserve.phone')}>
                  <a href={`tel:${driver.phone.replace(/\D/g, '')}`}>{driver.phone}</a>
                </td>
              </tr>
              <tr>
                <th scope="row">{t('reserve.email')}</th>
                <td data-label={t('reserve.email')}>
                  <a href={`mailto:${driver.email}`}>{driver.email}</a>
                </td>
              </tr>
              <tr>
                <th scope="row">{t('admin.drivers.category')}</th>
                <td data-label={t('admin.drivers.category')}>{categoryLabel}</td>
              </tr>
              <tr>
                <th scope="row">{t('admin.drivers.brand')}</th>
                <td data-label={t('admin.drivers.brand')}>
                  {brandLabel(driver.vehicle_brand)}
                </td>
              </tr>
              <tr>
                <th scope="row">{t('admin.drivers.model')}</th>
                <td data-label={t('admin.drivers.model')}>{driver.vehicle_model}</td>
              </tr>
              <tr>
                <th scope="row">{t('admin.drivers.year')}</th>
                <td data-label={t('admin.drivers.year')}>
                  {driver.vehicle_year ?? '—'}
                </td>
              </tr>
              <tr>
                <th scope="row">{t('admin.drivers.color')}</th>
                <td data-label={t('admin.drivers.color')}>
                  {driver.vehicle_color || '—'}
                </td>
              </tr>
              <tr>
                <th scope="row">{t('admin.drivers.plate')}</th>
                <td data-label={t('admin.drivers.plate')}>
                  {driver.vehicle_plate || '—'}
                </td>
              </tr>
              <tr>
                <th scope="row">{t('admin.drivers.body')}</th>
                <td data-label={t('admin.drivers.body')}>
                  {driver.vehicle_body_type
                    ? t(`admin.fleet.bodyTypes.${driver.vehicle_body_type}`)
                    : '—'}
                </td>
              </tr>
              <tr>
                <th scope="row">{t('admin.drivers.skills')}</th>
                <td data-label={t('admin.drivers.skills')}>{skills}</td>
              </tr>
              <tr>
                <th scope="row">{t('admin.drivers.availability')}</th>
                <td data-label={t('admin.drivers.availability')}>{availability}</td>
              </tr>
              <tr>
                <th scope="row">{t('admin.drivers.notes')}</th>
                <td data-label={t('admin.drivers.notes')}>
                  {driver.notes?.trim() || '—'}
                </td>
              </tr>
              <tr>
                <th scope="row">{t('admin.drivers.documents')}</th>
                <td data-label={t('admin.drivers.documents')}>
                  {driver.documents_notes?.trim() || '—'}
                </td>
              </tr>
              <tr>
                <th scope="row">{t('admin.clients.status')}</th>
                <td data-label={t('admin.clients.status')}>
                  {driver.profile_complete
                    ? t('admin.drivers.ready')
                    : t('admin.drivers.incomplete')}
                  {' · '}
                  {driver.active
                    ? t('admin.clients.active')
                    : t('admin.clients.inactive')}
                </td>
              </tr>
              <tr>
                <th scope="row">{t('admin.drivers.accountLinked')}</th>
                <td data-label={t('admin.drivers.accountLinked')}>
                  {driver.user_id
                    ? t('admin.drivers.accountLinkedYes')
                    : t('admin.drivers.accountLinkedNo')}
                </td>
              </tr>
              <tr>
                <th scope="row">{t('admin.clients.createdAt')}</th>
                <td data-label={t('admin.clients.createdAt')}>
                  {new Date(driver.created_at).toLocaleString(locale)}
                </td>
              </tr>
              <tr>
                <th scope="row">{t('admin.clients.updatedAt')}</th>
                <td data-label={t('admin.clients.updatedAt')}>
                  {new Date(driver.updated_at).toLocaleString(locale)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-client-detail__panel rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5">
        <header className="admin-client-detail__header">
          <h2>{t('admin.drivers.statsTitle')}</h2>
          <p>{t('admin.drivers.statsLead', { total: jobs.length })}</p>
        </header>
        <div className="admin-table-wrap">
          <table className="admin-kv-table">
            <thead>
              <tr>
                <th scope="col">{t('admin.clients.tableField')}</th>
                <th scope="col">{t('admin.clients.tableValue')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{t('admin.dispatch.status.oferecido')}</th>
                <td>{stats.oferecido}</td>
              </tr>
              <tr>
                <th scope="row">{t('admin.dispatch.status.aceito')}</th>
                <td>{stats.aceito}</td>
              </tr>
              <tr>
                <th scope="row">{t('admin.dispatch.status.recusado')}</th>
                <td>{stats.recusado}</td>
              </tr>
              <tr>
                <th scope="row">{t('admin.dispatch.status.concluido')}</th>
                <td>{stats.concluido}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-client-detail__panel rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5">
        <header className="admin-client-detail__header">
          <h2>{t('admin.drivers.jobsTitle')}</h2>
          <p>
            {jobsLoading
              ? '…'
              : t('admin.drivers.jobsLead', { count: jobs.length })}
          </p>
        </header>

        {!jobsLoading && jobs.length === 0 ? (
          <p className="text-sm text-text-secondary-light">
            {t('admin.drivers.jobsEmpty')}
          </p>
        ) : null}

        {jobs.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-data-table">
              <caption className="sr-only">{t('admin.drivers.jobsTitle')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('admin.drivers.colOffered')}</th>
                  <th scope="col">{t('admin.clients.colStatus')}</th>
                  <th scope="col">{t('admin.clients.colWhen')}</th>
                  <th scope="col">{t('admin.clients.colService')}</th>
                  <th scope="col">{t('admin.clients.colRoute')}</th>
                  <th scope="col">{t('admin.clients.colPrice')}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const res = j.reservation
                  return (
                    <tr key={j.id}>
                      <td data-label={t('admin.drivers.colOffered')}>
                        {new Date(j.offered_at).toLocaleString(locale)}
                      </td>
                      <td data-label={t('admin.clients.colStatus')}>
                        {t(`admin.dispatch.status.${j.status}`)}
                        {j.refuse_reason ? ` — ${j.refuse_reason}` : ''}
                      </td>
                      <td data-label={t('admin.clients.colWhen')}>
                        {res?.slot_start
                          ? new Date(res.slot_start).toLocaleString(locale)
                          : '—'}
                      </td>
                      <td data-label={t('admin.clients.colService')}>
                        {res?.service_type
                          ? t(`reserve.services.${res.service_type}`)
                          : '—'}
                      </td>
                      <td data-label={t('admin.clients.colRoute')}>
                        {res ? (
                          <span className="admin-data-table__route">
                            {res.origin_address}
                            <span aria-hidden="true"> → </span>
                            {res.destination_address}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td data-label={t('admin.clients.colPrice')}>
                        {res?.estimated_price != null
                          ? `R$ ${Number(res.estimated_price).toFixed(2)}`
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  )
}
