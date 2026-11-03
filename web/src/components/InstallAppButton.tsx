import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePwaInstall } from '../hooks/usePwaInstall'

type Props = {
  className?: string
  /** Visual variant for landing vs admin. */
  variant?: 'landing' | 'admin'
}

export function InstallAppButton({
  className = '',
  variant = 'landing',
}: Props) {
  const { t } = useTranslation()
  const { showInstallUi, canNativePrompt, promptInstall, ios } = usePwaInstall()
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  if (!showInstallUi) return null

  async function onClick() {
    setHint(null)
    if (canNativePrompt) {
      setBusy(true)
      try {
        const ok = await promptInstall()
        if (!ok) setHint(t('pwa.installDismissed'))
      } catch {
        setHint(t('pwa.installError'))
      } finally {
        setBusy(false)
      }
      return
    }

    setHint(ios ? t('pwa.installIosHint') : t('pwa.installManualHint'))
  }

  const baseClass =
    variant === 'admin'
      ? 'install-app-btn install-app-btn--admin'
      : 'install-app-btn install-app-btn--landing'

  return (
    <div className={`install-app-wrap ${className}`.trim()}>
      <button
        type="button"
        className={baseClass}
        disabled={busy}
        onClick={() => void onClick()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="install-app-btn__icon">
          <path
            d="M12 3v10m0 0l-3.5-3.5M12 13l3.5-3.5M5 17.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {busy ? t('pwa.installing') : t('pwa.install')}
      </button>
      {hint && (
        <p className="install-app-hint" role="status">
          {hint}
        </p>
      )}
    </div>
  )
}
