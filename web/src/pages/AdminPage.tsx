import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { AdminDashboard } from './admin/AdminDashboard'

export function AdminPage() {
  const { t } = useTranslation()
  const { user, loading, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-text-secondary-light">
        Carregando sessão…
      </div>
    )
  }

  if (user) {
    return <AdminDashboard />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)

    if (!isSupabaseConfigured) {
      setMessage('Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        await signUp(email, password)
        setMessage(
          'Conta criada. Se o projeto exigir confirmação de e-mail, verifique a caixa de entrada; depois faça login e reivindique o owner.',
        )
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha na autenticação')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background-light px-6">
      <div className="w-full max-w-md rounded-3xl bg-surface-light p-8 shadow-xl">
        <Link to="/" className="text-sm text-primary hover:underline">
          ← Site
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-primary">
          {t('admin.title')}
        </h1>
        <p className="mt-2 text-sm text-text-secondary-light">
          Login staff · reservas, frota e frete
        </p>

        <div className="mt-6 flex gap-2 text-sm">
          <button
            type="button"
            className={mode === 'login' ? 'font-semibold text-primary' : ''}
            onClick={() => setMode('login')}
          >
            Entrar
          </button>
          <span className="text-border-light">|</span>
          <button
            type="button"
            className={mode === 'signup' ? 'font-semibold text-primary' : ''}
            onClick={() => setMode('signup')}
          >
            Criar conta
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="text-text-secondary-light">{t('admin.email')}</span>
            <input
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-border-light px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary-light">{t('admin.password')}</span>
            <input
              type="password"
              required
              minLength={6}
              className="mt-1 w-full rounded-lg border border-border-light px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary py-3 font-medium text-text-primary-dark hover:bg-primary-dark disabled:opacity-60"
          >
            {mode === 'login' ? t('admin.login') : 'Criar conta'}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm text-text-secondary-light">{message}</p>
        )}
      </div>
    </div>
  )
}
