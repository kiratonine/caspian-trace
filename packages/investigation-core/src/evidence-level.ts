import { normalizeIndicatorName } from './normalize'
import type {
  CorridorBounds,
  EvidenceLevel,
  EvidenceStatement,
  InvestigationInput,
} from './types'

export function deriveEvidenceLevel(
  input: InvestigationInput,
  corridor: CorridorBounds | null,
  supported: readonly EvidenceStatement[],
  contradicted: readonly EvidenceStatement[],
): EvidenceLevel {
  if (supported.some(({ code }) => code === 'LOCAL_INCREASE_IN_PAIR') && corridor !== null) {
    return 'L3'
  }
  if (
    corridor !== null &&
    contradicted.some(({ code }) => code === 'MAXIMUM_UPSTREAM_OF_OBJECT')
  ) {
    return 'L2'
  }
  const officialSourceIds = new Set(
    input.sourceDocuments
      .filter(({ official, verified }) => official && verified)
      .map(({ id }) => id),
  )
  const officialSignal = input.signals.some(
    ({ sourceDocumentId, verificationStatus }) =>
      officialSourceIds.has(sourceDocumentId) &&
      (verificationStatus === 'official' ||
        verificationStatus === 'corroborated'),
  )
  const officialMeasurement = input.measurements.some(
    ({ indicator, sourceDocumentId, verified }) =>
      verified &&
      officialSourceIds.has(sourceDocumentId) &&
      normalizeIndicatorName(indicator) ===
        normalizeIndicatorName(input.incident.indicator),
  )
  const corroboratedSourceIds = new Set(
    input.signals
      .filter(({ verificationStatus }) => verificationStatus === 'corroborated')
      .map(({ sourceDocumentId }) => sourceDocumentId),
  )
  const confirmedSignal =
    officialSignal || officialMeasurement || corroboratedSourceIds.size >= 2
  return confirmedSignal ? 'L1' : 'L0'
}
