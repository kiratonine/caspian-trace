import { UNIT_LABELS } from "@/constants/units"
import type { Measurement } from "@/types"

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

// В ТЗ у отборов проб известен только месяц — `sampledAt` бывает 'ГГГГ-ММ'.
const MONTH_PRECISION = /^\d{4}-\d{2}$/

// Неразрывный пробел: число не отрывается от единицы при переносе строки.
const NBSP = "\u00A0"

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

/** «0,234 мг/дм³» — число с единицей измерения через неразрывный пробел. */
export function formatMeasurement(
  value: number,
  unit: Measurement["unit"]
): string {
  return `${numberFormat.format(value)}${NBSP}${UNIT_LABELS[unit]}`
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
 * Дата отбора пробы с честной точностью: месячную ('2025-09') не превращаем
 * в выдуманный день — показываем «сентябрь 2025 г.».
 */
export function formatSampledAt(sampledAt: string): string {
  if (MONTH_PRECISION.test(sampledAt)) {
    return formatMonth(sampledAt)
  }
  return formatDate(sampledAt)
}
