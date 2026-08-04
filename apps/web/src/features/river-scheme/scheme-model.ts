import type { IncidentDetail } from "@/api/contracts"
import type { Measurement, SourceDocument, Station } from "@/types"

// Чистая подготовка данных схемы: разделение станций на упорядоченные
// (riverOrder подтверждён) и группу «порядок не подтверждён» (решение сессии 1:
// такие станции не встраиваются в линию). Никаких выводов фронт не считает —
// коридор приходит готовым (corridorBounds), доля значения нужна только для
// монохромного бара «относительное положение внутри события» (ТЗ §13).

export type StationSchemeEntry = {
  station: Station
  measurement: Measurement | null
  sourceDocument: SourceDocument | null
  /** Доля значения от максимума события (0..1) — длина бара; null, если значения нет. */
  valueShare: number | null
}

export type SchemeModel = {
  /** По riverOrder, меньший — выше по течению (ТЗ §8). */
  ordered: StationSchemeEntry[]
  /** riverOrder = null — в порядке, в котором станции отдал бэк, без ранжирования. */
  unordered: StationSchemeEntry[]
  corridor: IncidentDetail["corridorBounds"]
}

export function buildSchemeModel(detail: IncidentDetail): SchemeModel {
  const documentsById = new Map(
    detail.sourceDocuments.map((document) => [document.id, document])
  )
  const maxValue = detail.measurements.reduce(
    (max, m) => Math.max(max, m.value),
    0
  )

  const entries: StationSchemeEntry[] = detail.stations.map((station) => {
    const measurement =
      detail.measurements.find((m) => m.stationId === station.id) ?? null
    return {
      station,
      measurement,
      sourceDocument: measurement
        ? (documentsById.get(measurement.sourceDocumentId) ?? null)
        : null,
      valueShare:
        measurement && maxValue > 0 ? measurement.value / maxValue : null,
    }
  })

  return {
    ordered: entries
      .filter((entry) => entry.station.riverOrder !== null)
      .sort(
        (a, b) => (a.station.riverOrder ?? 0) - (b.station.riverOrder ?? 0)
      ),
    unordered: entries.filter((entry) => entry.station.riverOrder === null),
    corridor: detail.corridorBounds,
  }
}
