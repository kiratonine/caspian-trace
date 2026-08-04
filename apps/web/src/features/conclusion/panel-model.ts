import type { IncidentDetail } from "@/api/contracts"
import type {
  EvidenceStatement,
  Measurement,
  SourceDocument,
  Station,
} from "@/types"

// Чистая подготовка данных панели: утверждениям (§13, блоки 3–4) разворачиваются
// их измерения со створом и документом — каждое число открывает источник
// (критерий §16 п.5). Сами выводы фронт не строит (запрет 6).

export type MeasurementRef = {
  measurement: Measurement
  station: Station | null
  sourceDocument: SourceDocument | null
}

export type StatementEntry = {
  statement: EvidenceStatement
  refs: MeasurementRef[]
}

export type SourceEntry = {
  document: SourceDocument
  /** Страница из ссылающегося измерения; 0 — сентинел «не подтверждена». */
  page: number | null | undefined
}

export type PanelModel = {
  supportedFacts: StatementEntry[]
  contradictedHypotheses: StatementEntry[]
  sources: SourceEntry[]
}

export function buildPanelModel(detail: IncidentDetail): PanelModel {
  const measurementsById = new Map(detail.measurements.map((m) => [m.id, m]))
  const stationsById = new Map(detail.stations.map((s) => [s.id, s]))
  const documentsById = new Map(detail.sourceDocuments.map((d) => [d.id, d]))

  const toEntry = (statement: EvidenceStatement): StatementEntry => ({
    statement,
    refs: statement.measurementIds.flatMap((id) => {
      const measurement = measurementsById.get(id)
      if (!measurement) return []
      return [
        {
          measurement,
          station: stationsById.get(measurement.stationId) ?? null,
          sourceDocument:
            documentsById.get(measurement.sourceDocumentId) ?? null,
        },
      ]
    }),
  })

  return {
    supportedFacts: detail.investigation.supportedFacts.map(toEntry),
    contradictedHypotheses:
      detail.investigation.contradictedHypotheses.map(toEntry),
    sources: detail.sourceDocuments.map((document) => ({
      document,
      page: detail.measurements.find((m) => m.sourceDocumentId === document.id)
        ?.sourcePage,
    })),
  }
}
