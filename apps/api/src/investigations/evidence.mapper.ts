import {
  EvidenceGraphSchema,
  type CandidateObject,
  type EvidenceGraph,
  type EvidenceStatement,
  type IncidentSignal,
  type Measurement,
  type SourceDocument,
} from '@caspian-trace/contracts'
import type {
  EvidenceStatement as CoreEvidenceStatement,
  MeasurementFact,
  CandidateObjectFact,
  IncidentSignalFact,
  SourceDocumentFact,
} from '@caspian-trace/investigation-core'

import type { StoredInvestigation } from './investigation.ports'

export function toEvidenceGraph(stored: StoredInvestigation): EvidenceGraph {
  return EvidenceGraphSchema.parse({
    investigationId: stored.investigationId,
    statements: [
      ...stored.result.supportedFacts,
      ...stored.result.contradictedHypotheses,
    ].map(toEvidenceStatement),
    measurements: stored.input.measurements.map(toMeasurement),
    sourceDocuments: stored.input.sourceDocuments.map(toSourceDocument),
  })
}

export function toIncidentSignal(signal: IncidentSignalFact): IncidentSignal {
  return {
    id: signal.id,
    title: signal.title,
    observedAt: signal.observedAt,
    observedPeriod: signal.observedPeriod,
    reportedAt: signal.reportedAt,
    location: null,
    locationText: signal.locationText,
    phenomenon: signal.phenomenon,
    excerpt: signal.excerpt,
    sourceDocumentId: signal.sourceDocumentId,
    extractionMode: signal.extractionMode,
    verificationStatus: signal.verificationStatus,
  }
}

export function toCandidateObject(candidate: CandidateObjectFact): CandidateObject {
  return {
    id: candidate.id,
    name: candidate.name,
    category: candidate.category,
    location: null,
    waterBody: candidate.waterBody,
    riverOrder: null,
    evidenceDocumentIds: candidate.evidenceDocumentIds,
    completeness: candidate.completeness,
  }
}

export function toEvidenceStatement(statement: CoreEvidenceStatement): EvidenceStatement {
  return {
    id: statement.id,
    kind: statement.kind,
    text: statement.text,
    measurementIds: statement.measurementIds,
    sourceDocumentIds: statement.sourceDocumentIds,
    generatedBy: 'rule_engine',
  }
}

export function toMeasurement(measurement: MeasurementFact): Measurement {
  const value = Number(measurement.value)
  if (!Number.isFinite(value)) throw new Error('DECIMAL_OUT_OF_API_RANGE')
  return {
    id: measurement.id,
    stationId: measurement.stationId,
    sampledAt: measurement.sampledAt,
    sampledPeriod: measurement.sampledPeriod,
    indicator: measurement.indicator,
    value,
    rawValueText: measurement.rawValueText,
    unit: normalizeContractUnit(measurement.unit),
    matrix: normalizeContractMatrix(measurement.matrix),
    qualityClass: null,
    sourceDocumentId: measurement.sourceDocumentId,
    sourcePage: measurement.sourcePage,
    sourceExcerpt: measurement.sourceExcerpt,
    verified: measurement.verified,
  }
}

export function toSourceDocument(source: SourceDocumentFact): SourceDocument {
  return {
    id: source.id,
    title: source.title,
    publisher: source.publisher,
    url: source.url,
    publishedAt: source.publishedAt,
    fetchedAt: source.fetchedAt,
    contentType: source.contentType,
    sha256: source.sha256,
    cachePath: source.cachePath,
    status: source.status,
  }
}

function normalizeContractUnit(value: string): Measurement['unit'] {
  if (value === 'mg/dm3' || value === 'mg/kg' || value === 'percent') return value
  throw new Error(`UNSUPPORTED_API_UNIT:${value}`)
}

function normalizeContractMatrix(value: string): Measurement['matrix'] {
  if (value === 'water' || value === 'sediment') return value
  throw new Error(`UNSUPPORTED_API_MATRIX:${value}`)
}
