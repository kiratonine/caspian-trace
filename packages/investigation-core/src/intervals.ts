import { ExactDecimal } from './decimal'
import { areMeasurementsComparable, computePairedDelta } from './comparison'
import { normalizeIndicatorName } from './normalize'
import { hasVerifiedRelationProvenance } from './station-graph'
import type { InvestigationInput, IntervalEvaluation, MeasurementFact } from './types'

export function findEventMaximum(input: InvestigationInput): MeasurementFact | null {
  const officialSources = new Set(
    input.sourceDocuments
      .filter(({ official, verified }) => official && verified)
      .map(({ id }) => id),
  )
  const candidates = input.measurements.filter(
    (measurement) =>
      measurement.verified &&
      officialSources.has(measurement.sourceDocumentId) &&
      normalizeIndicatorName(measurement.indicator) ===
        normalizeIndicatorName(input.incident.indicator),
  )
  const reference = candidates[0]
  if (reference === undefined) return null
  const containsIncomparableMeasurements = candidates.some(
    (candidate) =>
      !areMeasurementsComparable(reference, candidate, {
        relationVerified: true,
        sourceDocuments: input.sourceDocuments,
      }).comparable,
  )
  if (containsIncomparableMeasurements) return null

  return (
    candidates.sort((a, b) => {
      const comparison = ExactDecimal.parse(b.value).compare(ExactDecimal.parse(a.value))
      return comparison !== 0 ? comparison : a.id.localeCompare(b.id)
    })[0] ?? null
  )
}

export function evaluatePairedIntervals(input: InvestigationInput): IntervalEvaluation[] {
  const evaluations: IntervalEvaluation[] = []
  for (const relation of [...input.stationRelations].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (!relation.comparisonPair) continue
    const upstreamMeasurements = measurementsAt(input, relation.upstreamStationId)
    const downstreamMeasurements = measurementsAt(input, relation.downstreamStationId)
    for (const upstream of upstreamMeasurements) {
      for (const downstream of downstreamMeasurements) {
        const comparison = areMeasurementsComparable(upstream, downstream, {
          relationVerified: hasVerifiedRelationProvenance(
            relation,
            input.sourceDocuments,
          ),
          sourceDocuments: input.sourceDocuments,
        })
        if (!comparison.comparable) continue
        const delta = computePairedDelta(upstream, downstream)
        evaluations.push({
          relationId: relation.id,
          upstreamMeasurementId: upstream.id,
          downstreamMeasurementId: downstream.id,
          upstreamStationId: relation.upstreamStationId,
          downstreamStationId: relation.downstreamStationId,
          delta: delta.toString(),
          direction: delta.compare(ExactDecimal.parse('0')) > 0 ? 'increase' : 'no_increase',
          sourceDocumentIds: [
            ...new Set([
              upstream.sourceDocumentId,
              downstream.sourceDocumentId,
              relation.sourceDocumentId,
            ]),
          ].sort(),
        })
      }
    }
  }
  return evaluations.sort(
    (a, b) =>
      a.relationId.localeCompare(b.relationId) ||
      a.upstreamMeasurementId.localeCompare(b.upstreamMeasurementId) ||
      a.downstreamMeasurementId.localeCompare(b.downstreamMeasurementId),
  )
}

function measurementsAt(input: InvestigationInput, stationId: string): MeasurementFact[] {
  return input.measurements
    .filter(
      ({ stationId: candidateStationId, indicator }) =>
        candidateStationId === stationId &&
        normalizeIndicatorName(indicator) ===
          normalizeIndicatorName(input.incident.indicator),
    )
    .sort((a, b) => a.id.localeCompare(b.id))
}
