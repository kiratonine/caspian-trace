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
  if (corridor !== null && contradicted.length > 0) return 'L2'
  const officialSourceIds = new Set(
    input.sourceDocuments
      .filter(({ official, verified }) => official && verified)
      .map(({ id }) => id),
  )
  const confirmedSignal = input.signals.some(
    ({ sourceDocumentId, verificationStatus }) =>
      officialSourceIds.has(sourceDocumentId) ||
      verificationStatus === 'official' ||
      verificationStatus === 'corroborated',
  )
  return confirmedSignal ? 'L1' : 'L0'
}
