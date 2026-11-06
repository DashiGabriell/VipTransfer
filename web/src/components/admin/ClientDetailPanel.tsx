import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getCustomer,
  listReservationsForCustomerPhone,
} from '../../services/admin'
import type { Customer, Reservation } from '../../types/database'

type Props = {
  organizationId: string
  customerId: string
  onError: (msg: string) => void
}

function localeFromLang(lang: string): string {
  return lang.startsWith('en') ? 'en-US' : 'pt-BR'
}

export function ClientDetailPanel({
  organizationId,
  customerId,
  onError,
}: Props) {
  const { t, i18n } = useTranslation()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [history, setHistory] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    onError('')

    void getCustomer(organizationId, customerId)
      .then((row) => {
        if (cancelled) return
        if (!row) {
          setCustomer(null)
          setNotFound(true)
          return
        }
        setCustomer(row)
      })
      .catch((err) => {
        if (!cancelled) {
          onError(
            err instanceof Error ? err.message : t('admin.clients.loadError'),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [organizationId, customerId, onError, t])

  useEffect(() => {
    if (!customer) {
      setHistory([])
      return
    }
    let cancelled = false
    setHistoryLoading(true)
    void listReservationsForCustomerPhone(organizationId, customer.phone)
      .then((rows) => {
        if (!cancelled) setHistory(rows)
      })
      .catch(() => {
        if (!cancelled) setHistory([])
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [organizationId, customer])

  if (loading) {
    return (
      <section className="admin-client-detail">
        <p className="text-sm text-text-secondary-light">…</p>
      </section>
    )
  }

  if (notFound || !customer) {
    return (
      <section className="admin-client-detail rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5">
        <p className="mb-4 text-sm text-text-secondary-light">
          {t('admin.clients.detailNotFound')}
        </p>
        <Link to="/admin/clientes" className="admin-clients__btn is-ghost">
          {t('admin.clients.backToList')}
        </Link>
      </section>
    )
  }

  const locale = localeFromLang(i18n.language)
  const notes = customer.notes?.trim() || '—'

  return (
    <section className="admin-client-detail">
      <div className="admin-client-detail__toolbar">
        <Link to="/admin/clientes" className="admin-clients__btn is-ghost">
          {t('admin.clients.backToList')}
        </Link>
      </div>

      <div className="admin-client-detail__panel rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5">
        <header className="admin-client-detail__header">
          <h2>{t('admin.clients.detailTitle')}</h2>
          <p>{customer.full_name}</p>
        </header>

        <div className="admin-table-wrap">
          <table className="admin-kv-table">
            <caption className="sr-only">
              {t('admin.clients.detailTitle')}: {customer.full_name}
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
                <td data-label={t('reserve.name')}>{customer.full_name}</td>
              </tr>
              <tr>
                <th scope="row">{t('reserve.phone')}</th>
                <td data-label={t('reserve.phone')}>
                  <a href={`tel:${customer.phone.replace(/\D/g, '')}`}>
                    {customer.phone}
                  </a>
                </td>
              </tr>
              <tr>
                <th scope="row">{t('reserve.email')}</th>
                <td data-label={t('reserve.email')}>
                  <a href={`mailto:${customer.email}`}>{customer.email}</a>
                </td>
              </tr>
              <tr>
                <th scope="row">{t('admin.clients.notes')}</th>
                <td data-label={t('admin.clients.notes')}>{notes}</td>
              </tr>
              <tr>
                <th scope="row">{t('admin.clients.status')}</th>
                <td data-label={t('admin.clients.status')}>
                  {customer.active
                    ? t('admin.clients.active')
                    : t('admin.clients.inactive')}
                </td>
              </tr>
              <tr>
                <th scope="row">{t('admin.clients.createdAt')}</th>
                <td data-label={t('admin.clients.createdAt')}>
                  {new Date(customer.created_at).toLocaleString(locale)}
                </td>
              </tr>
              <tr>
                <th scope="row">{t('admin.clients.updatedAt')}</th>
                <td data-label={t('admin.clients.updatedAt')}>
                  {new Date(customer.updated_at).toLocaleString(locale)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-client-detail__panel rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5">
        <header className="admin-client-detail__header">
          <h2>{t('admin.clients.historyTitle')}</h2>
          <p>
            {historyLoading
              ? '…'
              : t('admin.clients.historyLead', { count: history.length })}
          </p>
        </header>

        {!historyLoading && history.length === 0 ? (
          <p className="text-sm text-text-secondary-light">
            {t('admin.clients.historyEmpty')}
          </p>
        ) : null}

        {history.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-data-table">
              <caption className="sr-only">
                {t('admin.clients.historyTitle')}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t('admin.clients.colWhen')}</th>
                  <th scope="col">{t('admin.clients.colStatus')}</th>
                  <th scope="col">{t('admin.clients.colService')}</th>
                  <th scope="col">{t('admin.clients.colRoute')}</th>
                  <th scope="col">{t('admin.clients.colPrice')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id}>
                    <td data-label={t('admin.clients.colWhen')}>
                      {new Date(r.slot_start).toLocaleString(locale)}
                    </td>
                    <td data-label={t('admin.clients.colStatus')}>
                      {t(`admin.status.${r.status}`)}
                    </td>
                    <td data-label={t('admin.clients.colService')}>
                      {t(`reserve.services.${r.service_type}`)}
                    </td>
                    <td data-label={t('admin.clients.colRoute')}>
                      <span className="admin-data-table__route">
                        {r.origin_address}
                        <span aria-hidden="true"> → </span>
                        {r.destination_address}
                      </span>
                    </td>
                    <td data-label={t('admin.clients.colPrice')}>
                      {r.override_price != null && Number(r.override_price) > 0
                        ? `R$ ${Number(r.override_price).toFixed(2)}`
                        : r.estimated_price != null
                          ? `~ R$ ${Number(r.estimated_price).toFixed(2)}`
                          : 'WhatsApp'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  )
}
