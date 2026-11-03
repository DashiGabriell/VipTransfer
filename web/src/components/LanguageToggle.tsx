import { useTranslation } from 'react-i18next'

export function LanguageToggle() {
  const { i18n } = useTranslation()
  const isEn = i18n.language.startsWith('en')

  return (
    <button
      type="button"
      className="text-sm font-medium tracking-wide text-text-secondary-light hover:text-primary transition"
      onClick={() => void i18n.changeLanguage(isEn ? 'pt-BR' : 'en')}
      aria-label="Change language"
    >
      {isEn ? 'PT' : 'EN'}
    </button>
  )
}
