import type {
  CandidateObject,
  EvidenceLevel,
  EvidenceStatement,
  IncidentSignal,
  Investigation,
  Measurement,
  ReplayStepType,
  SourceDocument,
  Station,
} from "@/types"

// ПРОВИЗОРНЫЕ формы ответов API. ТЗ §12 описывает эндпоинты словами, без JSON-схем;
// вопросы плана 2 (incident vs investigation), 3 (payload реплея) и 6 (границы
// коридора) открыты. Когда команда зафиксирует контракт, правятся этот файл и
// src/api/* — компоненты и типы ТЗ §8 (src/types/) не трогаются.

export type Region = "atyrau" | "mangystau" // ТЗ §12: region=atyrau|mangystau

// Параметры GET /api/incidents (ТЗ §12).
export type IncidentListParams = {
  status?: EvidenceLevel
  region?: Region
  from?: string
  to?: string
  limit?: number // максимум MAX_INCIDENTS_LIMIT
}

// GET /api/incidents — «список событий».
export type IncidentSummary = {
  id: string
  title: string
  region: Region
  evidenceLevel: EvidenceLevel
  indicator: string
  updatedAt: string
  // ПРОВИЗОРНО (вопрос 4): период наблюдений события — ISO с точностью
  // до месяца ('2025-09'), как sampledAt измерений. Без него список не
  // отличает май от сентября иначе как разбором заголовка, а сравнение
  // периодов одного участка — главный сюжет демо (ТЗ §5, §14).
  // null — период не определён (кейс Актау).
  period: string | null
}

// GET /api/incidents/:id — «событие, сигналы, измерения и краткий вывод».
export type IncidentDetail = {
  investigation: Investigation
  region: Region
  signals: IncidentSignal[]
  measurements: Measurement[]
  stations: Station[]
  candidateObjects: CandidateObject[]
  sourceDocuments: SourceDocument[]
  // ПРОВИЗОРНО (вопрос 6): границы коридора парой створов — GeoJSON без
  // подтверждённых координат для линейной схемы бесполезен.
  // upstreamStationId = null — интервал открыт вверх («выше створа X»).
  corridorBounds: {
    upstreamStationId: string | null
    downstreamStationId: string
  } | null
}

// ПРОВИЗОРНО (вопрос 3): payload шагов реплея до примера JSON от команды.
// В src/types/replay.ts payload остаётся unknown — 1:1 с ТЗ §12.
export type ReplayStepPayloadMap = {
  signal: { signal: IncidentSignal; evidenceLevel: EvidenceLevel }
  corroboration: {
    text: string
    sourceDocumentId: string
    evidenceLevel: EvidenceLevel
  }
  measurement: { measurements: Measurement[]; evidenceLevel: EvidenceLevel }
  inference: { text: string; evidenceLevel: EvidenceLevel }
  conclusion: { text: string; evidenceLevel: EvidenceLevel }
}

export type TypedReplayStep = {
  [K in ReplayStepType]: {
    id: string
    offsetMs: number
    type: K
    payload: ReplayStepPayloadMap[K]
  }
}[ReplayStepType]

// POST /api/replays/:id/start — «неизменяемый сценарий реплея».
export type ReplayScenario = {
  id: string
  incidentId: string
  steps: TypedReplayStep[]
}

// GET /api/investigations/:id/evidence — «полный граф доказательств».
export type EvidenceGraph = {
  investigationId: string
  statements: EvidenceStatement[]
  measurements: Measurement[]
  sourceDocuments: SourceDocument[]
}

// GET /api/live/status — время последнего обновления источников и наличие кэша.
export type LiveSourceStatus = {
  id: string
  name: string
  lastSuccessAt: string | null
  cacheAvailable: boolean
}

export type LiveStatus = {
  sources: LiveSourceStatus[]
}
