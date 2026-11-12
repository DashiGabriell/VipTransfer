import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  listPlatformOrganizations,
  upsertPlatformOrganization,
  type PlatformOrgListItem,
} from '../../services/platform'

export function PlatformOrgsPage() {
  const { t, i18n } = useTranslation()
  const [rows, setRows] = useState<PlatformOrgListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const data = await listPlatformOrganizations()
    setRows(data)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await refresh()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('platform.loadError'))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await upsertPlatformOrganization({
        slug,
        name,
        settings: {
          whatsapp: whatsapp.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
        },
      })
      setSlug('')
      setName('')
      setWhatsapp('')
      setContactEmail('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('platform.saveError'))
    } finally {
      setBusy(false)
    }
  }

  const locale = i18n.language.startsWith('en') ? 'en-US' : 'pt-BR'

  return (
    <div className="platform-page">
      <section className="platform-section">
        <h2>{t('platform.orgsTitle')}</h2>
        <p className="platform-lead">{t('platform.orgsLead')}</p>
        {error ? <p className="platform-error">{error}</p> : null}

        <form className="platform-form" onSubmit={onCreate}>
          <label>
            {t('platform.orgSlug')}
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              placeholder="nova-org"
            />
          </label>
          <label>
            {t('platform.orgName')}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            WhatsApp
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="5511..."
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </label>
          <button type="submit" className="admin-clients__btn is-primary" disabled={busy}>
            {busy ? t('platform.saving') : t('platform.createOrg')}
          </button>
        </form>
      </section>

      <section className="platform-section">
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>{t('platform.orgName')}</th>
                <th>Slug</th>
                <th>{t('platform.orgStatus')}</th>
                <th>{t('platform.members')}</th>
                <th>{t('platform.reservations30d')}</th>
                <th>{t('platform.createdAt')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/dashitecnology/orgs/${row.id}`}>{row.name}</Link>
                  </td>
                  <td>
                    <code>{row.slug}</code>
                  </td>
                  <td>
                    <span className={`platform-status is-${row.status}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>{row.member_count}</td>
                  <td>{row.reservations_30d}</td>
                  <td>{new Date(row.created_at).toLocaleDateString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
