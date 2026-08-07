import { INTL_LOCALES, NUMBER_LOCALE, type Locale } from "@/i18n/config"
import type { IncidentSignal, Measurement } from "@/types"

// Казахстан с марта 2024 живёт в едином UTC+5 без сезонных переводов.
// Фиксированная зона вместо зоны браузера — чтобы демо показывало одни и те же
// даты и часы на любой машине (конвенция проекта: даты явно в поясе +05:00).
const TIME_ZONE = "Asia/Atyrau"

// Точность как в таблицах бюллетеней ТЗ §5 (0,234): максимум три знака,
// хвостовые нули не дорисовываем — число на экране 1:1 с первоисточником.
// Числа не локализуются вообще: значение на экране обязано сверяться
// с таблицей бюллетеня (решение сессии 4). Запятая как десятичный разделитель
// верна и для kk, az, tk; фарси получил бы арабо-индийские цифры.
const numberFormat = new Intl.NumberFormat(NUMBER_LOCALE, {
  maximumFractionDigits: 3,
})

// Intl.DateTimeFormat дорог в создании, а локаль меняется редко — форматтеры
// кэшируются по локали вместо пересоздания на каждый вызов.
const dateFormats = new Map<Locale, Intl.DateTimeFormat>()
const dateTimeFormats = new Map<Locale, Intl.DateTimeFormat>()
const monthFormats = new Map<Locale, Intl.DateTimeFormat>()

function cached(
  cache: Map<Locale, Intl.DateTimeFormat>,
  locale: Locale,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const hit = cache.get(locale)
  if (hit) return hit
  const created = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    timeZone: TIME_ZONE,
    ...options,
  })
  cache.set(locale, created)
  return created
}

// Период в контракте — строка ISO с точностью до месяца ('2025-09'). Что-то
// другое (квартал, диапазон, свободный текст) не разбираем, а показываем как есть.
const MONTH_PRECISION = /^\d{4}-\d{2}$/

// Неразрывный пробел: число не отрывается от единицы при переносе строки.
const NBSP = " "

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

/**
 * «0,234 мг/дм³» — число с единицей измерения через неразрывный пробел.
 * Подпись единицы приходит уже переведённой строкой: справочник единиц
 * станет переводом в i18n-ресурсе, а lib/format.ts не должен знать про i18next.
 */
export function formatMeasurement(value: number, unitLabel: string): string {
  return `${numberFormat.format(value)}${NBSP}${unitLabel}`
}

/** «9 сентября 2025 г.» */
export function formatDate(iso: string, locale: Locale): string {
  return cached(dateFormats, locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso))
}

/** «9 сентября 2025 г., 15:16» — время в поясе +05:00. */
export function formatDateTime(iso: string, locale: Locale): string {
  return cached(dateTimeFormats, locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

/** «сентябрь 2025 г.» */
export function formatMonth(isoMonth: string, locale: Locale): string {
  // Полдень первого числа в +05:00 — никакая зона не утащит дату в соседний месяц.
  return cached(monthFormats, locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(`${isoMonth}-01T12:00:00+05:00`))
}

/**
 * Дата с честной точностью: известная точная — днём, иначе период месяцем
 * («сентябрь 2025 г.»). `null` — датировать нечем; выдумывать день или
 * подставлять пустую строку нельзя, решение принимает вызывающий код.
 */
function formatExactOrPeriod(
  exact: string | null,
  period: string | null,
  locale: Locale
): string | null {
  if (exact !== null) return formatDate(exact, locale)
  if (period === null) return null
  return MONTH_PRECISION.test(period) ? formatMonth(period, locale) : period
}

/** Дата отбора пробы: точная `sampledAt` либо период `sampledPeriod`. */
export function formatSampledDate(
  measurement: Pick<Measurement, "sampledAt" | "sampledPeriod">,
  locale: Locale
): string | null {
  return formatExactOrPeriod(measurement.sampledAt, measurement.sampledPeriod, locale)
}

/** Дата наблюдения из сообщения: точная `observedAt` либо период `observedPeriod`. */
export function formatObservedDate(
  signal: Pick<IncidentSignal, "observedAt" | "observedPeriod">,
  locale: Locale
): string | null {
  return formatExactOrPeriod(signal.observedAt, signal.observedPeriod, locale)
}
