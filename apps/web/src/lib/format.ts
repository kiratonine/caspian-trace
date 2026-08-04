import { unitLabel } from "@/constants/units"
import type { IncidentSignal, Measurement } from "@/types"

// Казахстан с марта 2024 живёт в едином UTC+5 без сезонных переводов.
// Фиксированная зона вместо зоны браузера — чтобы демо показывало одни и те же
// даты и часы на любой машине (конвенция проекта: даты явно в поясе +05:00).
const TIME_ZONE = "Asia/Atyrau"

const LOCALE = "ru-RU"

// Точность как в таблицах бюллетеней ТЗ §5 (0,234): максимум три знака,
// хвостовые нули не дорисовываем — число на экране 1:1 с первоисточником.
const numberFormat = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 3,
})

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
})

const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const monthFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  month: "long",
  year: "numeric",
})

// Период в контракте — строка ISO с точностью до месяца ('2025-09'). Что-то
// другое (квартал, диапазон, свободный текст) не разбираем, а показываем как есть.
const MONTH_PRECISION = /^\d{4}-\d{2}$/

// Неразрывный пробел: число не отрывается от единицы при переносе строки.
const NBSP = "\u00A0"

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

/** «0,234 мг/дм³» — число с единицей измерения через неразрывный пробел. */
export function formatMeasurement(value: number, unit: string): string {
  return `${numberFormat.format(value)}${NBSP}${unitLabel(unit)}`
}

/** «9 сентября 2025 г.» */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso))
}

/** «9 сентября 2025 г., 15:16» — время в поясе +05:00. */
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso))
}

/** «сентябрь 2025 г.» */
export function formatMonth(isoMonth: string): string {
  // Полдень первого числа в +05:00 — никакая зона не утащит дату в соседний месяц.
  return monthFormat.format(new Date(`${isoMonth}-01T12:00:00+05:00`))
}

/**
 * Дата с честной точностью: известная точная — днём, иначе период месяцем
 * («сентябрь 2025 г.»). `null` — датировать нечем; выдумывать день или
 * подставлять пустую строку нельзя, решение принимает вызывающий код.
 */
function formatExactOrPeriod(
  exact: string | null,
  period: string | null
): string | null {
  if (exact !== null) return formatDate(exact)
  if (period === null) return null
  return MONTH_PRECISION.test(period) ? formatMonth(period) : period
}

/** Дата отбора пробы: точная `sampledAt` либо период `sampledPeriod`. */
export function formatSampledDate(
  measurement: Pick<Measurement, "sampledAt" | "sampledPeriod">
): string | null {
  return formatExactOrPeriod(measurement.sampledAt, measurement.sampledPeriod)
}

/** Дата наблюдения из сообщения: точная `observedAt` либо период `observedPeriod`. */
export function formatObservedDate(
  signal: Pick<IncidentSignal, "observedAt" | "observedPeriod">
): string | null {
  return formatExactOrPeriod(signal.observedAt, signal.observedPeriod)
}
