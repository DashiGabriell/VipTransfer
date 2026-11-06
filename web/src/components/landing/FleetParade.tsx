import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

type FleetSlide = {
  id: string
  image: string
  titleKey: string
  specKey: string
  footKey: string
}

const SLIDES: readonly FleetSlide[] = [
  {
    id: 'suv',
    image: '/SUV-EXECUTIVO.jpeg',
    titleKey: 'landing.suvTitle',
    specKey: 'landing.suvSpec',
    footKey: 'landing.suvFoot',
  },
  {
    id: 'sedan',
    image: '/SEDAN-LUXO.jpeg',
    titleKey: 'landing.sedanTitle',
    specKey: 'landing.sedanSpec',
    footKey: 'landing.sedanFoot',
  },
  {
    id: 'van',
    image: '/VAN-EXECUTIVA.jpeg',
    titleKey: 'landing.vanTitle',
    specKey: 'landing.vanSpec',
    footKey: 'landing.vanFoot',
  },
  {
    id: 'suv-armored',
    image: '/SUV-BLINDADO.jpeg',
    titleKey: 'landing.suvArmoredTitle',
    specKey: 'landing.suvArmoredSpec',
    footKey: 'landing.suvArmoredFoot',
  },
  {
    id: 'sedan-armored',
    image: '/SEDAN-BLINDADO.jpeg',
    titleKey: 'landing.sedanArmoredTitle',
    specKey: 'landing.sedanArmoredSpec',
    footKey: 'landing.sedanArmoredFoot',
  },
] as const

type Props = {
  onConsult: () => void
}

export function FleetParade({ onConsult }: Props) {
  const { t } = useTranslation()
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduceMotion(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const loop = reduceMotion ? [...SLIDES] : [...SLIDES, ...SLIDES]

  return (
    <div
      className={`fleet-parade${reduceMotion ? ' fleet-parade--static' : ''}`}
      aria-label={t('landing.fleetTitle')}
    >
      <div className="fleet-parade-viewport">
        <div className="fleet-parade-track">
          {loop.map((slide, index) => (
            <article
              key={`${slide.id}-${index}`}
              className="fleet-sheet fleet-sheet--slide"
              aria-hidden={!reduceMotion && index >= SLIDES.length}
            >
              <div>
                <h3>{t(slide.titleKey)}</h3>
                <p className="spec">{t(slide.specKey)}</p>
              </div>
              <div className="visual visual--fleet">
                <img
                  src={slide.image}
                  alt=""
                  width={640}
                  height={400}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="fleet-foot">
                <span>{t(slide.footKey)}</span>
                <button type="button" className="fleet-consult" onClick={onConsult}>
                  {t('landing.consult')}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
