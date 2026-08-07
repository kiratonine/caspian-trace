import {
  StationRelationKind,
  VerificationStatus,
} from '../../src/generated/prisma/enums'

type StationOrderInput = { id: string }

type RelationOrderInput = {
  fromStationId: string
  toStationId: string
  kind: string
  verificationStatus: string
}

const TRUSTED_STATUSES = new Set<string>([
  VerificationStatus.OFFICIAL,
  VerificationStatus.CORROBORATED,
])

/**
 * Derive local topological positions from verified, linear upstream chains.
 * Array order, labels, coordinates and measurements never participate.
 */
export function deriveStationRiverOrder(
  stations: readonly StationOrderInput[],
  relations: readonly RelationOrderInput[],
): Map<string, number | null> {
  const stationIds = new Set(stations.map(({ id }) => id))
  const result = new Map<string, number | null>(
    [...stationIds].map((id) => [id, null] as const),
  )
  const outgoing = new Map<string, Set<string>>()
  const incoming = new Map<string, Set<string>>()
  const adjacent = new Map<string, Set<string>>()

  const ensure = (
    map: Map<string, Set<string>>,
    id: string,
  ): Set<string> => {
    const values = map.get(id) ?? new Set<string>()
    map.set(id, values)
    return values
  }

  for (const relation of relations) {
    if (
      relation.kind !== StationRelationKind.UPSTREAM_OF ||
      !TRUSTED_STATUSES.has(relation.verificationStatus) ||
      !stationIds.has(relation.fromStationId) ||
      !stationIds.has(relation.toStationId)
    ) {
      continue
    }

    ensure(outgoing, relation.fromStationId).add(relation.toStationId)
    ensure(incoming, relation.toStationId).add(relation.fromStationId)
    ensure(adjacent, relation.fromStationId).add(relation.toStationId)
    ensure(adjacent, relation.toStationId).add(relation.fromStationId)
  }

  const visited = new Set<string>()
  for (const first of [...adjacent.keys()].sort()) {
    if (visited.has(first)) continue

    const component = new Set<string>()
    const queue = [first]
    while (queue.length > 0) {
      const current = queue.shift()
      if (!current || component.has(current)) continue
      component.add(current)
      visited.add(current)
      queue.push(...[...(adjacent.get(current) ?? [])].sort())
    }

    const linear = [...component].every(
      (id) =>
        (incoming.get(id)?.size ?? 0) <= 1 &&
        (outgoing.get(id)?.size ?? 0) <= 1,
    )
    const roots = [...component]
      .filter((id) => (incoming.get(id)?.size ?? 0) === 0)
      .sort()
    if (!linear || roots.length !== 1) continue

    const chain: string[] = []
    const chainIds = new Set<string>()
    let current: string | undefined = roots[0]
    while (current !== undefined && !chainIds.has(current)) {
      chain.push(current)
      chainIds.add(current)
      current = [...(outgoing.get(current) ?? [])][0]
    }
    if (chain.length !== component.size || current !== undefined) continue

    chain.forEach((id, order) => result.set(id, order))
  }

  return result
}
