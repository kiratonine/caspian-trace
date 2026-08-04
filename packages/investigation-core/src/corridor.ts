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
  const increase = intervals.find(({ direction }) => direction === 'increase')
  if (increase !== undefined) {
    return {
      upstreamStationId: increase.upstreamStationId,
      downstreamStationId: increase.downstreamStationId,
    }
  }

  const maximum = findEventMaximum(input)
  if (maximum === null || contradicted.length === 0) return null
  const graph = buildStationGraph(input.stationRelations)
  if (detectCycle(graph) || !graph.nodes.has(maximum.stationId)) return null
  if ((graph.incoming.get(maximum.stationId)?.size ?? 0) > 0) return null
  return { upstreamStationId: null, downstreamStationId: maximum.stationId }
}

export function classifyObjects(
  input: InvestigationInput,
  corridor: CorridorBounds | null,
  contradicted: readonly EvidenceStatement[],
): ObjectDisposition[] {
  return input.candidateObjects.map((candidate) => {
    const evidence = contradicted.filter(({ id }) => id.endsWith(candidate.id))
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
