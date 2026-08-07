import {
  buildStationGraph,
  detectCycle,
  hasVerifiedRelationProvenance,
  isUpstreamOf,
} from './station-graph'
import type { CorridorBounds, InvestigationInput, InvestigationUnknown } from './types'

export function buildUnknowns(
  input: InvestigationInput,
  corridor: CorridorBounds | null,
): InvestigationUnknown[] {
  const unknowns = [...(input.incident.unknowns ?? [])]
  const graph = buildStationGraph(input.stationRelations, input.sourceDocuments)
  const hasVerifiedRelation = input.stationRelations.some((relation) =>
    hasVerifiedRelationProvenance(relation, input.sourceDocuments),
  )
  if (!hasVerifiedRelation) {
    unknowns.push({
      code: 'STATION_ORDER_UNVERIFIED',
      text: 'Подтверждённый порядок створов отсутствует.',
    })
  } else if (detectCycle(graph)) {
    unknowns.push({
      code: 'STATION_GRAPH_CYCLE',
      text: 'Подтверждённые отношения створов образуют цикл; полный порядок не строится.',
    })
  } else if (!hasCompleteStationOrder(input, graph)) {
    unknowns.push({
      code: 'STATION_ORDER_UNVERIFIED',
      text: 'Подтверждённые связи не задают полный порядок всех створов.',
    })
  }
  if (input.measurements.length === 0) {
    unknowns.push({
      code: 'SYNCHRONOUS_MEASUREMENTS_UNAVAILABLE',
      text: 'Синхронные лабораторные измерения отсутствуют.',
    })
  }
  if (corridor?.upstreamStationId === null) {
    unknowns.push({
      code: 'UPSTREAM_BOUNDARY_UNMEASURED',
      text: 'Нет сопоставимого числового значения на ближайшем подтверждённом вышележащем створе.',
    })
  }
  return deduplicateUnknowns(unknowns)
}

function hasCompleteStationOrder(
  input: InvestigationInput,
  graph: ReturnType<typeof buildStationGraph>,
): boolean {
  const stationIds = input.stations.map(({ id }) => id)
  if (stationIds.some((id) => !graph.nodes.has(id))) return false
  for (let left = 0; left < stationIds.length; left += 1) {
    for (let right = left + 1; right < stationIds.length; right += 1) {
      const a = stationIds[left]
      const b = stationIds[right]
      if (a === undefined || b === undefined) return false
      if (
        isUpstreamOf(a, b, graph) !== true &&
        isUpstreamOf(b, a, graph) !== true
      ) {
        return false
      }
    }
  }
  return true
}

function deduplicateUnknowns(unknowns: InvestigationUnknown[]): InvestigationUnknown[] {
  const seen = new Set<string>()
  return unknowns.filter(({ code }) => {
    if (seen.has(code)) return false
    seen.add(code)
    return true
  })
}
