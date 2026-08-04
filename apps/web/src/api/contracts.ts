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

// Формы ответов API. Обновлённое ТЗ (роадмап §9.2) утвердило `IncidentDetail`
// ниже как MVP-контракт, а вопросы 2 (incident vs investigation), 3 (payload
// реплея) и 6 (границы коридора) закрыло. ПРОВИЗОРНЫМ осталось поле
// `IncidentSummary.period` (вопрос 4) — оно помечено отдельно.
// Правки контракта живут здесь и в src/api/*; компоненты не трогаются.

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
  // ПРОВИЗОРНО (вопрос 14): воспроизводимость вывода. Таблица `investigations`
  // (роадмап §6.2) хранит `ruleset_version` и `input_hash`, и досье §21.1 п.12
  // обязано их напечатать, но перечень полей ответа §9.2 их не называет.
  // null — бэк блок не прислал; null внутри полей — прислал, но без значения.
  // Досье в обоих случаях пишет «не передана», а не подставляет правдоподобное.
  provenance: {
    rulesetVersion: string | null
    inputHash: string | null
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

// GET /api/investigations/:id/export?format=json — машиночитаемое досье.
// ПРОВИЗОРНО (вопрос 5): состав `DossierModel` бэк ещё не зафиксировал
// (роадмап §21.2 называет только методы). До тех пор экспорт — ровно те данные,
// которые печатает страница, плюс дата выгрузки и юридическая оговорка:
// файл рядом с бумагой должен объясняться сам, без нашего интерфейса.
export type DossierExport = {
  generatedAt: string
  disclaimer: string
  incident: IncidentDetail
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
