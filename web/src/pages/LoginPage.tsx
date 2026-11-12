import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageToggle } from '../components/LanguageToggle'
import { useAuth } from '../context/AuthContext'
import { useTenant } from '../context/TenantContext'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  ensureDriverProfileForSignup,
  getMyDriverProfile,
} from '../services/coreV2'
import { listMyMemberships, canOperate } from '../services/admin'
import { fetchPublicPlatformFlags } from '../services/platform'

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/admin/reservas'
  if (raw === '/login' || raw === '/admin') return '/admin/reservas'
  return raw
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = useMemo(
    () => safeNextPath(searchParams.get('next')),
    [searchParams],
  )
  const { user, loading, signIn, signUp } = useAuth()
  const tenant = useTenant()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [postLoginPath, setPostLoginPath] = useState<string | null>(null)
  const [signupEnabled, setSignupEnabled] = useState(true)
  const [flagsLoaded, setFlagsLoaded] = useState(false)

  const orgId = tenant.organizationId

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const flags = await fetchPublicPlatformFlags()
        if (!cancelled) {
          setSignupEnabled(flags.public_signup_enabled !== false)
        }
      } catch {
        if (!cancelled) setSignupEnabled(true)
      } finally {
        if (!cancelled) setFlagsLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (flagsLoaded && !signupEnabled && mode === 'signup') {
      setMode('login')
    }
  }, [flagsLoaded, signupEnabled, mode])

  async function resolveLandingPath(preferred: string): Promise<string> {
    if (preferred.startsWith('/motorista')) return preferred
    if (!orgId) return preferred
    try {
      const memberships = await listMyMemberships()
      const membership = memberships.find((m) => m.organization_id === orgId)
      if (membership && canOperate(membership.role)) return preferred

      // New accounts from login page become drivers automatically.
      const ensured = await ensureDriverProfileForSignup(orgId)
      if (ensured) return '/motorista'

      const driver = await getMyDriverProfile(orgId)
      if (driver) return '/motorista'
    } catch {
      /* fall through */
    }
    return preferred
  }

  useEffect(() => {
    if (loading || !user || postLoginPath) return

    let cancelled = false
    void resolveLandingPath(next).then((path) => {
      if (!cancelled) setPostLoginPath(path)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolve once per session user
  }, [loading, user, postLoginPath, next, orgId])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    setError(null)

    if (!isSupabaseConfigured) {
      setError(t('auth.supabaseMissing'))
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password)
        const path = await resolveLandingPath(next)
        setPostLoginPath(path)
        navigate(path, { replace: true })
      } else {
        const flags = await fetchPublicPlatformFlags()
        if (flags.public_signup_enabled === false) {
          setSignupEnabled(false)
          setMode('login')
          throw new Error(t('auth.signupDisabled'))
        }
        await signUp(email.trim(), password)
        // If session is available immediately, provision driver profile now.
        if (orgId) {
          try {
            await ensureDriverProfileForSignup(orgId)
          } catch {
            /* may need email confirmation first — created on next login */
          }
        }
        setMessage(t('auth.signupSuccess'))
        setMode('login')
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('auth.genericError'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || (user && !postLoginPath)) {
    return (
      <div className="login-shell">
        <p className="login-status">{t('auth.loading')}</p>
      </div>
    )
  }

  if (user && postLoginPath) {
    return <Navigate to={postLoginPath} replace />
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
              <span className="login-meta">{t('auth.staffAccess')}</span>
            </div>
          </div>

          <h1 className="login-title">
            {mode === 'login' ? t('auth.loginTitle') : t('auth.signupTitle')}
          </h1>
          <p className="login-lead">
            {mode === 'login' ? t('auth.loginLead') : t('auth.signupLead')}
          </p>

          {signupEnabled ? (
            <div
              className="login-modes"
              role="tablist"
              aria-label={t('auth.modeLabel')}
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={mode === 'login' ? 'is-active' : undefined}
                onClick={() => {
                  setMode('login')
                  setError(null)
                  setMessage(null)
                }}
              >
                {t('auth.login')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                className={mode === 'signup' ? 'is-active' : undefined}
                onClick={() => {
                  setMode('signup')
                  setError(null)
                  setMessage(null)
                }}
              >
                {t('auth.signup')}
              </button>
            </div>
          ) : null}

          <form className="login-form" onSubmit={onSubmit} noValidate>
            <div className="login-row">
              <label htmlFor="login-email">{t('auth.email')}</label>
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
              />
            </div>
            <div className="login-row">
              <label htmlFor="login-password">{t('auth.password')}</label>
              <input
                id="login-password"
                type="password"
                name="password"
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
              />
            </div>

            <div className="login-actions">
              <button
                className="btn-primary"
                type="submit"
                disabled={submitting}
              >
                {submitting
                  ? t('auth.submitting')
                  : mode === 'login'
                    ? t('auth.login')
                    : t('auth.signup')}
              </button>
              <Link className="btn-ghost" to="/">
                {t('auth.backToSite')}
              </Link>
            </div>
          </form>

          {(error || message) && (
            <p
              className={`login-feedback${error ? ' is-error' : ' is-ok'}`}
              role="status"
              aria-live="polite"
            >
              {error ?? message}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
