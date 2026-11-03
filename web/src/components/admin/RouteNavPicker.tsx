import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  buildGoogleMapsDirectionsUrl,
  buildWazeNavigateUrl,
  type RoutePlaces,
} from '../../domain/routeLinks'

type Props = {
  places: RoutePlaces
  onClose: () => void
}

function GoogleMapsIcon() {
  return (
    <svg viewBox="0 0 48 48" className="route-nav-picker__brand-icon" aria-hidden="true">
      <path
        fill="#34A853"
        d="M24 4c-7.7 0-14 6.3-14 14 0 10.5 14 26 14 26s14-15.5 14-26c0-7.7-6.3-14-14-14z"
      />
      <path
        fill="#FBBC04"
        d="M24 4v40s14-15.5 14-26c0-7.7-6.3-14-14-14z"
        opacity=".9"
      />
      <path fill="#EA4335" d="M24 4c-7.7 0-14 6.3-14 14 0 3.4 1.5 7.3 3.7 11.2L24 4z" />
      <path fill="#4285F4" d="M24 12a8 8 0 1 0 .001 16.001A8 8 0 0 0 24 12z" />
      <circle fill="#fff" cx="24" cy="20" r="4.5" />
    </svg>
  )
}

function WazeIcon() {
  return (
    <svg viewBox="0 0 48 48" className="route-nav-picker__brand-icon" aria-hidden="true">
      <path
        fill="#33CCFF"
        d="M24 4C13.5 4 5.5 11.4 5.5 21.2c0 6.3 3.4 11.8 8.6 15.1L12 44l9.1-4.2c.9.1 1.9.2 2.9.2 10.5 0 18.5-7.4 18.5-18.8S34.5 4 24 4z"
      />
      <circle fill="#1A1A1A" cx="17.5" cy="20" r="2.6" />
      <circle fill="#1A1A1A" cx="28.5" cy="20" r="2.6" />
      <path
        fill="none"
        stroke="#1A1A1A"
        strokeWidth="2.2"
        strokeLinecap="round"
        d="M16.5 27.5c2.2 2.2 5 3.3 7.5 3.3s5.3-1.1 7.5-3.3"
      />
      <circle fill="#FF6B35" cx="36.5" cy="14.5" r="3.2" />
    </svg>
  )
}

export function RouteNavPicker({ places, onClose }: Props) {
  const { t } = useTranslation()
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const googleUrl = buildGoogleMapsDirectionsUrl(places)
  const wazeUrl = buildWazeNavigateUrl(places)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function openExternal(url: string | null) {
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return createPortal(
    <div className="route-nav-picker" role="presentation">
      <button
        type="button"
        className="route-nav-picker__backdrop"
        aria-label={t('admin.closeModal')}
        onClick={onClose}
      />
      <div
        className="route-nav-picker__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="route-nav-picker__head">
          <div>
            <h2 id={titleId} className="route-nav-picker__title">
              {t('admin.viewRoute')}
            </h2>
            <p className="route-nav-picker__lead">{t('admin.viewRouteLead')}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="route-nav-picker__close"
            onClick={onClose}
            aria-label={t('admin.closeModal')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="route-nav-picker__options">
          <button
            type="button"
            className="route-nav-picker__option"
            disabled={!googleUrl}
            onClick={() => openExternal(googleUrl)}
          >
            <GoogleMapsIcon />
            <span>
              <strong>Google Maps</strong>
              <small>{t('admin.viewRouteGoogleHint')}</small>
            </span>
          </button>

          <button
            type="button"
            className="route-nav-picker__option"
            disabled={!wazeUrl}
            onClick={() => openExternal(wazeUrl)}
          >
            <WazeIcon />
            <span>
              <strong>Waze</strong>
              <small>{t('admin.viewRouteWazeHint')}</small>
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function ViewRouteButton(props: {
  places: RoutePlaces
  className?: string
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const canOpen =
    Boolean(props.places.origin?.trim()) &&
    Boolean(props.places.destination?.trim())

  return (
    <button
      type="button"
      className={props.className ?? 'route-nav-trigger'}
      disabled={!canOpen}
      onClick={(e) => {
        e.stopPropagation()
        props.onOpen()
      }}
    >
      {t('admin.viewRoute')}
    </button>
  )
}
