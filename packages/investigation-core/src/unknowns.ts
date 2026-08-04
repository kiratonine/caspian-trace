import { buildStationGraph, detectCycle } from './station-graph'
import type { CorridorBounds, InvestigationInput, InvestigationUnknown } from './types'

export function buildUnknowns(
  input: InvestigationInput,
  corridor: CorridorBounds | null,
): InvestigationUnknown[] {
  const unknowns = [...(input.incident.unknowns ?? [])]
  const graph = buildStationGraph(input.stationRelations)
  if (input.stationRelations.filter(({ verified }) => verified).length === 0) {
    unknowns.push({
      code: 'STATION_ORDER_UNVERIFIED',
      text: 'Подтверждённый порядок створов отсутствует.',
    })
  } else if (detectCycle(graph)) {
    unknowns.push({
      code: 'STATION_GRAPH_CYCLE',
      text: 'Подтверждённые отношения створов образуют цикл; полный порядок не строится.',
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

function deduplicateUnknowns(unknowns: InvestigationUnknown[]): InvestigationUnknown[] {
  const seen = new Set<string>()
  return unknowns.filter(({ code }) => {
    if (seen.has(code)) return false
    seen.add(code)
    return true
  })
}
