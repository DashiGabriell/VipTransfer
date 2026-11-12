import { useEffect } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageToggle } from '../components/LanguageToggle'
import { useTenant } from '../context/TenantContext'

type LegalDoc = 'termos' | 'privacidade'

const DOCS: LegalDoc[] = ['termos', 'privacidade']

function isLegalDoc(value: string): value is LegalDoc {
  return value === 'termos' || value === 'privacidade'
}

export function LegalPage() {
  const { pathname } = useLocation()
  const docRaw = pathname.replace(/^\//, '').split('/')[0] ?? ''
  const doc = isLegalDoc(docRaw) ? docRaw : null
  const { t } = useTranslation()
  const tenant = useTenant()
  const title = doc ? t(`legal.${doc}.title`) : ''

  useEffect(() => {
    if (!doc || !title) return
    const prev = document.title
    document.title = `${title} — ${tenant.name || 'JMD Transfer'}`
    return () => {
      document.title = prev
    }
  }, [doc, title, tenant.name])

  if (!doc) {
    return <Navigate to="/" replace />
  }

  const sectionCount = doc === 'termos' ? 8 : 7
  const sections = Array.from({ length: sectionCount }, (_, i) => i + 1)
  const updated = t(`legal.${doc}.updated`)

  return (
    <div className="legal-page">
      <header className="legal-page__top">
        <Link to="/" className="legal-page__brand">
          {tenant.name || t('landing.brand')}
        </Link>
        <div className="legal-page__top-actions">
          <LanguageToggle />
          <Link to="/" className="legal-page__back">
            {t('legal.backHome')}
          </Link>
        </div>
      </header>

      <main className="legal-page__main">
        <p className="legal-page__kicker">{t('legal.kicker')}</p>
        <h1>{title}</h1>
        <p className="legal-page__updated">
          {t('legal.updatedLabel')}: {updated}
        </p>
        <p className="legal-page__lead">{t(`legal.${doc}.lead`)}</p>

        <div className="legal-page__body">
          {sections.map((n) => (
            <section key={`${doc}-${n}`}>
              <h2>{t(`legal.${doc}.s${n}Title`)}</h2>
              <p>{t(`legal.${doc}.s${n}Body`)}</p>
            </section>
          ))}
        </div>

        <p className="legal-page__contact">
          {t('legal.contactLead')}{' '}
          <a href={`mailto:${tenant.contactEmail || 'contato@jmdtransfer.com.br'}`}>
            {tenant.contactEmail || 'contato@jmdtransfer.com.br'}
          </a>
        </p>

        <nav className="legal-page__switch" aria-label={t('legal.navLabel')}>
          {DOCS.map((item) => (
            <Link
              key={item}
              to={`/${item}`}
              className={item === doc ? 'is-active' : undefined}
            >
              {t(`legal.${item}.title`)}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  )
}
