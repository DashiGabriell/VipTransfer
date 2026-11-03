import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LanguageToggle } from '../components/LanguageToggle'
import { ReservationForm } from '../components/ReservationForm'
import { useTenant } from '../context/TenantContext'

export function LandingPage() {
  const { t } = useTranslation()
  const tenant = useTenant()

  return (
    <div className="bg-background-light text-text-primary-light">
      <nav className="absolute top-0 z-50 flex w-full items-center justify-between bg-background-light/90 p-6 backdrop-blur-sm md:px-12">
        <div className="flex flex-col">
          <div className="font-sans text-xl font-bold tracking-widest text-primary uppercase md:text-2xl">
            {t('brand.name')}
          </div>
          <span className="hidden text-[0.6rem] font-light tracking-wider text-text-secondary-light uppercase md:block md:text-xs">
            {t('brand.tagline')}
          </span>
        </div>

        <div className="hidden items-center space-x-8 text-sm font-medium tracking-wide md:flex">
          <a className="hover:text-primary" href="#inicio">
            {t('nav.home')}
          </a>
          <a className="hover:text-primary" href="#servicos">
            {t('nav.services')}
          </a>
          <a className="hover:text-primary" href="#frota">
            {t('nav.fleet')}
          </a>
          <a className="hover:text-primary" href="#atuacao">
            {t('nav.coverage')}
          </a>
          <a className="hover:text-primary" href="#contato">
            {t('nav.contact')}
          </a>
          <LanguageToggle />
          <Link className="hover:text-primary" to="/admin">
            {t('nav.admin')}
          </Link>
        </div>

        <a
          href="#reserva"
          className="hidden rounded-full bg-primary px-6 py-2 text-sm font-semibold text-text-primary-dark transition hover:bg-primary-dark md:block"
        >
          {t('nav.reserve')}
        </a>
      </nav>

      <header
        id="inicio"
        className="relative flex min-h-[90vh] w-full items-center bg-background-light"
      >
        <div className="absolute inset-0 z-0">
          <img
            alt=""
            className="h-full w-full object-cover opacity-70"
            src="https://i.postimg.cc/4yBCJYM5/nissan-kicks-cinza-chumbo-ano-2024-viajando.jpg"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
        </div>

        <div className="relative z-10 container mx-auto grid items-center gap-12 px-6 pt-20 md:px-12 lg:grid-cols-2">
          <div className="space-y-6 text-white">
            <h1 className="text-4xl leading-tight font-semibold tracking-tight md:text-5xl lg:text-6xl">
              {t('hero.title')}{' '}
              <span className="text-primary">{t('hero.titleAccent')}</span>
            </h1>
            <p className="max-w-lg text-sm leading-relaxed md:text-base">
              {t('hero.subtitle')}
            </p>
            <ul className="mb-6 hidden space-y-2 text-sm md:block">
              <li>{t('hero.bullets.executive')}</li>
              <li>{t('hero.bullets.airports')}</li>
              <li>{t('hero.bullets.fleet')}</li>
              <li>{t('hero.bullets.discretion')}</li>
            </ul>
            <a
              href="#reserva"
              className="inline-block rounded-full bg-primary px-8 py-3 font-semibold text-text-primary-dark transition hover:scale-105 hover:bg-primary-dark"
            >
              {t('hero.cta')}
            </a>
          </div>

          <div id="reserva" className="w-full lg:justify-self-end">
            <ReservationForm />
          </div>
        </div>
      </header>

      <section id="servicos" className="container mx-auto px-6 py-20 md:px-12 md:py-32">
        <h2 className="mb-4 text-center text-3xl font-semibold text-primary md:text-4xl">
          {t('services.title')}
        </h2>
        <p className="mx-auto mb-16 max-w-2xl text-center text-text-secondary-light">
          {t('services.subtitle')}
        </p>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              title: 'Transfer Executivo Corporativo',
              img: 'https://i.postimg.cc/9MtTQ92F/image1.jpg',
            },
            {
              title: 'Transfer Aeroporto (GRU/CGH/VCP)',
              img: 'https://i.postimg.cc/Dfxn3zGW/avi-o-comercial-estacionado-no-p-tio-ou-taxiando-(1).jpg',
            },
            {
              title: 'Viagens VIP e Eventos',
              img: 'https://i.postimg.cc/C1z1WfKX/altere-o-modelo-do-carro-para-que.jpg',
            },
          ].map((card) => (
            <div
              key={card.title}
              className="group relative h-80 overflow-hidden rounded-3xl"
            >
              <img
                alt=""
                src={card.img}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/30" />
              <h3 className="absolute bottom-6 left-6 text-lg font-bold text-white">
                {card.title}
              </h3>
            </div>
          ))}
        </div>
      </section>

      <section id="frota" className="border-t border-border-light py-20 md:py-32">
        <div className="container mx-auto px-6 text-center md:px-12">
          <h2 className="mb-4 text-3xl font-semibold text-primary md:text-4xl">
            Frota Executiva Premium
          </h2>
          <p className="mx-auto max-w-2xl text-text-secondary-light">
            Categorias cadastradas pelo admin (seed vazio no v1). A reserva já
            aceita o rótulo informado pelo cliente até o catálogo estar ligado.
          </p>
        </div>
      </section>

      <section id="atuacao" className="container mx-auto px-6 py-20 md:px-12 md:py-32">
        <h2 className="max-w-xl text-3xl font-semibold text-primary md:text-4xl">
          Atuação Estratégica em São Paulo e Principais Regiões
        </h2>
        <p className="mt-6 max-w-xl text-text-secondary-light">
          São Paulo capital, Grande SP, GRU, CGH e VCP.
        </p>
      </section>

      <footer
        id="contato"
        className="bg-background-dark py-16 text-sm text-text-secondary-dark"
      >
        <div className="container mx-auto flex flex-col gap-6 px-6 md:flex-row md:justify-between md:px-12">
          <div>
            <div className="text-lg font-bold tracking-widest text-text-primary-dark uppercase">
              {tenant.name}
            </div>
            <p className="mt-2">{t('footer.contact')}</p>
            <p>{tenant.contactEmail}</p>
            <p>{t('footer.whatsapp')}</p>
          </div>
          <p className="text-xs">
            © {new Date().getFullYear()} {tenant.name}. {t('footer.rights')}
          </p>
        </div>
      </footer>

      {tenant.whatsapp && (
        <a
          href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
          className="fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700"
        >
          WA
        </a>
      )}
    </div>
  )
}
