import i18next from "i18next"
import { initReactI18next } from "react-i18next"

import { DEFAULT_LOCALE, LOCALES } from "./config"
import {
  LOCALE_STORAGE_KEY,
  resolveInitialLocale,
} from "./resolve-initial-locale"
import { az } from "./resources/az"
import { fa } from "./resources/fa"
import { kk } from "./resources/kk"
import { ru } from "./resources/ru"
import { tk } from "./resources/tk"

const initialLocale = resolveInitialLocale({
  search: window.location.search,
  stored: window.localStorage.getItem(LOCALE_STORAGE_KEY),
  navigatorLanguages: window.navigator.languages,
})

// Плагинов нет намеренно: i18next-http-backend грузит ресурсы по сети
// (демо обязано работать офлайн), а детект языка — десять строк своего кода
// в resolve-initial-locale.ts. Ресурсы импортируются статически.
void i18next.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    kk: { translation: kk },
    az: { translation: az },
    fa: { translation: fa },
    tk: { translation: tk },
  },
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...LOCALES],
  // React экранирует сам; повторное экранирование ломает кавычки-ёлочки
  // в названиях створов.
  interpolation: { escapeValue: false },
  returnNull: false,
})

function syncDocumentLanguage(locale: string): void {
  document.documentElement.lang = locale
}

// dir на <html> не ставим: решение владельца продукта 06.08.2026 — макет
// остаётся LTR (лента слева, карта в центре, шкала реплея слева направо),
// только атрибут lang синхронизируется с текущей локалью.
syncDocumentLanguage(initialLocale)
i18next.on("languageChanged", syncDocumentLanguage)

export { i18next }
