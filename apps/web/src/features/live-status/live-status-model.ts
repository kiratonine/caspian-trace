import type { SourceHealthItem, SourceHealthStatus } from "@/api/contracts"
import { SOURCE_HEALTH_META } from "@/constants/live-status"

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
