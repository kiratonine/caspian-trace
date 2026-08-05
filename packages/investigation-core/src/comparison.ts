import { ExactDecimal } from './decimal'
import { normalizeIndicatorName, normalizeMatrix, normalizeUnit } from './normalize'
import type {
  ComparisonReason,
  ComparisonResult,
  MeasurementFact,
  SourceDocumentFact,
} from './types'

export function areMeasurementsComparable(
  upstream: MeasurementFact,
  downstream: MeasurementFact,
  options: {
    relationVerified: boolean
    sourceDocuments: readonly SourceDocumentFact[]
  },
): ComparisonResult {
  const reasons: ComparisonReason[] = []
  if (normalizeIndicatorName(upstream.indicator) !== normalizeIndicatorName(downstream.indicator)) {
    reasons.push('INDICATOR_MISMATCH')
  }
  if (normalizeMatrix(upstream.matrix) !== normalizeMatrix(downstream.matrix)) {
    reasons.push('MATRIX_MISMATCH')
  }
  if (normalizeUnit(upstream.unit) !== normalizeUnit(downstream.unit)) {
    reasons.push('UNIT_MISMATCH')
  }
  if (!timesAreCompatible(upstream, downstream)) reasons.push('TIME_MISMATCH')
  if (!options.relationVerified) reasons.push('RELATION_UNVERIFIED')
  if (!isOfficial(upstream, options.sourceDocuments) || !isOfficial(downstream, options.sourceDocuments)) {
    reasons.push('SOURCE_NOT_OFFICIAL')
  }
  return reasons.length === 0 ? { comparable: true } : { comparable: false, reasons }
}

export function computePairedDelta(
  upstream: MeasurementFact,
  downstream: MeasurementFact,
): ExactDecimal {
  return ExactDecimal.parse(downstream.value).subtract(ExactDecimal.parse(upstream.value))
}

function timesAreCompatible(a: MeasurementFact, b: MeasurementFact): boolean {
  const aPeriod = a.sampledPeriod ?? a.sampledAt?.slice(0, 7) ?? null
  const bPeriod = b.sampledPeriod ?? b.sampledAt?.slice(0, 7) ?? null
  if (a.sampledAt !== null && b.sampledAt !== null) return a.sampledAt === b.sampledAt
  return aPeriod !== null && aPeriod === bPeriod
}

function isOfficial(
  measurement: MeasurementFact,
  sources: readonly SourceDocumentFact[],
): boolean {
  const source = sources.find(({ id }) => id === measurement.sourceDocumentId)
  return measurement.verified && source?.official === true && source.verified
}
