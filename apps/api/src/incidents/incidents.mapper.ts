import {
  IncidentDetailSchema,
  IncidentSummarySchema,
  type CandidateObject,
  type EvidenceLevel,
  type EvidenceStatement,
  type IncidentDetail,
  type IncidentSignal,
  type IncidentSummary,
  type Measurement,
  type SourceDocument,
  type Station,
} from '@caspian-trace/contracts'

import {
  CorridorKind,
  EvidenceGeneratedBy,
  EvidenceKind,
  EvidenceLevel as PrismaEvidenceLevel,
  ExtractionMode,
  SourceDocumentStatus,
  VerificationStatus,
} from '../generated/prisma/enums'
import { IncidentDataInvalidError } from './incidents.errors'
import type {
  IncidentDetailRow,
  IncidentSummaryRow,
} from './incidents.types'

type DetailMeasurementRow = IncidentDetailRow['measurements'][number]['measurement']
type DetailSignalRow = IncidentDetailRow['incident']['signals'][number]['signal']
type DetailStatementRow = IncidentDetailRow['evidenceStatements'][number]
type DetailSourceRow = DetailMeasurementRow['sourceDocument']
type DetailStationRow = DetailMeasurementRow['station']
type DetailCandidateRow =
  IncidentDetailRow['candidateObjects'][number]['candidateObject']

export function mapIncidentSummary(row: IncidentSummaryRow): IncidentSummary {
  const measurements = row.measurements.map(({ measurement }) => measurement)
  const result: IncidentSummary = {
    id: row.id,
    title: requireText(row.incident.title),
    region: mapRegion(row.incident.region),
    evidenceLevel: mapEvidenceLevel(row.evidenceLevel),
    indicator: resolveIndicator(row.incident.indicator, measurements),
    updatedAt: row.generatedAt.toISOString(),
    period: resolvePeriod(measurements),
  }
  if (!IncidentSummarySchema.safeParse(result).success) invalidData()
  return result
}

export function mapIncidentDetail(row: IncidentDetailRow): IncidentDetail {
  const signals = row.incident.signals
    .map(({ signal }) => mapSignal(signal))
    .sort(compareSignals)
  const measurements = row.measurements
    .map(({ measurement }) => mapMeasurement(measurement))
    .sort((left, right) => compareMeasurements(left, right, row))
  const statements = row.evidenceStatements.map(mapStatement)
  const candidateObjects = row.candidateObjects
    .map(({ candidateObject }) => mapCandidateObject(candidateObject))
    .sort((left, right) => compareText(left.id, right.id))
  const stations = collectStations(row)
  const corridorBounds = mapCorridorBounds(row)
  const sourceDocuments = collectSourceDocuments(row)
  const unknowns = stableUnique([
    ...row.evidenceStatements
      .filter(
        ({ kind }) =>
          kind === EvidenceKind.LIMITS || kind === EvidenceKind.UNKNOWN,
      )
      .map(({ text }) => requireText(text)),
    ...row.unknowns.map(({ text }) => requireText(text)),
  ])
  const indicator = resolveIndicator(
    row.incident.indicator,
    row.measurements.map(({ measurement }) => measurement),
  )

  const result: IncidentDetail = {
    investigation: {
      id: row.id,
      title: requireText(row.incident.title),
      signalIds: stableUnique(signals.map(({ id }) => id)).sort(compareText),
      indicator,
      evidenceLevel: mapEvidenceLevel(row.evidenceLevel),
      corridor: null,
      supportedFacts: statements.filter(({ kind }) => kind === 'supports'),
      contradictedHypotheses: statements.filter(
        ({ kind }) => kind === 'contradicts',
      ),
      unknowns,
      conclusion: requireText(row.conclusion),
      updatedAt: row.generatedAt.toISOString(),
    },
    region: mapRegion(row.incident.region),
    signals,
    measurements,
    stations,
    candidateObjects,
    sourceDocuments,
    corridorBounds,
  }

  if (!IncidentDetailSchema.safeParse(result).success) invalidData()
  return result
}

function mapSignal(row: DetailSignalRow): IncidentSignal {
  return {
    id: row.id,
    title: requireText(row.title),
    observedAt: row.observedAt?.toISOString() ?? null,
    observedPeriod: row.observedPeriod,
    reportedAt: row.reportedAt.toISOString(),
    location: mapLocation(row.latitude, row.longitude),
    locationText: requireText(row.locationText),
    phenomenon: mapPhenomenon(row.phenomenon),
    excerpt: requireText(row.excerpt),
    sourceDocumentId: row.sourceDocumentId,
    extractionMode: mapExtractionMode(row.extractionMode),
    verificationStatus: mapVerificationStatus(row.verificationStatus),
  }
}

function mapMeasurement(row: DetailMeasurementRow): Measurement {
  return {
    id: row.id,
    stationId: row.stationId,
    sampledAt: row.sampledAt?.toISOString() ?? null,
    sampledPeriod: row.sampledPeriod,
    indicator: requireText(row.indicator),
    value: decimalToFiniteNumber(row.value),
    rawValueText: requireText(row.rawValueText),
    unit: mapUnit(row.unit),
    matrix: mapMatrix(row.matrix),
    qualityClass: null,
    sourceDocumentId: row.sourceDocumentId,
    sourcePage: row.sourcePage?.pageNumber ?? metadataSourcePage(row.metadata),
    sourceExcerpt: row.sourceExcerpt,
    verified: row.verificationStatus === VerificationStatus.OFFICIAL,
  }
}

function mapStatement(row: DetailStatementRow): EvidenceStatement {
  const statement: EvidenceStatement = {
    id: row.id,
    code: requireText(row.code),
    sortOrder: row.sortOrder,
    kind: mapEvidenceKind(row.kind),
    text: requireText(row.text),
    measurementIds: stableUnique(
      row.measurements.map(({ measurementId }) => measurementId),
    ).sort(compareText),
    sourceDocumentIds: stableUnique(
      row.sources.map(({ sourceDocumentId }) => sourceDocumentId),
    ).sort(compareText),
    generatedBy: mapEvidenceGeneratedBy(row.generatedBy),
  }
  if (
    statement.kind !== 'unknown' &&
    statement.sourceDocumentIds.length === 0
  ) {
    invalidData()
  }
  return statement
}

function mapCandidateObject(row: DetailCandidateRow): CandidateObject {
  const evidenceDocumentIds = stableUnique(
    row.sources.map(({ sourceDocumentId }) => sourceDocumentId),
  ).sort(compareText)
  if (evidenceDocumentIds.length === 0) invalidData()
  return {
    id: row.id,
    name: requireText(row.name),
    category: requireText(row.objectType),
    location: mapLocation(row.latitude, row.longitude),
    waterBody: metadataString(row.metadata, 'waterBody'),
    riverOrder: metadataNonnegativeInteger(row.metadata, 'riverOrder'),
    evidenceDocumentIds,
    completeness:
      row.verificationStatus === VerificationStatus.OFFICIAL
        ? 'confirmed'
        : 'partial',
  }
}

function mapStation(row: DetailStationRow): Station {
  return {
    id: row.id,
    name: requireText(row.name),
    waterBody: requireText(row.waterBody),
    location: mapLocation(row.latitude, row.longitude),
    riverOrder: row.riverOrder,
    relationType: 'neutral',
    relatedObjectId: null,
    locationSourceDocumentId: row.locationSourceDocumentId,
  }
}

function mapSourceDocument(row: DetailSourceRow): SourceDocument {
  return {
    id: row.id,
    title: requireText(row.title),
    publisher: requireText(row.publisher),
    url: row.originalUrl,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    fetchedAt: row.fetchedAt?.toISOString() ?? null,
    contentType: mapMediaType(row.mediaType),
    sha256: row.sha256,
    cachePath: row.cachePath,
    status: mapSourceStatus(row.status),
  }
}

function collectStations(row: IncidentDetailRow): Station[] {
  const byId = new Map<string, DetailStationRow>()
  for (const { measurement } of row.measurements) {
    byId.set(measurement.station.id, measurement.station)
  }
  if (row.upstreamStation) byId.set(row.upstreamStation.id, row.upstreamStation)
  if (row.downstreamStation) {
    byId.set(row.downstreamStation.id, row.downstreamStation)
  }
  return [...byId.values()]
    .map(mapStation)
    .sort((left, right) => {
      const order = compareNullableOrder(left.riverOrder, right.riverOrder)
      return (
        order || compareText(left.name, right.name) || compareText(left.id, right.id)
      )
    })
}

function collectSourceDocuments(row: IncidentDetailRow): SourceDocument[] {
  const byId = new Map<string, DetailSourceRow>()
  for (const { signal } of row.incident.signals) {
    byId.set(signal.sourceDocument.id, signal.sourceDocument)
  }
  for (const { measurement } of row.measurements) {
    byId.set(measurement.sourceDocument.id, measurement.sourceDocument)
  }
  for (const statement of row.evidenceStatements) {
    for (const { sourceDocument } of statement.sources) {
      byId.set(sourceDocument.id, sourceDocument)
    }
  }
  for (const { candidateObject } of row.candidateObjects) {
    for (const { sourceDocument } of candidateObject.sources) {
      byId.set(sourceDocument.id, sourceDocument)
    }
  }
  return [...byId.values()]
    .sort((left, right) => compareText(left.id, right.id))
    .map(mapSourceDocument)
}

function mapCorridorBounds(
  row: IncidentDetailRow,
): IncidentDetail['corridorBounds'] {
  switch (row.corridorKind) {
    case CorridorKind.NONE:
      if (row.upstreamStationId !== null || row.downstreamStationId !== null) {
        invalidData()
      }
      return null
    case CorridorKind.BETWEEN_STATIONS:
      if (
        row.upstreamStationId === null ||
        row.downstreamStationId === null ||
        row.upstreamStationId === row.downstreamStationId
      ) {
        invalidData()
      }
      return {
        upstreamStationId: row.upstreamStationId,
        downstreamStationId: row.downstreamStationId,
      }
    case CorridorKind.OPEN_UPSTREAM:
      if (row.upstreamStationId !== null || row.downstreamStationId === null) {
        invalidData()
      }
      return {
        upstreamStationId: null,
        downstreamStationId: row.downstreamStationId,
      }
    case CorridorKind.OPEN_DOWNSTREAM:
      invalidData()
  }
}

function resolveIndicator(
  incidentIndicator: string | null,
  measurements: ReadonlyArray<{ indicator: string }>,
): string {
  if (incidentIndicator !== null && incidentIndicator.trim().length > 0) {
    return incidentIndicator
  }
  const indicators = stableUnique(
    measurements
      .map(({ indicator }) => indicator)
      .filter((indicator) => indicator.trim().length > 0),
  )
  return indicators.length === 1 ? indicators[0]! : 'не определён'
}

function resolvePeriod(
  measurements: ReadonlyArray<{
    sampledAt: Date | null
    sampledPeriod: string | null
  }>,
): string | null {
  const periods = stableUnique(
    measurements.flatMap(({ sampledAt, sampledPeriod }) => {
      if (sampledPeriod !== null) return [sampledPeriod]
      return sampledAt ? [sampledAt.toISOString().slice(0, 7)] : []
    }),
  )
  return periods.length === 1 ? periods[0]! : null
}

function compareSignals(left: IncidentSignal, right: IncidentSignal): number {
  return (
    left.reportedAt.localeCompare(right.reportedAt) ||
    compareText(left.id, right.id)
  )
}

function compareMeasurements(
  left: Measurement,
  right: Measurement,
  row: IncidentDetailRow,
): number {
  const leftStation = stationForMeasurement(row, left.stationId)
  const rightStation = stationForMeasurement(row, right.stationId)
  return (
    measurementTimeKey(left).localeCompare(measurementTimeKey(right)) ||
    compareNullableOrder(leftStation.riverOrder, rightStation.riverOrder) ||
    compareText(leftStation.name, rightStation.name) ||
    compareText(left.id, right.id)
  )
}

function stationForMeasurement(
  row: IncidentDetailRow,
  stationId: string,
): DetailStationRow {
  const link = row.measurements.find(
    ({ measurement }) => measurement.stationId === stationId,
  )
  if (!link) invalidData()
  return link.measurement.station
}

function measurementTimeKey(measurement: Measurement): string {
  return measurement.sampledPeriod ?? measurement.sampledAt ?? ''
}

function compareNullableOrder(left: number | null, right: number | null): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  return left - right
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function stableUnique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function metadataSourcePage(value: unknown): number | null {
  if (!isJsonObject(value) || !Object.hasOwn(value, 'sourcePage')) return null
  const sourcePage = value.sourcePage
  if (sourcePage === null) return null
  if (typeof sourcePage === 'number' && Number.isInteger(sourcePage) && sourcePage > 0) {
    return sourcePage
  }
  invalidData()
}

function metadataString(value: unknown, key: string): string | null {
  if (!isJsonObject(value)) return null
  const candidate = value[key]
  return typeof candidate === 'string' && candidate.trim().length > 0
    ? candidate
    : null
}

function metadataNonnegativeInteger(value: unknown, key: string): number | null {
  if (!isJsonObject(value)) return null
  const candidate = value[key]
  return typeof candidate === 'number' &&
    Number.isInteger(candidate) &&
    candidate >= 0
    ? candidate
    : null
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireText(value: string | null): string {
  if (value === null || value.trim().length === 0) invalidData()
  return value
}

function decimalToFiniteNumber(value: { toString(): string }): number {
  const parsed = Number(value.toString())
  if (!Number.isFinite(parsed)) invalidData()
  return parsed
}

function mapLocation(
  latitude: { toString(): string } | null,
  longitude: { toString(): string } | null,
): { lat: number; lon: number } | null {
  if (latitude === null && longitude === null) return null
  if (latitude === null || longitude === null) invalidData()
  const lat = decimalToFiniteNumber(latitude)
  const lon = decimalToFiniteNumber(longitude)
  if (
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180 ||
    (lat === 0 && lon === 0)
  ) {
    invalidData()
  }
  return { lat, lon }
}

function mapRegion(value: 'ATYRAU' | 'MANGYSTAU'): IncidentSummary['region'] {
  return value === 'ATYRAU' ? 'atyrau' : 'mangystau'
}

function mapEvidenceLevel(value: PrismaEvidenceLevel): EvidenceLevel {
  switch (value) {
    case PrismaEvidenceLevel.L0:
      return 'L0'
    case PrismaEvidenceLevel.L1:
      return 'L1'
    case PrismaEvidenceLevel.L2:
      return 'L2'
    case PrismaEvidenceLevel.L3:
      return 'L3'
  }
}

function mapExtractionMode(value: ExtractionMode): IncidentSignal['extractionMode'] {
  switch (value) {
    case ExtractionMode.LLM_VERIFIED:
      return 'llm_verified'
    case ExtractionMode.RULE:
      return 'rule'
    case ExtractionMode.VERIFIED_SEED:
      return 'verified_seed'
  }
}

function mapVerificationStatus(
  value: VerificationStatus,
): IncidentSignal['verificationStatus'] {
  switch (value) {
    case VerificationStatus.UNVERIFIED:
      return 'unverified'
    case VerificationStatus.CORROBORATED:
      return 'corroborated'
    case VerificationStatus.OFFICIAL:
      return 'official'
    case VerificationStatus.CONFLICTING:
      return 'conflicting'
  }
}

function mapPhenomenon(value: string): IncidentSignal['phenomenon'] {
  switch (value) {
    case 'oil_film':
    case 'color_change':
    case 'odor':
    case 'fish_kill':
    case 'wastewater':
    case 'other':
      return value
    default:
      invalidData()
  }
}

function mapUnit(value: string): Measurement['unit'] {
  switch (value) {
    case 'mg/dm3':
    case 'mg/kg':
    case 'percent':
      return value
    default:
      invalidData()
  }
}

function mapMatrix(value: string): Measurement['matrix'] {
  switch (value) {
    case 'water':
    case 'sediment':
      return value
    default:
      invalidData()
  }
}

function mapEvidenceKind(value: EvidenceKind): EvidenceStatement['kind'] {
  switch (value) {
    case EvidenceKind.SUPPORTS:
      return 'supports'
    case EvidenceKind.CONTRADICTS:
      return 'contradicts'
    case EvidenceKind.LIMITS:
      return 'limits'
    case EvidenceKind.UNKNOWN:
      return 'unknown'
  }
}

function mapEvidenceGeneratedBy(
  value: EvidenceGeneratedBy,
): EvidenceStatement['generatedBy'] {
  switch (value) {
    case EvidenceGeneratedBy.RULE_ENGINE:
      return 'rule_engine'
    case EvidenceGeneratedBy.HUMAN_VERIFIED:
      return 'human_verified'
  }
}

function mapMediaType(value: string): SourceDocument['contentType'] {
  switch (value.toLowerCase()) {
    case 'application/pdf':
    case 'pdf':
      return 'pdf'
    case 'text/html':
    case 'html':
      return 'html'
    case 'application/json':
    case 'json':
      return 'json'
    default:
      invalidData()
  }
}

function mapSourceStatus(
  value: SourceDocumentStatus,
): SourceDocument['status'] {
  switch (value) {
    case SourceDocumentStatus.UNVERIFIED:
      return 'unverified'
    case SourceDocumentStatus.VERIFIED:
      return 'verified'
    case SourceDocumentStatus.UNAVAILABLE:
      return 'unavailable'
  }
}

function invalidData(): never {
  throw new IncidentDataInvalidError()
}
