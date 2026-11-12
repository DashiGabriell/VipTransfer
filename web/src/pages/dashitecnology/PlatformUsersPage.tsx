import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router-dom'
import type { PlatformRole } from '../../types/database'
import {
  searchPlatformUsers,
  setPlatformRole,
  type PlatformUserRow,
} from '../../services/platform'
import type { PlatformOutletContext } from './PlatformPage'

export function PlatformUsersPage() {
  const { t } = useTranslation()
  const { role: myRole } = useOutletContext<PlatformOutletContext>()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<PlatformUserRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSearch(e?: FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const data = await searchPlatformUsers(query)
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('platform.loadError'))
    } finally {
      setBusy(false)
    }
  }

  async function onSetRole(userId: string, role: PlatformRole | null) {
    if (myRole !== 'platform_owner') {
      setError(t('platform.onlyOwnerCanPromote'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (role) {
        await setPlatformRole({ userId, role })
      } else {
        await setPlatformRole({ userId, remove: true })
      }
      await onSearch()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('platform.saveError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="platform-page">
      <section className="platform-section">
        <h2>{t('platform.usersTitle')}</h2>
        <p className="platform-lead">{t('platform.usersLead')}</p>
        {error ? <p className="platform-error">{error}</p> : null}

        <form className="platform-form platform-form--inline" onSubmit={onSearch}>
          <label>
            {t('platform.searchUsers')}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="email@..."
            />
          </label>
          <button type="submit" className="admin-clients__btn is-primary" disabled={busy}>
            {t('platform.search')}
          </button>
        </form>
      </section>

      <section className="platform-section">
        <ul className="platform-list">
          {rows.map((row) => (
            <li key={row.id} className="platform-user-row">
              <div>
                <strong>{row.full_name || row.email || row.id}</strong>
                <div className="platform-muted">{row.email}</div>
                <div className="platform-muted">
                  {t('platform.platformRole')}: {row.platform_role ?? '—'}
                </div>
                <div className="platform-muted">
                  {row.memberships
                    .map((m) => `${m.org_slug}:${m.role}`)
                    .join(' · ') || t('platform.noMemberships')}
                </div>
              </div>
              {myRole === 'platform_owner' ? (
                <div className="platform-user-actions">
                  <button
                    type="button"
                    className="admin-clients__btn"
                    disabled={busy}
                    onClick={() => void onSetRole(row.id, 'dev')}
                  >
                    dev
                  </button>
                  <button
                    type="button"
                    className="admin-clients__btn"
                    disabled={busy}
                    onClick={() => void onSetRole(row.id, 'platform_owner')}
                  >
                    platform_owner
                  </button>
                  {row.platform_role ? (
                    <button
                      type="button"
                      className="admin-clients__btn"
                      disabled={busy}
                      onClick={() => void onSetRole(row.id, null)}
                    >
                      {t('platform.remove')}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
