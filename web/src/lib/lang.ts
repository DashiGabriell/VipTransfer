export const LANG_KEY = 'jmd.lang'

export type AppLang = 'pt-BR' | 'en'

export function readStoredLang(): AppLang {
  try {
    const stored = localStorage.getItem(LANG_KEY)
    if (stored === 'en' || stored === 'pt-BR') return stored
  } catch {
    /* ignore */
  }
  return 'pt-BR'
}

export function writeStoredLang(lang: AppLang) {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    /* ignore */
  }
}
