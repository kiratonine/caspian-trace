import { buildStationGraph, detectCycle } from './station-graph'
import { findEventMaximum } from './intervals'
import type {
  CorridorBounds,
  EvidenceStatement,
  InvestigationInput,
  IntervalEvaluation,
  ObjectDisposition,
} from './types'

export function deriveCorridor(
  input: InvestigationInput,
  intervals: readonly IntervalEvaluation[],
  contradicted: readonly EvidenceStatement[],
): CorridorBounds | null {
  const increases = intervals.filter(({ direction }) => direction === 'increase')
  const distinctIncreaseBounds = new Map(
    increases.map((increase) => [
      `${increase.upstreamStationId}\u0000${increase.downstreamStationId}`,
      increase,
    ]),
  )
  if (distinctIncreaseBounds.size === 1) {
    const increase = distinctIncreaseBounds.values().next().value
    if (increase === undefined) return null
    return {
      upstreamStationId: increase.upstreamStationId,
      downstreamStationId: increase.downstreamStationId,
    }
  }
  if (distinctIncreaseBounds.size > 1) return null

  const maximum = findEventMaximum(input)
  const spatialExclusion = contradicted.some(
    ({ code, measurementIds }) =>
      code === 'MAXIMUM_UPSTREAM_OF_OBJECT' &&
      maximum !== null &&
      measurementIds.includes(maximum.id),
  )
  if (maximum === null || !spatialExclusion) return null
  const graph = buildStationGraph(input.stationRelations, input.sourceDocuments)
  if (detectCycle(graph) || !graph.nodes.has(maximum.stationId)) return null
  if ((graph.incoming.get(maximum.stationId)?.size ?? 0) > 0) return null
  return { upstreamStationId: null, downstreamStationId: maximum.stationId }
}

export function classifyObjects(
  input: InvestigationInput,
  corridor: CorridorBounds | null,
  contradicted: readonly EvidenceStatement[],
): ObjectDisposition[] {
  return [...input.candidateObjects]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((candidate) => {
      const evidenceId = `evidence-maximum-upstream-${candidate.id}`
      const evidence = contradicted.filter(({ id }) => id === evidenceId)
      const inCorridor =
        corridor !== null &&
        candidate.stationId !== null &&
        (candidate.stationId === corridor.upstreamStationId ||
          candidate.stationId === corridor.downstreamStationId)
      return {
        objectId: candidate.id,
        disposition:
          evidence.length > 0
            ? 'does_not_explain_event'
            : inCorridor
              ? 'in_corridor'
              : 'unknown',
        evidenceStatementIds: evidence.map(({ id }) => id),
      }
    })
}
