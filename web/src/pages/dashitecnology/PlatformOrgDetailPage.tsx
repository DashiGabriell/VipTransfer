import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useImpersonation } from '../../context/ImpersonationContext'
import type { OrgRole } from '../../types/database'
import {
  getPlatformOrganization,
  setPlatformMembership,
  settingsRecord,
  startImpersonation,
  upsertPlatformOrganization,
  type PlatformOrgDetail,
} from '../../services/platform'

const ORG_ROLES: OrgRole[] = ['owner', 'admin', 'operador', 'leitura']

export function PlatformOrgDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refresh: refreshImpersonation } = useImpersonation()
  const [detail, setDetail] = useState<PlatformOrgDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [status, setStatus] = useState<'active' | 'paused'>('active')
  const [whatsapp, setWhatsapp] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [commission, setCommission] = useState('')

  const [memberEmail, setMemberEmail] = useState('')
  const [memberRole, setMemberRole] = useState<OrgRole>('operador')

  const [impersonateUserId, setImpersonateUserId] = useState('')
  const [impersonateReason, setImpersonateReason] = useState('')
  const [impersonateMinutes, setImpersonateMinutes] = useState(60)

  async function refresh() {
    if (!id) return
    const data = await getPlatformOrganization(id)
    setDetail(data)
    const org = data.organization
    setName(org.name)
    setSlug(org.slug)
    setStatus(org.status)
    const settings = settingsRecord(org.settings)
    setWhatsapp(typeof settings.whatsapp === 'string' ? settings.whatsapp : '')
    setContactEmail(
      typeof settings.contactEmail === 'string' ? settings.contactEmail : '',
    )
    setCommission(
      settings.platform_commission_percent != null
        ? String(settings.platform_commission_percent)
        : '',
    )
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, t])

  async function onSaveOrg(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setBusy(true)
    setError(null)
    try {
      const settings = {
        ...settingsRecord(detail?.organization.settings ?? {}),
        whatsapp: whatsapp.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        platform_commission_percent: commission.trim()
          ? Number(commission)
          : undefined,
      }
      await upsertPlatformOrganization({
        id,
        name,
        slug,
        status,
        settings,
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('platform.saveError'))
    } finally {
      setBusy(false)
    }
  }

  async function onAddMember(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setBusy(true)
    setError(null)
    try {
      await setPlatformMembership({
        organizationId: id,
        email: memberEmail,
        role: memberRole,
      })
      setMemberEmail('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('platform.saveError'))
    } finally {
      setBusy(false)
    }
  }

  async function onRemoveMember(userId: string) {
    if (!id) return
    if (!window.confirm(t('platform.confirmRemoveMember'))) return
    setBusy(true)
    try {
      await setPlatformMembership({
        organizationId: id,
        userId,
        remove: true,
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('platform.saveError'))
    } finally {
      setBusy(false)
    }
  }

  async function onStartImpersonation(e: FormEvent) {
    e.preventDefault()
    if (!id || !impersonateUserId) return
    setBusy(true)
    setError(null)
    try {
      await startImpersonation({
        organizationId: id,
        targetUserId: impersonateUserId,
        reason: impersonateReason,
        durationMinutes: impersonateMinutes,
      })
      await refreshImpersonation()
      navigate('/admin/reservas')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('platform.saveError'))
    } finally {
      setBusy(false)
    }
  }

  if (error && !detail) {
    return <p className="platform-error">{error}</p>
  }

  if (!detail) {
    return <p className="platform-muted">{t('platform.loading')}</p>
  }

  const operableMembers = detail.members.filter((m) =>
    ['owner', 'admin', 'operador'].includes(m.role),
  )

  return (
    <div className="platform-page">
      <p>
        <Link to="/dashitecnology/orgs">{t('platform.backToOrgs')}</Link>
      </p>
      {error ? <p className="platform-error">{error}</p> : null}

      <section className="platform-section">
        <h2>{detail.organization.name}</h2>
        <form className="platform-form" onSubmit={onSaveOrg}>
          <label>
            {t('platform.orgName')}
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Slug
            <input value={slug} onChange={(e) => setSlug(e.target.value)} required />
          </label>
          <label>
            {t('platform.orgStatus')}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'paused')}
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
            </select>
          </label>
          <label>
            WhatsApp
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </label>
          <label>
            {t('platform.commission')}
            <input
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <button type="submit" className="admin-clients__btn is-primary" disabled={busy}>
            {busy ? t('platform.saving') : t('platform.saveOrg')}
          </button>
        </form>
      </section>

      <section className="platform-section">
        <h2>{t('platform.members')}</h2>
        <ul className="platform-list">
          {detail.members.map((m) => (
            <li key={m.id}>
              {m.full_name || m.email || m.user_id} · {m.role} · {m.email}
              <button
                type="button"
                className="platform-link-btn"
                onClick={() => void onRemoveMember(m.user_id)}
              >
                {t('platform.remove')}
              </button>
            </li>
          ))}
        </ul>
        <form className="platform-form" onSubmit={onAddMember}>
          <label>
            E-mail
            <input
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Role
            <select
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value as OrgRole)}
            >
              {ORG_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="admin-clients__btn is-primary" disabled={busy}>
            {t('platform.addMember')}
          </button>
        </form>
      </section>

      <section className="platform-section">
        <h2>{t('platform.impersonateTitle')}</h2>
        <p className="platform-lead">{t('platform.impersonateLead')}</p>
        <form className="platform-form" onSubmit={onStartImpersonation}>
          <label>
            {t('platform.impersonateTarget')}
            <select
              value={impersonateUserId}
              onChange={(e) => setImpersonateUserId(e.target.value)}
              required
            >
              <option value="">{t('platform.selectMember')}</option>
              {operableMembers.map((m) => (
                <option key={m.id} value={m.user_id}>
                  {(m.full_name || m.email || m.user_id) + ` (${m.role})`}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('platform.impersonateReason')}
            <input
              value={impersonateReason}
              onChange={(e) => setImpersonateReason(e.target.value)}
              required
              minLength={3}
            />
          </label>
          <label>
            {t('platform.impersonateDuration')}
            <select
              value={impersonateMinutes}
              onChange={(e) => setImpersonateMinutes(Number(e.target.value))}
            >
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={120}>120</option>
            </select>
          </label>
          <button type="submit" className="admin-clients__btn is-primary" disabled={busy}>
            {t('platform.startImpersonation')}
          </button>
        </form>
      </section>
    </div>
  )
}
