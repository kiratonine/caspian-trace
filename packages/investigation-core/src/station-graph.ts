import type {
  SourceDocumentFact,
  StationGraph,
  StationRelationFact,
} from './types'

export function buildStationGraph(
  relations: readonly StationRelationFact[],
  sourceDocuments?: readonly SourceDocumentFact[],
): StationGraph {
  const outgoing = new Map<string, Set<string>>()
  const incoming = new Map<string, Set<string>>()
  const nodes = new Set<string>()
  for (const relation of relations) {
    if (!hasVerifiedRelationProvenance(relation, sourceDocuments)) continue
    nodes.add(relation.upstreamStationId)
    nodes.add(relation.downstreamStationId)
    addEdge(outgoing, relation.upstreamStationId, relation.downstreamStationId)
    addEdge(incoming, relation.downstreamStationId, relation.upstreamStationId)
    ensureNode(outgoing, relation.downstreamStationId)
    ensureNode(incoming, relation.upstreamStationId)
  }
  return { nodes, outgoing, incoming }
}

export function hasVerifiedRelationProvenance(
  relation: StationRelationFact,
  sourceDocuments?: readonly SourceDocumentFact[],
): boolean {
  const provenance = relation.provenance
  const structurallyVerified = Boolean(
    relation.verified &&
      provenance &&
      relation.sourceDocumentId.trim() &&
      relation.basis.trim() &&
      provenance.fixturePath.trim() &&
      Number.isInteger(provenance.sourcePage) &&
      provenance.sourcePage > 0 &&
      provenance.sourceExcerpt.trim(),
  )
  if (!structurallyVerified || sourceDocuments === undefined) {
    return structurallyVerified
  }
  const source = sourceDocuments.find(({ id }) => id === relation.sourceDocumentId)
  return source?.official === true && source.verified
}

export function detectCycle(graph: StationGraph): boolean {
  return topologicalStationOrder(graph) === null
}

export function topologicalStationOrder(graph: StationGraph): string[] | null {
  const inDegree = new Map<string, number>()
  for (const node of graph.nodes) inDegree.set(node, graph.incoming.get(node)?.size ?? 0)
  const queue = [...graph.nodes].filter((node) => inDegree.get(node) === 0).sort()
  const ordered: string[] = []
  while (queue.length > 0) {
    const node = queue.shift()
    if (node === undefined) break
    ordered.push(node)
    for (const downstream of graph.outgoing.get(node) ?? []) {
      const nextDegree = (inDegree.get(downstream) ?? 0) - 1
      inDegree.set(downstream, nextDegree)
      if (nextDegree === 0) {
        queue.push(downstream)
        queue.sort()
      }
    }
  }
  return ordered.length === graph.nodes.size ? ordered : null
}

export function isUpstreamOf(
  upstreamId: string,
  downstreamId: string,
  graph: StationGraph,
): boolean | null {
  if (!graph.nodes.has(upstreamId) || !graph.nodes.has(downstreamId)) return null
  const visited = new Set<string>()
  const pending = [upstreamId]
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === undefined || visited.has(current)) continue
    visited.add(current)
    for (const next of graph.outgoing.get(current) ?? []) {
      if (next === downstreamId) return true
      pending.push(next)
    }
  }
  return false
}

function addEdge(map: Map<string, Set<string>>, from: string, to: string): void {
  const edges = map.get(from) ?? new Set<string>()
  edges.add(to)
  map.set(from, edges)
}

function ensureNode(map: Map<string, Set<string>>, node: string): void {
  if (!map.has(node)) map.set(node, new Set())
}
