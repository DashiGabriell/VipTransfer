import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  listFinancialEntries,
  liquidateFinancialEntry,
  readCommissionPercent,
  setOrgCommissionPercent,
} from '../../services/coreV2'
import type { FinancialEntry } from '../../types/database'

type Props = {
  organizationId: string
  orgSettings: unknown
  onError: (msg: string) => void
  onSettingsChanged: () => void
}

export function FinancePanel({
  organizationId,
  orgSettings,
  onError,
  onSettingsChanged,
}: Props) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith('en') ? 'en-US' : 'pt-BR'
  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [percent, setPercent] = useState(String(readCommissionPercent(orgSettings)))
  const [savingPct, setSavingPct] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    setPercent(String(readCommissionPercent(orgSettings)))
  }, [orgSettings])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    onError('')
    void listFinancialEntries(organizationId)
      .then((rows) => {
        if (!cancelled) setEntries(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : t('admin.finance.loadError'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [organizationId, onError, t])

  async function onSavePercent(e: FormEvent) {
    e.preventDefault()
    onError('')
    const n = Number(percent)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      onError(t('admin.finance.percentInvalid'))
      return
    }
    setSavingPct(true)
    try {
      await setOrgCommissionPercent(organizationId, n)
      onSettingsChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : t('admin.finance.savePercentError'))
    } finally {
      setSavingPct(false)
    }
  }

  async function onLiquidate(id: string) {
    setBusyId(id)
    onError('')
    try {
      const updated = await liquidateFinancialEntry(id)
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    } catch (err) {
      onError(err instanceof Error ? err.message : t('admin.finance.liquidateError'))
    } finally {
      setBusyId(null)
    }
  }

  const totals = entries.reduce(
    (acc, e) => {
      acc.gross += Number(e.gross_amount)
      acc.commission += Number(e.commission_amount)
      acc.driver += Number(e.driver_amount)
      return acc
    },
    { gross: 0, commission: 0, driver: 0 },
  )

  return (
    <section className="admin-client-detail">
      <form
        onSubmit={onSavePercent}
        className="admin-client-detail__panel rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5"
      >
        <header className="admin-client-detail__header">
          <h2>{t('admin.finance.commissionTitle')}</h2>
          <p>{t('admin.finance.commissionLead')}</p>
        </header>
        <div className="admin-clients__grid" style={{ maxWidth: '20rem' }}>
          <label className="admin-clients__field">
            <span>{t('admin.finance.percent')}</span>
            <input
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              inputMode="decimal"
              required
            />
          </label>
        </div>
        <div className="admin-clients__form-actions">
          <button
            type="submit"
            className="admin-clients__btn is-primary"
            disabled={savingPct}
          >
            {savingPct ? t('admin.clients.saving') : t('admin.finance.savePercent')}
          </button>
        </div>
      </form>

      <div className="admin-client-detail__panel rounded-2xl border border-border-light bg-surface-light p-4 sm:p-5">
        <header className="admin-client-detail__header">
          <h2>{t('admin.finance.ledgerTitle')}</h2>
          <p>
            {t('admin.finance.ledgerLead', {
              gross: totals.gross.toFixed(2),
              commission: totals.commission.toFixed(2),
              driver: totals.driver.toFixed(2),
            })}
          </p>
        </header>

        {loading ? <p className="text-sm text-text-secondary-light">…</p> : null}
        {!loading && !entries.length ? (
          <p className="text-sm text-text-secondary-light">{t('admin.finance.empty')}</p>
        ) : null}

        {entries.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th scope="col">{t('admin.finance.colDate')}</th>
                  <th scope="col">{t('admin.finance.colGross')}</th>
                  <th scope="col">{t('admin.finance.colCommission')}</th>
                  <th scope="col">{t('admin.finance.colDriver')}</th>
                  <th scope="col">{t('admin.finance.colStatus')}</th>
                  <th scope="col">{t('admin.finance.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td data-label={t('admin.finance.colDate')}>
                      {new Date(e.created_at).toLocaleString(locale)}
                    </td>
                    <td data-label={t('admin.finance.colGross')}>
                      R$ {Number(e.gross_amount).toFixed(2)}
                    </td>
                    <td data-label={t('admin.finance.colCommission')}>
                      R$ {Number(e.commission_amount).toFixed(2)} ({e.commission_percent}%)
                    </td>
                    <td data-label={t('admin.finance.colDriver')}>
                      R$ {Number(e.driver_amount).toFixed(2)}
                    </td>
                    <td data-label={t('admin.finance.colStatus')}>
                      {t(`admin.finance.status.${e.status}`)}
                    </td>
                    <td data-label={t('admin.finance.colActions')}>
                      {e.status !== 'liquidado' ? (
                        <button
                          type="button"
                          className="admin-clients__btn is-ghost"
                          disabled={busyId === e.id}
                          onClick={() => void onLiquidate(e.id)}
                        >
                          {t('admin.finance.liquidate')}
                        </button>
                      ) : (
                        '—'
                      )}
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
