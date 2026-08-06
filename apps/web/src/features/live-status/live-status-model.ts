import type { TFunction } from "i18next"

import type { SourceHealthItem, SourceHealthStatus } from "@/api/contracts"
import { SOURCE_HEALTH_META } from "@/constants/live-status"
import type { Locale } from "@/i18n/config"
import { formatDateTime } from "@/lib/format"

// Чистая свёртка списка источников в одну строку для шапки. Фронт ничего
// не вычисляет о данных (запрет 6) — он только пересказывает статусы,
// которые прислал бэк.

export type SourceHealthSummary = {
  total: number
  /** Худшее состояние в списке — его и показывает индикатор. */
  worstStatus: SourceHealthStatus
  /** Сколько источников в этом состоянии. */
  worstCount: number
  allHealthy: boolean
}

export function summarizeSources(
  sources: readonly SourceHealthItem[]
): SourceHealthSummary | null {
  if (sources.length === 0) return null

  const worstStatus = sources.reduce<SourceHealthStatus>(
    (worst, source) =>
      SOURCE_HEALTH_META[source.status].severity >
      SOURCE_HEALTH_META[worst].severity
        ? source.status
        : worst,
    sources[0]!.status
  )

  return {
    total: sources.length,
    worstStatus,
    worstCount: sources.filter((source) => source.status === worstStatus)
      .length,
    allHealthy: sources.every((source) => source.status === "healthy"),
  }
}

/** Порядок в списке: сначала то, что требует внимания. */
export function sortSourcesBySeverity(
  sources: readonly SourceHealthItem[]
): SourceHealthItem[] {
  return [...sources].sort(
    (a, b) =>
      SOURCE_HEALTH_META[b.status].severity -
      SOURCE_HEALTH_META[a.status].severity
  )
}

/** «Последний успешный опрос: успешных опросов не было · кэша нет». */
export function sourceDetailLine(
  source: SourceHealthItem,
  locale: Locale,
  t: TFunction
): string {
  const lastSuccess =
    source.lastSuccessAt === null
      ? t("liveStatus.neverSucceeded")
      : formatDateTime(source.lastSuccessAt, locale)
  const cache = source.cacheAvailable
    ? t("liveStatus.cacheAvailable")
    : t("liveStatus.cacheMissing")
  return `${t("liveStatus.lastSuccessLabel")}: ${lastSuccess} · ${cache}`
}

export type SourceHealthGroup = {
  status: SourceHealthStatus
  sources: SourceHealthItem[]
  /**
   * Строка последнего опроса, одинаковая у всех источников группы: тогда её
   * печатают один раз рядом с подписью статуса. null — источники группы
   * отличаются друг от друга, и строка нужна каждому.
   */
  sharedDetail: string | null
}

/**
 * Источники группами по состоянию, тяжёлые состояния первыми. Группировка —
 * продолжение решения сессии 15 (одинаковая расшифровка печатается один раз):
 * при четырёх источниках в одном состоянии восемь одинаковых строк подряд
 * это шум, а не подсказка.
 */
export function groupSourcesBySeverity(
  sources: readonly SourceHealthItem[],
  locale: Locale,
  t: TFunction
): SourceHealthGroup[] {
  const groups: SourceHealthGroup[] = []

  for (const source of sortSourcesBySeverity(sources)) {
    const current = groups[groups.length - 1]
    if (current && current.status === source.status) {
      current.sources.push(source)
    } else {
      groups.push({
        status: source.status,
        sources: [source],
        sharedDetail: null,
      })
    }
  }

  return groups.map((group) => {
    const [first, ...rest] = group.sources
    if (!first) return group
    const detail = sourceDetailLine(first, locale, t)
    return {
      ...group,
      sharedDetail: rest.every(
        (source) => sourceDetailLine(source, locale, t) === detail
      )
        ? detail
        : null,
    }
  })
}
