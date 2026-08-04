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
  return DossierSchema.parse({
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
}
