import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageToggle } from '../components/LanguageToggle'
import { useAuth } from '../context/AuthContext'
import { useTenant } from '../context/TenantContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { acceptMyDriverInvite } from '../services/coreV2'

export function AcceptInvitePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, loading, signOut } = useAuth()
  const tenant = useTenant()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (loading) return
    // Aguarda o client processar hash do convite/recovery.
    const timer = window.setTimeout(() => setReady(true), 400)
    return () => window.clearTimeout(timer)
  }, [loading])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!isSupabaseConfigured || !supabase) {
      setError(t('auth.supabaseMissing'))
      return
    }
    if (!user) {
      setError(t('auth.inviteNeedLink'))
      return
    }
    if (password.length < 6) {
      setError(t('auth.passwordTooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'))
      return
    }

    setSubmitting(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })
      if (updateError) throw updateError

      if (tenant.organizationId) {
        await acceptMyDriverInvite(tenant.organizationId)
      }

      setMessage(t('auth.inviteSuccess'))
      navigate('/motorista', { replace: true })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('auth.genericError'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !ready) {
    return (
      <div className="login-shell">
        <p className="login-status">{t('auth.loading')}</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="login-shell">
        <div className="login-glow" aria-hidden="true" />
        <div className="login-folio">
          <div className="login-page">
            <h1 className="login-title">{t('auth.inviteTitle')}</h1>
            <p className="login-lead">{t('auth.inviteNeedLink')}</p>
            <div className="login-actions">
              <Link className="btn-primary" to="/login">
                {t('auth.login')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-shell">
      <div className="login-glow" aria-hidden="true" />
      <div className="login-folio">
        <aside className="login-spine" aria-hidden="true">
          JMD Transfer
        </aside>
        <div className="login-page">
          <div className="login-top">
            <Link to="/" className="login-mark">
              <img
                className="login-mark__logo"
                src="/logo-1.png"
                alt="JMD Transfer"
                width={160}
                height={48}
              />
            </Link>
            <div className="login-top__aside">
              <LanguageToggle variant="admin" />
            </div>
          </div>

          <h1 className="login-title">{t('auth.inviteTitle')}</h1>
          <p className="login-lead">{t('auth.inviteLead')}</p>
          <p className="login-meta">{user.email}</p>

          <form className="login-form" onSubmit={onSubmit} noValidate>
            <div className="login-row">
              <label htmlFor="invite-password">{t('auth.newPassword')}</label>
              <input
                id="invite-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="login-row">
              <label htmlFor="invite-confirm">{t('auth.confirmPassword')}</label>
              <input
                id="invite-confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <div className="login-actions">
              <button
                className="btn-primary"
                type="submit"
                disabled={submitting}
              >
                {submitting ? t('auth.submitting') : t('auth.inviteSubmit')}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => void signOut().then(() => navigate('/login'))}
              >
                {t('auth.signOut')}
              </button>
            </div>
          </form>

          {(error || message) && (
            <p
              className={`login-feedback${error ? ' is-error' : ' is-ok'}`}
              role="status"
            >
              {error ?? message}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
