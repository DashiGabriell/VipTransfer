import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  listPlatformAudit,
  type AuditLogRow,
} from '../../services/platform'

function toCsv(rows: AuditLogRow[]): string {
  const header = [
    'id',
    'created_at',
    'organization_id',
    'actor_id',
    'impersonator_id',
    'action',
    'entity_type',
    'entity_id',
  ]
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.created_at,
        row.organization_id ?? '',
        row.actor_id ?? '',
        row.impersonator_id ?? '',
        JSON.stringify(row.action),
        JSON.stringify(row.entity_type),
        row.entity_id ?? '',
      ].join(','),
    )
  }
  return lines.join('\n')
}

export function PlatformAuditPage() {
  const { t, i18n } = useTranslation()
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<AuditLogRow | null>(null)

  async function load(e?: FormEvent) {
    e?.preventDefault()
    setError(null)
    try {
      const data = await listPlatformAudit({
        action: action.trim() || null,
        entityType: entityType.trim() || null,
        limit: 200,
      })
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('platform.loadError'))
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const locale = i18n.language.startsWith('en') ? 'en-US' : 'pt-BR'

  function downloadCsv() {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `platform-audit-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="platform-page">
      <section className="platform-section">
        <h2>{t('platform.auditTitle')}</h2>
        <p className="platform-lead">{t('platform.auditLead')}</p>
        {error ? <p className="platform-error">{error}</p> : null}

        <form className="platform-form platform-form--inline" onSubmit={load}>
          <label>
            Action
            <input value={action} onChange={(e) => setAction(e.target.value)} />
          </label>
          <label>
            Entity
            <input
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            />
          </label>
          <button type="submit" className="admin-clients__btn is-primary">
            {t('platform.filter')}
          </button>
          <button
            type="button"
            className="admin-clients__btn"
            onClick={downloadCsv}
            disabled={rows.length === 0}
          >
            CSV
          </button>
        </form>
      </section>

      <section className="platform-section">
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>{t('platform.createdAt')}</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor</th>
                <th>Impersonator</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="platform-table__click"
                  onClick={() => setSelected(row)}
                >
                  <td>{new Date(row.created_at).toLocaleString(locale)}</td>
                  <td>
                    <code>{row.action}</code>
                  </td>
                  <td>
                    {row.entity_type}
                    {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}` : ''}
                  </td>
                  <td>
                    <code>{row.actor_id?.slice(0, 8) ?? '—'}</code>
                  </td>
                  <td>
                    <code>{row.impersonator_id?.slice(0, 8) ?? '—'}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <section className="platform-section">
          <div className="platform-section__head">
            <h2>{t('platform.auditDetail')}</h2>
            <button
              type="button"
              className="platform-link-btn"
              onClick={() => setSelected(null)}
            >
              {t('platform.close')}
            </button>
          </div>
          <pre className="platform-json">
            {JSON.stringify(
              {
                before: selected.before_data,
                after: selected.after_data,
              },
              null,
              2,
            )}
          </pre>
        </section>
      ) : null}
    </div>
  )
}
