import type { Prisma } from '../../generated/prisma/client'
import type { SourceHealthStatus } from '../../generated/prisma/enums'

import type { SourceHealthId } from './source-health.constants'

export interface SourceHealthRow {
    sourceId: string
    status: SourceHealthStatus
    lastSuccessAt: Date | null
    cacheAvailable: boolean
}

export interface SourceHealthBaseInput {
    at: Date
    lastHttpStatus: number | null
    cacheAvailable: boolean
    metadata?: Prisma.InputJsonObject
}

export interface SourceHealthSuccessInput
    extends SourceHealthBaseInput {
    degraded?: boolean
    detail?: string | null
}

export interface SourceHealthFailureInput
    extends SourceHealthBaseInput {
    degraded: boolean
    success: boolean
    error: {
        code: string
        message: string
    }
}

export interface SourceHealthRateLimitedInput
    extends SourceHealthBaseInput {
    success: boolean
    retryAt?: Date | null
    error?: {
        code: string
        message: string
    }
}

export interface SourceHealthTransitionInput {
    sourceId: SourceHealthId
    displayName: string
    at: Date
    status: SourceHealthStatus
    lastHttpStatus: number | null
    cacheAvailable: boolean
    detail: string | null
    actualError: boolean
    success: boolean
    metadata: Prisma.InputJsonObject
}