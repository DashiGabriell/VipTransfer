import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { InstallAppButton } from '../components/InstallAppButton'
import { LanguageToggle } from '../components/LanguageToggle'
import { ReservationForm } from '../components/ReservationForm'
import { useTenant } from '../context/TenantContext'

const SUV_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDrKGgjZHah1JBC78jwkS7p2FbsNNb962egrS7p5EOpJmfSOI-CERaeSDnAI9Pk7WQ137r9CVqfANyogx3sFmwmUWILJxYoMcV1G0gg0P_bAAAYKfEjydPorDCG6XllFTxuMlp6q3DBqsyWbUrnCifV99T1A8132qKv-dq1vUElw1GqQk8DkFGLbpSI3ZqyacK3Uay0c8WkodpQ9sf3mleXyxk6UkWMu2A5Q_Lx1FdvUbyRKO8z0j09RPlbkCssD-qudPkopceJx7YK'
const SEDAN_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCsWDS3QL7XeJOe7fxRn2tQRWPOjiBrOfaGoNKZKCkHTBk8_U-9hv7PIsK55WzuDXGtVaIF5laoWGQ392NB7fOUsAdQ8lrhhHHTLAQs54XylAhnkBAS9RUdIU4sLj3XduboMvNdQidGC0vLY9Ko76Gglkj2hp8SwPOhQGGwqy_lB40yhW58y7Bm_ykLZBLviNZvRj3JOMwsXW9pVnUfk0VzvwfDQuJ45A3rWKP2jHbp7dqtP2LarUArByS0N--tbL5cMnLOE9SNzAL-'

export function LandingPage() {
  const { t } = useTranslation()
  const tenant = useTenant()
  const wa = tenant.whatsapp.replace(/\D/g, '') || '5511999999999'
  const [navSolid, setNavSolid] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-reveal]'),
    )
    if (!nodes.length) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      nodes.forEach((el) => el.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )

    nodes.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  function scrollToQuote() {
    document.getElementById('cotacao')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
    setDrawerOpen(false)
  }

  return (
    <>
      <a className="skip" href="#cotacao">
        {t('landing.skip')}
      </a>

      <header
        className={`site-nav${navSolid ? ' is-solid' : ''}`}
        id="siteNav"
      >
        <a className="nav-brand" href="#inicio">
          <img
            className="nav-brand__logo"
            src="/logo-1.png"
            alt={t('landing.brand')}
            width={160}
            height={48}
          />
        </a>
        <nav aria-label="Principal">
          <ul className="nav-links">
            <li>
              <a href="#servicos">{t('nav.services')}</a>
            </li>
            <li>
              <a href="#frota">{t('nav.fleet')}</a>
            </li>
            <li>
              <a href="#atuacao">{t('nav.coverage')}</a>
            </li>
            <li>
              <a href="#contato">{t('nav.contact')}</a>
            </li>
            <li>
              <Link to="/login">{t('nav.admin')}</Link>
            </li>
          </ul>
        </nav>
        <div className="nav-actions">
          <LanguageToggle />
          <InstallAppButton className="nav-install" variant="landing" />
          <button className="nav-cta" type="button" onClick={scrollToQuote}>
            {t('landing.ctaTransfer')}
          </button>
          <button
            className="nav-toggle"
            type="button"
            aria-expanded={drawerOpen}
            aria-controls="navDrawer"
            aria-label={drawerOpen ? t('admin.closeMenu') : t('admin.openMenu')}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            <span className="nav-toggle-bars" aria-hidden="true" />
          </button>
        </div>
      </header>

      <nav
        className={`nav-drawer${drawerOpen ? ' is-open' : ''}`}
        id="navDrawer"
        hidden={!drawerOpen}
        aria-label="Menu mobile"
      >
        <a href="#servicos" onClick={() => setDrawerOpen(false)}>
          {t('nav.services')}
        </a>
        <a href="#frota" onClick={() => setDrawerOpen(false)}>
          {t('nav.fleet')}
        </a>
        <a href="#atuacao" onClick={() => setDrawerOpen(false)}>
          {t('nav.coverage')}
        </a>
        <a href="#contato" onClick={() => setDrawerOpen(false)}>
          {t('nav.contact')}
        </a>
        <a
          href="#cotacao"
          onClick={(e) => {
            e.preventDefault()
            scrollToQuote()
          }}
        >
          {t('landing.ctaQuote')}
        </a>
        <Link to="/login" onClick={() => setDrawerOpen(false)}>
          {t('nav.admin')}
        </Link>
        <InstallAppButton
          className="nav-drawer__install"
          variant="landing"
        />
        <div className="nav-drawer__lang">
          <LanguageToggle />
        </div>
      </nav>

      <main>
        <section className="hero" id="inicio">
          <div className="hero-glow" aria-hidden="true" />
          <div className="folio" id="folio">
            <aside className="folio-spine" aria-hidden="true">
              {t('landing.brand')}
            </aside>
            <div className="folio-page">
              <div className="folio-top">
                <div className="folio-mark">
                  <img
                    className="folio-mark__logo"
                    src="/logo-1.png"
                    alt={t('landing.brand')}
                    width={180}
                    height={54}
                  />
                </div>
                <div className="folio-meta">{t('landing.meta')}</div>
              </div>
              <h1 className="folio-title">{t('landing.title')}</h1>
              <p className="folio-lead">{t('landing.lead')}</p>
              <InstallAppButton
                className="folio-install"
                variant="landing"
              />
              <div className="route-trace" aria-hidden="true">
                <span />
              </div>
              <ReservationForm />
            </div>
          </div>
        </section>

        <section className="section section-paper" id="servicos" data-reveal>
          <div className="section-inner">
            <div className="section-head">
              <h2>{t('landing.servicesTitle')}</h2>
              <p>{t('landing.servicesLead')}</p>
            </div>
            <div className="schedule">
              <article className="schedule-item">
                <div className="schedule-code">{t('landing.svcAirportCode')}</div>
                <div className="schedule-copy">
                  <h3>{t('landing.svcAirportTitle')}</h3>
                  <p>{t('landing.svcAirportBody')}</p>
                </div>
                <div className="schedule-media">
                  <img
                    src="https://i.postimg.cc/Dfxn3zGW/avi-o-comercial-estacionado-no-p-tio-ou-taxiando-(1).jpg"
                    alt=""
                    width={800}
                    height={500}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </article>
              <article className="schedule-item">
                <div className="schedule-code">{t('landing.svcCorpCode')}</div>
                <div className="schedule-copy">
                  <h3>{t('landing.svcCorpTitle')}</h3>
                  <p>{t('landing.svcCorpBody')}</p>
                </div>
                <div className="schedule-media">
                  <img
                    src="https://i.postimg.cc/9MtTQ92F/image1.jpg"
                    alt=""
                    width={800}
                    height={500}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </article>
              <article className="schedule-item">
                <div className="schedule-code">{t('landing.svcVipCode')}</div>
                <div className="schedule-copy">
                  <h3>{t('landing.svcVipTitle')}</h3>
                  <p>{t('landing.svcVipBody')}</p>
                </div>
                <div className="schedule-media">
                  <img
                    src="https://i.postimg.cc/C1z1WfKX/altere-o-modelo-do-carro-para-que.jpg"
                    alt=""
                    width={800}
                    height={500}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="section section-ink" id="frota" data-reveal>
          <div className="section-inner">
            <div className="section-head">
              <h2>{t('landing.fleetTitle')}</h2>
              <p>{t('landing.fleetLead')}</p>
            </div>
            <div className="fleet-grid">
              <article className="fleet-sheet">
                <div>
                  <h3>{t('landing.suvTitle')}</h3>
                  <p className="spec">{t('landing.suvSpec')}</p>
                </div>
                <div className="visual">
                  <img
                    src={SUV_IMG}
                    alt=""
                    width={640}
                    height={360}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="fleet-foot">
                  <span>{t('landing.suvFoot')}</span>
                  <strong>{t('landing.consult')}</strong>
                </div>
              </article>
              <article className="fleet-sheet">
                <div>
                  <h3>{t('landing.sedanTitle')}</h3>
                  <p className="spec">{t('landing.sedanSpec')}</p>
                </div>
                <div className="visual">
                  <img
                    src={SEDAN_IMG}
                    alt=""
                    width={640}
                    height={360}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="fleet-foot">
                  <span>{t('landing.sedanFoot')}</span>
                  <strong>{t('landing.consult')}</strong>
                </div>
              </article>
            </div>
            <div className="cta-band">
              <p>{t('landing.fleetCta')}</p>
              <button className="btn-primary" type="button" onClick={scrollToQuote}>
                {t('landing.ctaFleet')}
              </button>
            </div>
          </div>
        </section>

        <section className="section section-paper" id="atuacao" data-reveal>
          <div className="section-inner">
            <div className="section-head">
              <h2>{t('landing.coverageTitle')}</h2>
              <p>{t('landing.coverageLead')}</p>
            </div>
            <div className="coverage">
              <div className="coverage-cell">
                <img
                  src="https://i.postimg.cc/VkZBMn2S/SPEGRANDESP.jpg"
                  alt=""
                  width={480}
                  height={640}
                  loading="lazy"
                  decoding="async"
                />
                <span>SP e Grande SP</span>
              </div>
              <div className="coverage-cell">
                <img
                  src="https://i.postimg.cc/HnLkQcqk/GRU.jpg"
                  alt=""
                  width={480}
                  height={640}
                  loading="lazy"
                  decoding="async"
                />
                <span>Aeroporto GRU</span>
              </div>
              <div className="coverage-cell">
                <img
                  src="https://i.postimg.cc/VsHYx6yC/CGH.jpg"
                  alt=""
                  width={480}
                  height={640}
                  loading="lazy"
                  decoding="async"
                />
                <span>Aeroporto CGH</span>
              </div>
              <div className="coverage-cell">
                <img
                  src="https://i.postimg.cc/vZyHzKwF/VCP.jpg"
                  alt=""
                  width={480}
                  height={640}
                  loading="lazy"
                  decoding="async"
                />
                <span>Aeroporto VCP</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="contato" data-reveal>
        <div className="section-inner">
          <div className="footer-grid">
            <div>
              <div className="footer-brand">{tenant.name}</div>
              <p>{t('landing.footerLead')}</p>
              <p style={{ marginTop: '1rem' }}>
                <a href={`mailto:${tenant.contactEmail || 'contato@jmdtransfer.com.br'}`}>
                  {tenant.contactEmail || 'contato@jmdtransfer.com.br'}
                </a>
                <br />
                {t('landing.footerWhatsapp')}
              </p>
            </div>
            <div>
              <h3>{t('landing.footerServices')}</h3>
              <ul>
                <li>
                  <a href="#servicos">{t('landing.svcAirportTitle')}</a>
                </li>
                <li>
                  <a href="#servicos">{t('landing.svcCorpTitle')}</a>
                </li>
                <li>
                  <a href="#servicos">{t('landing.svcVipTitle')}</a>
                </li>
                <li>
                  <a href="#frota">{t('nav.fleet')}</a>
                </li>
              </ul>
            </div>
            <div>
              <h3>{t('landing.footerContact')}</h3>
              <p style={{ margin: '0 0 1rem' }}>
                {t('landing.footerContactLead')}
              </p>
              <a
                className="btn-primary"
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block' }}
              >
                {t('landing.footerTalk')}
              </a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>
              © {new Date().getFullYear()} {tenant.name}. {t('landing.footerCopy')}
            </span>
            <span>
              <Link to="/login">{t('nav.admin')}</Link>
            </span>
          </div>
        </div>
      </footer>

      <a
        className="wa-fab"
        href={`https://wa.me/${wa}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.52 3.48A11.79 11.79 0 0 0 12 0C5.373 0 0 5.373 0 12c0 2.116.553 4.167 1.603 5.99L0 24l6.265-1.638A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12 0-3.21-1.25-6.22-3.48-8.52zM12 21.5a9.46 9.46 0 0 1-4.82-1.31l-.35-.21-3.72.97.99-3.63-.23-.37A9.45 9.45 0 1 1 12 21.5zm5.5-7.08c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z" />
        </svg>
      </a>

      <div className="mobile-dock" role="navigation" aria-label="Ações rápidas">
        <button
          type="button"
          className="mobile-dock__cta"
          onClick={scrollToQuote}
        >
          {t('landing.ctaTransfer')}
        </button>
        <a
          className="mobile-dock__wa"
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.52 3.48A11.79 11.79 0 0 0 12 0C5.373 0 0 5.373 0 12c0 2.116.553 4.167 1.603 5.99L0 24l6.265-1.638A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12 0-3.21-1.25-6.22-3.48-8.52zM12 21.5a9.46 9.46 0 0 1-4.82-1.31l-.35-.21-3.72.97.99-3.63-.23-.37A9.45 9.45 0 1 1 12 21.5zm5.5-7.08c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z" />
          </svg>
        </a>
      </div>
    </>
  )
}
