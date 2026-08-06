import type { SourceHealthItem, SourceHealthStatus } from "@/api/contracts"
import { formatDateTime } from "@/lib/format"
import {
  LIVE_STATUS_CACHE_AVAILABLE,
  LIVE_STATUS_CACHE_MISSING,
  LIVE_STATUS_LAST_SUCCESS_LABEL,
  LIVE_STATUS_NEVER_SUCCEEDED,
  SOURCE_HEALTH_META,
} from "@/constants/live-status"

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
export function sourceDetailLine(source: SourceHealthItem): string {
  const lastSuccess =
    source.lastSuccessAt === null
      ? LIVE_STATUS_NEVER_SUCCEEDED
      : formatDateTime(source.lastSuccessAt)
  const cache = source.cacheAvailable
    ? LIVE_STATUS_CACHE_AVAILABLE
    : LIVE_STATUS_CACHE_MISSING
  return `${LIVE_STATUS_LAST_SUCCESS_LABEL}: ${lastSuccess} · ${cache}`
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
  sources: readonly SourceHealthItem[]
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
    const detail = sourceDetailLine(first)
    return {
      ...group,
      sharedDetail: rest.every((source) => sourceDetailLine(source) === detail)
        ? detail
        : null,
    }
  })
}
