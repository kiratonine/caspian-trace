// Список локалей и всё, что от него производно. Отдельный файл без импортов
// i18next: его читают и форматтеры, и роутер, и дев-галерея.

export const LOCALES = ["ru", "kk", "az", "fa", "tk"] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "ru"

// Персидский — единственное письмо справа налево из пяти.
export const RTL_LOCALES: readonly Locale[] = ["fa"]

// Эндонимы: носитель ищет свой язык написанным по-своему, а не «Персидский»
// кириллицей. Порядок — как в LOCALES.
export const LOCALE_ENDONYMS = {
  ru: "Русский",
  kk: "Қазақша",
  az: "Azərbaycanca",
  fa: "فارسی",
  tk: "Türkmençe",
} as const satisfies Record<Locale, string>

// Локаль для Intl НЕ равна коду локали интерфейса. Персидский форсируется на
// григорианский календарь и европейские цифры: по умолчанию Intl отдал бы
// джалали («۱۸ شهریور ۱۴۰۴»), а демо стоит на сентябрьском бюллетене — дату,
// которую нельзя сопоставить с документом, показывать нельзя.
export const INTL_LOCALES = {
  ru: "ru-RU",
  kk: "kk-KZ",
  az: "az-AZ",
  fa: "fa-IR-u-ca-gregory-nu-latn",
  tk: "tk-TM",
} as const satisfies Record<Locale, string>

// Числа не локализуются вообще: значение на экране обязано сверяться
// с таблицей бюллетеня (решение сессии 4). Запятая как десятичный разделитель
// верна и для kk, az, tk; фарси получил бы арабо-индийские цифры.
export const NUMBER_LOCALE = "ru-RU"

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale)
}

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  )
}
