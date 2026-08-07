import type {
  SourceHealthItem,
} from '@caspian-trace/contracts'

import type {
  SourceHealthStatus,
} from '../generated/prisma/enums'
import {
  SOURCE_HEALTH_REGISTRY,
} from '../sources/source-health/source-health.constants'
import type {
  SourceHealthRow,
} from '../sources/source-health/source-health.types'

const statusMap: Record<
  SourceHealthStatus,
  SourceHealthItem['status']
> = {
  NEVER_RUN: 'never_run',
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  RATE_LIMITED: 'rate_limited',
  FAILED: 'failed',
}

export function mapLiveHealth(
  rows: readonly SourceHealthRow[],
): SourceHealthItem[] {
  const byId = new Map(
    rows.map((row) => [row.sourceId, row]),
  )

  return SOURCE_HEALTH_REGISTRY.map(
    (source) => {
      const row = byId.get(source.dbId)

      return {
        id: source.apiId,
        name: source.displayName,
        lastSuccessAt:
          row?.lastSuccessAt?.toISOString() ??
          null,
        cacheAvailable:
          row?.cacheAvailable ?? false,
        status: row
          ? statusMap[row.status]
          : 'never_run',
      }
    },
  )
}