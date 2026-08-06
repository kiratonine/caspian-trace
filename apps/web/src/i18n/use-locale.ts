import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { DEFAULT_LOCALE, isLocale, type Locale } from "./config"
import {
  LOCALE_STORAGE_KEY,
  normalizeLanguageTag,
} from "./resolve-initial-locale"

export function useLocale(): {
  locale: Locale
  setLocale: (locale: Locale) => void
} {
  const { i18n } = useTranslation()

  // i18n.language может нести регион ('ru-RU') после смены языка браузером;
  // наружу отдаём только известную локаль. Та же нормализация, что и
  // в resolveInitialLocale, — иначе 'kk-KZ' молча откатился бы на русский.
  const normalizedLanguage = normalizeLanguageTag(i18n.language)
  const locale = isLocale(normalizedLanguage)
    ? normalizedLanguage
    : DEFAULT_LOCALE

  const setLocale = useCallback(
    (next: Locale) => {
      void i18n.changeLanguage(next)
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next)
    },
    [i18n]
  )

  return { locale, setLocale }
}
