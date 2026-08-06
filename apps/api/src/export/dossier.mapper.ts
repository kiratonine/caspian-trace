import { DossierSchema, type Dossier } from '@caspian-trace/contracts'

import {
  toCandidateObject,
  toEvidenceStatement,
  toIncidentSignal,
  toMeasurement,
  toSourceDocument,
} from '../investigations/evidence.mapper'
import type { StoredInvestigation } from '../investigations/investigation.ports'

export function toDossier(stored: StoredInvestigation): Dossier {
  const dossier = DossierSchema.parse({
    title: stored.input.incident.title,
    generatedAt: stored.generatedAt,
    disclaimer:
      'Досье отражает проверенные источники и ограничения данных; оно не устанавливает юридическую ответственность.',
    conclusion: stored.result.conclusion,
    evidenceLevel: stored.result.evidenceLevel,
    signals: stored.input.signals.map(toIncidentSignal),
    measurements: stored.input.measurements.map(toMeasurement),
    supportedFacts: stored.result.supportedFacts.map(toEvidenceStatement),
    contradictedHypotheses:
      stored.result.contradictedHypotheses.map(toEvidenceStatement),
    unknowns: stored.result.unknowns,
    candidateObjects: stored.input.candidateObjects.map(toCandidateObject),
    sources: stored.input.sourceDocuments.map(toSourceDocument),
    inputHash: stored.result.inputHash,
    rulesetVersion: stored.result.rulesetVersion,
  })
  assertDossierReferences(dossier)
  return dossier
}

function assertDossierReferences(dossier: Dossier): void {
  const measurementIds = new Set(dossier.measurements.map(({ id }) => id))
  const sourceIds = new Set(dossier.sources.map(({ id }) => id))
  for (const measurement of dossier.measurements) {
    if (!sourceIds.has(measurement.sourceDocumentId)) {
      throw new Error(`DOSSIER_UNKNOWN_MEASUREMENT_SOURCE:${measurement.id}`)
    }
  }
  for (const statement of [
    ...dossier.supportedFacts,
    ...dossier.contradictedHypotheses,
  ]) {
    if (statement.measurementIds.some((id) => !measurementIds.has(id))) {
      throw new Error(`DOSSIER_UNKNOWN_MEASUREMENT:${statement.id}`)
    }
    if (statement.sourceDocumentIds.some((id) => !sourceIds.has(id))) {
      throw new Error(`DOSSIER_UNKNOWN_SOURCE:${statement.id}`)
    }
  }
  for (const candidate of dossier.candidateObjects) {
    if (candidate.evidenceDocumentIds.some((id) => !sourceIds.has(id))) {
      throw new Error(`DOSSIER_UNKNOWN_CANDIDATE_SOURCE:${candidate.id}`)
    }
  }
}
