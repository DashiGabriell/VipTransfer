import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  listFinancialEntries,
  liquidateFinancialEntry,
  readCommissionPercent,
  setOrgCommissionPercent,
  uploadSettlementProof,
} from '../../services/coreV2'
import type { FinancialEntry } from '../../types/database'
import { publicSiteOrigin } from '../../lib/siteUrl'

const PROOF_ACCEPT = '.pdf,image/jpeg,image/png,image/webp,image/jpg,.jpg,.jpeg,.png,.webp'

type Props = {
  organizationId: string
  orgSettings: unknown
  orgName?: string
  onError: (msg: string) => void
  onSettingsChanged: () => void
}

type PeriodPreset = '7d' | '30d' | '90d' | 'custom'

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function toInputDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function money(n: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'BRL',
  }).format(n)
}

function BarChart({
  series,
  labels,
}: {
  series: number[]
  labels: string[]
}) {
  const max = Math.max(...series, 1)
  const w = 320
  const h = 120
  const gap = 8
  const barW = (w - gap * (series.length + 1)) / Math.max(series.length, 1)
  return (
    <svg viewBox={`0 0 ${w} ${h + 28}`} className="admin-finance__chart" role="img">
      {series.map((v, i) => {
        const bh = (v / max) * h
        const x = gap + i * (barW + gap)
        const y = h - bh
        return (
          <g key={labels[i] ?? i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(bh, 2)}
              rx="4"
              fill="#b08d57"
            />
            <text
              x={x + barW / 2}
              y={h + 16}
              textAnchor="middle"
              fontSize="9"
              fill="#5c554c"
            >
              {labels[i]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function DonutChart({
  parts,
}: {
  parts: Array<{ label: string; value: number; color: string }>
}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1
  let angle = -Math.PI / 2
  const r = 42
  const cx = 56
  const cy = 56
  const paths = parts.map((p) => {
    const sweep = (p.value / total) * Math.PI * 2
    const x1 = cx + r * Math.cos(angle)
    const y1 = cy + r * Math.sin(angle)
    angle += sweep
    const x2 = cx + r * Math.cos(angle)
    const y2 = cy + r * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
    return { ...p, d }
  })
  return (
    <div className="admin-finance__donut-wrap">
      <svg viewBox="0 0 112 112" className="admin-finance__donut" role="img">
        {paths.map((p) => (
          <path key={p.label} d={p.d} fill={p.color} />
        ))}
        <circle cx={cx} cy={cy} r={24} fill="#fffdf8" />
      </svg>
      <ul>
        {parts.map((p) => (
          <li key={p.label}>
            <span style={{ background: p.color }} />
            {p.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function FinancePanel({
  organizationId,
  orgSettings,
  orgName = 'JMD Transfer',
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
  const [settleEntry, setSettleEntry] = useState<FinancialEntry | null>(null)
  const [viewProofsEntry, setViewProofsEntry] = useState<FinancialEntry | null>(
    null,
  )
  const [clientProof, setClientProof] = useState<File | null>(null)
  const [driverProof, setDriverProof] = useState<File | null>(null)
  const [settleError, setSettleError] = useState<string | null>(null)
  const [exportNote, setExportNote] = useState<string | null>(null)
  const [preset, setPreset] = useState<PeriodPreset>('30d')
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 29)
    return toInputDate(d)
  })
  const [toDate, setToDate] = useState(() => toInputDate(new Date()))

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

  function applyPreset(next: PeriodPreset) {
    setPreset(next)
    if (next === 'custom') return
    const days = next === '7d' ? 6 : next === '30d' ? 29 : 89
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days)
    setFromDate(toInputDate(start))
    setToDate(toInputDate(end))
  }

  const filtered = useMemo(() => {
    const from = startOfDay(new Date(fromDate))
    const to = endOfDay(new Date(toDate))
    return entries.filter((e) => {
      const ts = new Date(e.created_at).getTime()
      return ts >= from.getTime() && ts <= to.getTime()
    })
  }, [entries, fromDate, toDate])

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, e) => {
          acc.gross += Number(e.gross_amount)
          acc.commission += Number(e.commission_amount)
          acc.driver += Number(e.driver_amount)
          if (e.status === 'liquidado') acc.liquidated += 1
          else acc.open += 1
          return acc
        },
        { gross: 0, commission: 0, driver: 0, open: 0, liquidated: 0 },
      ),
    [filtered],
  )

  const weekly = useMemo(() => {
    const buckets = new Map<string, number>()
    for (const e of filtered) {
      const d = new Date(e.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      buckets.set(key, (buckets.get(key) ?? 0) + Number(e.gross_amount))
    }
    const keys = [...buckets.keys()].sort().slice(-7)
    return {
      labels: keys.map((k) => k.slice(5)),
      values: keys.map((k) => buckets.get(k) ?? 0),
    }
  }, [filtered])

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

  function openSettleModal(entry: FinancialEntry) {
    setSettleEntry(entry)
    setClientProof(null)
    setDriverProof(null)
    setSettleError(null)
    onError('')
  }

  function closeSettleModal() {
    if (busyId) return
    setSettleEntry(null)
    setClientProof(null)
    setDriverProof(null)
    setSettleError(null)
  }

  function mapProofError(err: unknown): string {
    const code = err instanceof Error ? err.message : ''
    if (code === 'PROOF_TOO_LARGE') return t('admin.finance.proofTooLarge')
    if (code === 'PROOF_TYPE_INVALID') return t('admin.finance.proofTypeInvalid')
    if (code.includes('PROOFS_REQUIRED')) return t('admin.finance.proofRequired')
    return err instanceof Error && err.message
      ? err.message
      : t('admin.finance.liquidateError')
  }

  async function onConfirmLiquidate(e: FormEvent) {
    e.preventDefault()
    if (!settleEntry) return
    if (!clientProof || !driverProof) {
      setSettleError(t('admin.finance.proofRequired'))
      return
    }

    setBusyId(settleEntry.id)
    setSettleError(null)
    onError('')
    try {
      const [clientUrl, driverUrl] = await Promise.all([
        uploadSettlementProof({
          organization_id: organizationId,
          entry_id: settleEntry.id,
          kind: 'client_to_platform',
          file: clientProof,
        }),
        uploadSettlementProof({
          organization_id: organizationId,
          entry_id: settleEntry.id,
          kind: 'platform_to_driver',
          file: driverProof,
        }),
      ])
      const updated = await liquidateFinancialEntry(settleEntry.id, {
        client_to_platform_proof_url: clientUrl,
        platform_to_driver_proof_url: driverUrl,
      })
      setEntries((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      setSettleEntry(null)
      setClientProof(null)
      setDriverProof(null)
    } catch (err) {
      const msg = mapProofError(err)
      setSettleError(msg)
      onError(msg)
    } finally {
      setBusyId(null)
    }
  }

  function hasProofs(entry: FinancialEntry) {
    return Boolean(
      entry.client_to_platform_proof_url || entry.platform_to_driver_proof_url,
    )
  }

  function exportReport() {
    setExportNote(null)
    const periodLabel = `${fromDate} → ${toDate}`
    const rowsHtml = filtered
      .map(
        (e) => `
      <tr>
        <td>${new Date(e.created_at).toLocaleString(locale)}</td>
        <td>${money(Number(e.gross_amount), locale)}</td>
        <td>${money(Number(e.commission_amount), locale)}</td>
        <td>${money(Number(e.driver_amount), locale)}</td>
        <td>${t(`admin.finance.status.${e.status}`)}</td>
      </tr>`,
      )
      .join('')

    const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <title>${t('admin.finance.reportTitle')} — ${orgName}</title>
  <style>
    @page { margin: 18mm 14mm; }
    body {
      font-family: "Public Sans", system-ui, sans-serif;
      color: #152033;
      margin: 0;
      background: #fff;
    }
    .sheet { position: relative; padding: 12px 8px 28px; }
    .wm {
      position: fixed; inset: 0; display: grid; place-items: center;
      pointer-events: none; opacity: 0.06; z-index: 0;
    }
    .wm img { width: min(420px, 55vw); }
    header, main, footer { position: relative; z-index: 1; }
    header {
      display: flex; justify-content: space-between; align-items: flex-end;
      border-bottom: 2px solid #b08d57; padding-bottom: 12px; margin-bottom: 18px;
    }
    header img { height: 42px; }
    header h1 {
      margin: 0; font-family: "Bodoni Moda", "Times New Roman", serif;
      font-size: 1.45rem; font-weight: 500;
    }
    header p { margin: 4px 0 0; color: #5c554c; font-size: 0.85rem; }
    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
    .kpi { border: 1px solid #d8cfc0; border-radius: 10px; padding: 10px 12px; background: #fffdf8; }
    .kpi span { display: block; font-size: 0.7rem; letter-spacing: .06em; text-transform: uppercase; color: #5c554c; }
    .kpi strong { font-size: 1.05rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    th, td { border-bottom: 1px solid #d8cfc0; padding: 8px 6px; text-align: left; }
    th { font-size: 0.68rem; letter-spacing: .06em; text-transform: uppercase; color: #5c554c; }
    footer {
      margin-top: 22px; padding-top: 10px; border-top: 1px solid #d8cfc0;
      display: flex; justify-content: space-between; color: #5c554c; font-size: 0.72rem;
    }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="wm"><img src="${publicSiteOrigin()}/logo-1.png" alt="" /></div>
  <div class="sheet">
    <header>
      <div>
        <img src="${publicSiteOrigin()}/logo-1.png" alt="${orgName}" />
        <h1>${t('admin.finance.reportTitle')}</h1>
        <p>${orgName} · ${periodLabel}</p>
      </div>
      <p>${new Date().toLocaleString(locale)}</p>
    </header>
    <main>
      <div class="kpis">
        <div class="kpi"><span>${t('admin.finance.kpiGross')}</span><strong>${money(totals.gross, locale)}</strong></div>
        <div class="kpi"><span>${t('admin.finance.kpiCommission')}</span><strong>${money(totals.commission, locale)}</strong></div>
        <div class="kpi"><span>${t('admin.finance.kpiDriver')}</span><strong>${money(totals.driver, locale)}</strong></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>${t('admin.finance.colDate')}</th>
            <th>${t('admin.finance.colGross')}</th>
            <th>${t('admin.finance.colCommission')}</th>
            <th>${t('admin.finance.colDriver')}</th>
            <th>${t('admin.finance.colStatus')}</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="5">${t('admin.finance.empty')}</td></tr>`}
        </tbody>
      </table>
    </main>
    <footer>
      <span>${orgName} · ${publicSiteOrigin()}</span>
      <span>${t('admin.finance.reportFooter')}</span>
    </footer>
    <p class="no-print" style="margin-top:16px">
      <button type="button" onclick="window.print()">${t('admin.finance.printReport')}</button>
    </p>
  </div>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 250))</script>
</body>
</html>`

    // Blob URL evita o falso "popup bloqueado" de window.open(..., 'noopener')
    // (com noopener o browser devolve null mesmo com a aba aberta).
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (win) {
      try {
        win.opener = null
      } catch {
        /* ignore cross-context */
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      return
    }

    // Sem popup: baixa o HTML para abrir/imprimir localmente.
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-financeiro-${fromDate}_${toDate}.html`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    setExportNote(t('admin.finance.reportDownloaded'))
  }

  return (
    <section className="admin-finance">
      <div className="admin-finance__filters">
        <div className="admin-finance__presets">
          {([
            ['7d', t('admin.finance.period7d')],
            ['30d', t('admin.finance.period30d')],
            ['90d', t('admin.finance.period90d')],
            ['custom', t('admin.finance.periodCustom')],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={preset === id ? 'is-active' : undefined}
              onClick={() => applyPreset(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="admin-finance__dates">
          <label>
            <span>{t('admin.finance.from')}</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setPreset('custom')
                setFromDate(e.target.value)
              }}
            />
          </label>
          <label>
            <span>{t('admin.finance.to')}</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setPreset('custom')
                setToDate(e.target.value)
              }}
            />
          </label>
          <button
            type="button"
            className="admin-clients__btn is-primary"
            onClick={exportReport}
          >
            {t('admin.finance.exportReport')}
          </button>
        </div>
      </div>

      <div className="admin-finance__kpis">
        <article>
          <span>{t('admin.finance.kpiGross')}</span>
          <strong>{money(totals.gross, locale)}</strong>
        </article>
        <article>
          <span>{t('admin.finance.kpiCommission')}</span>
          <strong>{money(totals.commission, locale)}</strong>
        </article>
        <article>
          <span>{t('admin.finance.kpiDriver')}</span>
          <strong>{money(totals.driver, locale)}</strong>
        </article>
        <article>
          <span>{t('admin.finance.kpiEntries')}</span>
          <strong>{filtered.length}</strong>
        </article>
      </div>

      <div className="admin-finance__charts">
        <div className="admin-finance__chart-card">
          <h3>{t('admin.finance.chartGrossTitle')}</h3>
          <BarChart series={weekly.values} labels={weekly.labels} />
        </div>
        <div className="admin-finance__chart-card">
          <h3>{t('admin.finance.chartSplitTitle')}</h3>
          <DonutChart
            parts={[
              {
                label: t('admin.finance.kpiCommission'),
                value: totals.commission,
                color: '#152033',
              },
              {
                label: t('admin.finance.kpiDriver'),
                value: totals.driver,
                color: '#b08d57',
              },
            ]}
          />
        </div>
      </div>

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
        {!loading && !filtered.length ? (
          <p className="text-sm text-text-secondary-light">{t('admin.finance.empty')}</p>
        ) : null}

        {filtered.length > 0 ? (
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
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td data-label={t('admin.finance.colDate')}>
                      {new Date(e.created_at).toLocaleString(locale)}
                    </td>
                    <td data-label={t('admin.finance.colGross')}>
                      {money(Number(e.gross_amount), locale)}
                    </td>
                    <td data-label={t('admin.finance.colCommission')}>
                      {money(Number(e.commission_amount), locale)} ({e.commission_percent}%)
                    </td>
                    <td data-label={t('admin.finance.colDriver')}>
                      {money(Number(e.driver_amount), locale)}
                    </td>
                    <td data-label={t('admin.finance.colStatus')}>
                      {t(`admin.finance.status.${e.status}`)}
                    </td>
                    <td data-label={t('admin.finance.colActions')}>
                      <div className="admin-finance__actions">
                        {e.status !== 'liquidado' ? (
                          <button
                            type="button"
                            className="admin-clients__btn is-ghost"
                            disabled={busyId === e.id}
                            onClick={() => openSettleModal(e)}
                          >
                            {t('admin.finance.liquidate')}
                          </button>
                        ) : null}
                        {e.status === 'liquidado' && hasProofs(e) ? (
                          <button
                            type="button"
                            className="admin-clients__btn is-ghost"
                            onClick={() => setViewProofsEntry(e)}
                          >
                            {t('admin.finance.viewProofs')}
                          </button>
                        ) : null}
                        {e.status === 'liquidado' && !hasProofs(e) ? '—' : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {settleEntry
        ? createPortal(
            <div className="admin-form-modal" role="presentation">
              <button
                type="button"
                className="admin-form-modal__backdrop"
                aria-label={t('admin.finance.cancelLiquidate')}
                onClick={closeSettleModal}
              />
              <form
                className="admin-form-modal__panel admin-clients__form"
                role="dialog"
                aria-modal="true"
                aria-labelledby="finance-settle-title"
                onSubmit={(ev) => void onConfirmLiquidate(ev)}
              >
                <header className="admin-form-modal__head">
                  <div>
                    <h2 id="finance-settle-title">
                      {t('admin.finance.liquidateModalTitle')}
                    </h2>
                    <p>{t('admin.finance.liquidateModalLead')}</p>
                  </div>
                  <button
                    type="button"
                    className="admin-form-modal__close"
                    onClick={closeSettleModal}
                    disabled={busyId === settleEntry.id}
                  >
                    ×
                  </button>
                </header>

                <div className="admin-finance__settle-summary">
                  <article>
                    <span>{t('admin.finance.colGross')}</span>
                    <strong>
                      {money(Number(settleEntry.gross_amount), locale)}
                    </strong>
                  </article>
                  <article>
                    <span>{t('admin.finance.colCommission')}</span>
                    <strong>
                      {money(Number(settleEntry.commission_amount), locale)}
                    </strong>
                  </article>
                  <article>
                    <span>{t('admin.finance.colDriver')}</span>
                    <strong>
                      {money(Number(settleEntry.driver_amount), locale)}
                    </strong>
                  </article>
                </div>

                <div className="admin-finance__proof-fields">
                  <label className="admin-finance__proof-field">
                    <span>{t('admin.finance.proofClientToPlatform')}</span>
                    <input
                      type="file"
                      accept={PROOF_ACCEPT}
                      required
                      disabled={busyId === settleEntry.id}
                      onChange={(ev) => {
                        setClientProof(ev.target.files?.[0] ?? null)
                        setSettleError(null)
                      }}
                    />
                    <p className="admin-finance__proof-hint">
                      {t('admin.finance.proofHint')}
                    </p>
                    {clientProof ? (
                      <p className="admin-finance__proof-name">
                        {t('admin.finance.selectedFile', {
                          name: clientProof.name,
                        })}
                      </p>
                    ) : null}
                  </label>

                  <label className="admin-finance__proof-field">
                    <span>{t('admin.finance.proofPlatformToDriver')}</span>
                    <input
                      type="file"
                      accept={PROOF_ACCEPT}
                      required
                      disabled={busyId === settleEntry.id}
                      onChange={(ev) => {
                        setDriverProof(ev.target.files?.[0] ?? null)
                        setSettleError(null)
                      }}
                    />
                    <p className="admin-finance__proof-hint">
                      {t('admin.finance.proofHint')}
                    </p>
                    {driverProof ? (
                      <p className="admin-finance__proof-name">
                        {t('admin.finance.selectedFile', {
                          name: driverProof.name,
                        })}
                      </p>
                    ) : null}
                  </label>
                </div>

                {settleError ? (
                  <p className="text-sm" style={{ color: '#8b2e2e' }}>
                    {settleError}
                  </p>
                ) : null}

                <div className="admin-clients__form-actions">
                  <button
                    type="button"
                    className="admin-clients__btn is-ghost"
                    onClick={closeSettleModal}
                    disabled={busyId === settleEntry.id}
                  >
                    {t('admin.finance.cancelLiquidate')}
                  </button>
                  <button
                    type="submit"
                    className="admin-clients__btn is-primary"
                    disabled={
                      busyId === settleEntry.id || !clientProof || !driverProof
                    }
                  >
                    {busyId === settleEntry.id
                      ? '…'
                      : t('admin.finance.confirmLiquidate')}
                  </button>
                </div>
              </form>
            </div>,
            document.body,
          )
        : null}

      {viewProofsEntry
        ? createPortal(
            <div className="admin-form-modal" role="presentation">
              <button
                type="button"
                className="admin-form-modal__backdrop"
                aria-label={t('admin.finance.cancelLiquidate')}
                onClick={() => setViewProofsEntry(null)}
              />
              <div
                className="admin-form-modal__panel admin-clients__form"
                role="dialog"
                aria-modal="true"
                aria-labelledby="finance-proofs-title"
              >
                <header className="admin-form-modal__head">
                  <div>
                    <h2 id="finance-proofs-title">
                      {t('admin.finance.proofsModalTitle')}
                    </h2>
                    <p>
                      {new Date(viewProofsEntry.created_at).toLocaleString(
                        locale,
                      )}{' '}
                      · {money(Number(viewProofsEntry.gross_amount), locale)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="admin-form-modal__close"
                    onClick={() => setViewProofsEntry(null)}
                  >
                    ×
                  </button>
                </header>

                <div className="admin-finance__proof-links">
                  {viewProofsEntry.client_to_platform_proof_url ? (
                    <div>
                      <strong>
                        {t('admin.finance.proofClientToPlatform')}
                      </strong>
                      <p>
                        <a
                          href={viewProofsEntry.client_to_platform_proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t('admin.finance.openProof')}
                        </a>
                      </p>
                    </div>
                  ) : null}
                  {viewProofsEntry.platform_to_driver_proof_url ? (
                    <div>
                      <strong>
                        {t('admin.finance.proofPlatformToDriver')}
                      </strong>
                      <p>
                        <a
                          href={viewProofsEntry.platform_to_driver_proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t('admin.finance.openProof')}
                        </a>
                      </p>
                    </div>
                  ) : null}
                  {!hasProofs(viewProofsEntry) ? (
                    <p>{t('admin.finance.noProofs')}</p>
                  ) : null}
                </div>

                <div className="admin-clients__form-actions">
                  <button
                    type="button"
                    className="admin-clients__btn is-ghost"
                    onClick={() => setViewProofsEntry(null)}
                  >
                    {t('admin.finance.cancelLiquidate')}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}
