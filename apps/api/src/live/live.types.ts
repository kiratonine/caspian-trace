import type { SourceHealthStatus } from '../generated/prisma/enums'

export interface LiveHealthRow {
  sourceId: string
  status: SourceHealthStatus
  lastSuccessAt: Date | null
  cacheAvailable: boolean
}
