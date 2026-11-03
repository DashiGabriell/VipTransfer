import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageToggle } from '../components/LanguageToggle'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

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
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="login-shell">
        <p className="login-status">{t('auth.loading')}</p>
      </div>
    )
  }

  if (user) {
    return <Navigate to={next} replace />
  }

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
        navigate(next, { replace: true })
      } else {
        await signUp(email.trim(), password)
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

          <div className="login-modes" role="tablist" aria-label={t('auth.modeLabel')}>
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
