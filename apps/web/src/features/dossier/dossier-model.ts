import type { TFunction } from "i18next"

import type { IncidentDetail } from "@/api/contracts"
import {
  buildPanelModel,
  type SourceEntry,
  type StatementEntry,
} from "@/features/conclusion/panel-model"
import type { Locale } from "@/i18n/config"
import { formatSampledDate } from "@/lib/format"
import { hasConfirmedPage } from "@/lib/source"
import type {
  CandidateObject,
  IncidentSignal,
  Measurement,
  SourceDocument,
  Station,
} from "@/types"

// Чистая подготовка данных досье: соединяет измерения со створами и документами,
// сигналы — с их первоисточниками, объекты для проверки — с документами-
// основаниями. Утверждения и список источников берутся у панели (buildPanelModel):
// бумага и экран обязаны показывать одни и те же основания, а вторая копия
// разворачивания measurementIds разъехалась бы с первой.
// Никаких выводов фронт не строит (запрет 6): вывод, уровень, границы участка
// и утверждения приходят готовыми.

export type DossierSignalEntry = {
  signal: IncidentSignal
  sourceDocument: SourceDocument | null
}

export type DossierMeasurementRow = {
  measurement: Measurement
  station: Station | null
  sourceDocument: SourceDocument | null
}

export type DossierObjectEntry = {
  object: CandidateObject
  /** Документы, в которых объект упомянут; пустой список — оснований не приложено. */
  evidenceDocuments: SourceDocument[]
}

/** Границы участка именами створов — карты нет, координаты не подтверждены (ТЗ §17). */
export type DossierCorridor =
  | { kind: "between"; upstream: Station; downstream: Station }
  | { kind: "openUpstream"; downstream: Station }
  | null

/**
 * Воспроизводимость вывода (§21.1 п. 12). В ответе `GET /api/incidents/:id`
 * этих полей нет: утверждённый контракт возит их с машиночитаемым досье
 * (`Dossier.rulesetVersion` / `Dossier.inputHash`), а печатная страница
 * намеренно не зависит от эндпоинта экспорта (решение сессии 1). Пока пара
 * не приедет, оба значения `null`, и лист печатает «не передана расчётным
 * ядром» — правдоподобную версию правил подставлять нельзя.
 */
export type DossierProvenance = {
  rulesetVersion: string | null
  inputHash: string | null
}

export type DossierModel = {
  signals: DossierSignalEntry[]
  measurements: DossierMeasurementRow[]
  supportedFacts: StatementEntry[]
  contradictedHypotheses: StatementEntry[]
  objects: DossierObjectEntry[]
  sources: SourceEntry[]
  corridor: DossierCorridor
  provenance: DossierProvenance
}

/**
 * Ключ хронологии: известная дата наблюдения, иначе период, иначе дата
 * сообщения. Строки ISO сравниваются лексикографически, и '2025-09' встаёт
 * перед '2025-09-01' — менее точная дата не притворяется точнее.
 */
function chronologyKey(signal: IncidentSignal): string {
  return signal.observedAt ?? signal.observedPeriod ?? signal.reportedAt
}

function buildCorridor(
  bounds: IncidentDetail["corridorBounds"],
  stationsById: Map<string, Station>
): DossierCorridor {
  if (!bounds) return null
  const downstream = stationsById.get(bounds.downstreamStationId)
  if (!downstream) return null
  if (bounds.upstreamStationId === null) {
    return { kind: "openUpstream", downstream }
  }
  const upstream = stationsById.get(bounds.upstreamStationId)
  // Верхняя граница названа, но створа с таким id в данных нет: «открыт вверх»
  // здесь было бы другим утверждением, поэтому участок не описываем вовсе.
  return upstream ? { kind: "between", upstream, downstream } : null
}

export function buildDossierModel(detail: IncidentDetail): DossierModel {
  const documentsById = new Map(detail.sourceDocuments.map((d) => [d.id, d]))
  const stationsById = new Map(detail.stations.map((s) => [s.id, s]))
  const panel = buildPanelModel(detail)

  return {
    signals: [...detail.signals]
      .sort((a, b) => chronologyKey(a).localeCompare(chronologyKey(b)))
      .map((signal) => ({
        signal,
        sourceDocument: documentsById.get(signal.sourceDocumentId) ?? null,
      })),
    measurements: detail.measurements.map((measurement) => ({
      measurement,
      station: stationsById.get(measurement.stationId) ?? null,
      sourceDocument: documentsById.get(measurement.sourceDocumentId) ?? null,
    })),
    supportedFacts: panel.supportedFacts,
    contradictedHypotheses: panel.contradictedHypotheses,
    objects: detail.candidateObjects.map((object) => ({
      object,
      evidenceDocuments: object.evidenceDocumentIds.flatMap((id) => {
        const document = documentsById.get(id)
        return document ? [document] : []
      }),
    })),
    sources: panel.sources,
    corridor: buildCorridor(detail.corridorBounds, stationsById),
    provenance: { rulesetVersion: null, inputHash: null },
  }
}

/** «РГП «Казгидромет», стр. 22» — издатель и страница; null, если документа нет. */
export function measurementSourceLabel(
  row: DossierMeasurementRow,
  t: TFunction
): string | null {
  const { measurement, sourceDocument } = row
  if (!sourceDocument) return null
  return [
    sourceDocument.publisher,
    hasConfirmedPage(sourceDocument, measurement.sourcePage) &&
      `${t("dossier.sourcePagePrefix")} ${measurement.sourcePage}`,
  ]
    .filter((part): part is string => typeof part === "string")
    .join(", ")
}

/**
 * Колонки, значение которых одинаково во всех строках события: их печатают
 * один раз подзаголовком таблицы. null — строки различаются (или значения
 * нет), тогда колонка печатается как есть. Свёртка выводится из данных,
 * а не задаётся списком: у события с разными показателями или датами
 * таблица обязана остаться полной.
 */
export type SharedMeasurementColumns = {
  indicator: string | null
  matrix: string | null
  sampledDate: string | null
  source: string | null
}

function sharedValue(
  rows: DossierMeasurementRow[],
  pick: (row: DossierMeasurementRow) => string | null
): string | null {
  const [first, ...rest] = rows
  if (!first) return null
  const value = pick(first)
  if (value === null) return null
  return rest.every((row) => pick(row) === value) ? value : null
}

export function sharedMeasurementColumns(
  rows: DossierMeasurementRow[],
  locale: Locale,
  t: TFunction
): SharedMeasurementColumns {
  return {
    indicator: sharedValue(rows, (row) => row.measurement.indicator),
    matrix: sharedValue(rows, (row) =>
      t(`matrix.${row.measurement.matrix}`, {
        defaultValue: row.measurement.matrix,
      })
    ),
    sampledDate: sharedValue(rows, (row) =>
      formatSampledDate(row.measurement, locale)
    ),
    source: sharedValue(rows, (row) => measurementSourceLabel(row, t)),
  }
}
