import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { writeStoredLang, type AppLang } from '../lib/lang'
import { FlagBrazil, FlagUS } from './flags/FlagIcons'

type Props = {
  className?: string
  variant?: 'default' | 'admin'
  onChanged?: (lang: AppLang) => void
}

export function LanguageToggle({
  className = '',
  variant = 'default',
  onChanged,
}: Props) {
  const { i18n, t } = useTranslation()
  const uid = useId().replace(/:/g, '')
  const isEn = i18n.language.startsWith('en')

  async function setLang(next: AppLang) {
    await i18n.changeLanguage(next)
    writeStoredLang(next)
    onChanged?.(next)
  }

  return (
    <div
      className={`lang-toggle lang-toggle--${variant} ${className}`.trim()}
      role="group"
      aria-label={t('lang.label')}
    >
      <button
        type="button"
        className={`lang-toggle__btn${!isEn ? ' is-active' : ''}`}
        onClick={() => void setLang('pt-BR')}
        aria-pressed={!isEn}
        title="Português (Brasil)"
      >
        <span className="lang-toggle__flag" aria-hidden="true">
          <FlagBrazil className="lang-toggle__flag-svg" />
        </span>
        <span className="lang-toggle__code">PT</span>
      </button>
      <button
        type="button"
        className={`lang-toggle__btn${isEn ? ' is-active' : ''}`}
        onClick={() => void setLang('en')}
        aria-pressed={isEn}
        title="English"
      >
        <span className="lang-toggle__flag" aria-hidden="true">
          <FlagUS className="lang-toggle__flag-svg" clipId={`flag-us-${uid}`} />
        </span>
        <span className="lang-toggle__code">EN</span>
      </button>
    </div>
  )
}
