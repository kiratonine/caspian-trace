import type { SourceHealthItem } from '@caspian-trace/contracts'

import type { SourceHealthStatus } from '../generated/prisma/enums'
import type { LiveHealthRow } from './live.types'

export const LIVE_SOURCE_REGISTRY = [
  { dbId: 'kazhydromet', apiId: 'kazhydromet-bulletins', name: 'Казгидромет: ежемесячные бюллетени' },
  { dbId: 'gdelt', apiId: 'gdelt', name: 'GDELT DOC 2.0' },
  { dbId: 'direct-sources', apiId: 'direct-sources', name: 'Прямые публичные источники' },
] as const

const statusMap: Record<SourceHealthStatus, SourceHealthItem['status']> = {
  NEVER_RUN: 'never_run',
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  RATE_LIMITED: 'rate_limited',
  FAILED: 'failed',
}

export function mapLiveHealth(rows: readonly LiveHealthRow[]): SourceHealthItem[] {
  const byId = new Map(rows.map((row) => [row.sourceId, row]))
  return LIVE_SOURCE_REGISTRY.map((source) => {
    const row = byId.get(source.dbId)
    return {
      id: source.apiId,
      name: source.name,
      lastSuccessAt: row?.lastSuccessAt?.toISOString() ?? null,
      cacheAvailable: row?.cacheAvailable ?? false,
      status: row ? statusMap[row.status] : 'never_run',
    }
  })
}
