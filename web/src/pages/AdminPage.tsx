import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function AdminPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)

    if (!isSupabaseConfigured || !supabase) {
      setMessage(
        'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em web/.env',
      )
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Sessão iniciada. Painel operacional (leads/agenda/frete) na próxima entrega.')
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
          {t('admin.placeholder')}
        </p>

        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
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
              className="mt-1 w-full rounded-lg border border-border-light px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-3 font-medium text-text-primary-dark hover:bg-primary-dark disabled:opacity-60"
          >
            {t('admin.login')}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm text-text-secondary-light">{message}</p>
        )}
      </div>
    </div>
  )
}
