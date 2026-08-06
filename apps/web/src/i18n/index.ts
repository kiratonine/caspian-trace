import i18next from "i18next"
import { initReactI18next } from "react-i18next"

import { DEFAULT_LOCALE, LOCALES } from "./config"
import { ru } from "./resources/ru"

// Плагинов нет намеренно: i18next-http-backend грузит ресурсы по сети
// (демо обязано работать офлайн), а детект языка — десять строк своего кода
// в resolve-initial-locale.ts. Ресурсы импортируются статически.
void i18next.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...LOCALES],
  // React экранирует сам; повторное экранирование ломает кавычки-ёлочки
  // в названиях створов.
  interpolation: { escapeValue: false },
  returnNull: false,
})

export { i18next }
