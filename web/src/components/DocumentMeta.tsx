import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { publicSiteOrigin } from '../lib/siteUrl'

const DEFAULT_TITLE = 'JMD Transfer — Mobilidade executiva em São Paulo'
const DEFAULT_DESCRIPTION =
  'Transfer executivo em São Paulo: ponto a ponto, horas à disposição e concierge. Frota premium, blindagem opcional — valor combinado no WhatsApp.'

const PRIVATE_PREFIXES = [
  '/login',
  '/aceitar-convite',
  '/admin',
  '/motorista',
  '/dashitecnology',
] as const

const JSON_LD_ID = 'jmd-json-ld'

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function upsertMeta(
  attr: 'name' | 'property',
  key: string,
  content: string,
): void {
  const selector = `meta[${attr}="${key}"]`
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

function upsertCanonical(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }
  link.href = href
}

function removeJsonLd(): void {
  document.getElementById(JSON_LD_ID)?.remove()
}

function upsertJsonLd(data: Record<string, unknown>): void {
  let script = document.getElementById(JSON_LD_ID) as HTMLScriptElement | null
  if (!script) {
    script = document.createElement('script')
    script.id = JSON_LD_ID
    script.type = 'application/ld+json'
    document.head.appendChild(script)
  }
  script.textContent = JSON.stringify(data)
}

/**
 * Keeps robots / canonical / Open Graph in sync with the SPA route.
 * Private areas get noindex; the landing gets LocalBusiness JSON-LD.
 */
export function DocumentMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const origin = publicSiteOrigin()
    const privateRoute = isPrivatePath(pathname)
    const path =
      pathname === '/' ? '/' : pathname.replace(/\/+$/, '') || '/'
    const canonical = `${origin}${path === '/' ? '/' : path}`

    upsertMeta(
      'name',
      'robots',
      privateRoute ? 'noindex, nofollow' : 'index, follow',
    )
    upsertCanonical(canonical)

    if (privateRoute) {
      removeJsonLd()
      return
    }

    if (pathname === '/') {
      if (document.title !== DEFAULT_TITLE) {
        document.title = DEFAULT_TITLE
      }
      upsertMeta('name', 'description', DEFAULT_DESCRIPTION)
      upsertMeta('property', 'og:url', canonical)
      upsertMeta('property', 'og:title', DEFAULT_TITLE)
      upsertMeta('property', 'og:description', DEFAULT_DESCRIPTION)
      upsertMeta('name', 'twitter:title', DEFAULT_TITLE)
      upsertMeta('name', 'twitter:description', DEFAULT_DESCRIPTION)

      upsertJsonLd({
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: 'JMD Transfer',
        description: DEFAULT_DESCRIPTION,
        url: origin,
        email: 'contato@jmdtransfer.com.br',
        telephone: '+55-11-94924-7258',
        image: `${origin}/logo-1.png`,
        areaServed: [
          { '@type': 'City', name: 'São Paulo' },
          { '@type': 'Airport', name: 'Aeroporto de Guarulhos', iataCode: 'GRU' },
          { '@type': 'Airport', name: 'Aeroporto de Congonhas', iataCode: 'CGH' },
          {
            '@type': 'Airport',
            name: 'Aeroporto de Viracopos',
            iataCode: 'VCP',
          },
        ],
        priceRange: '$$',
      })
    } else {
      removeJsonLd()
      upsertMeta('property', 'og:url', canonical)
    }
  }, [pathname])

  return null
}
