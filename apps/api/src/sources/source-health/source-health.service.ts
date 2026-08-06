import { Injectable } from '@nestjs/common'

import type { Prisma } from '../../generated/prisma/client'
import { SourceHealthStatus } from '../../generated/prisma/enums'
import {
    getSourceHealthDefinition,
    SOURCE_HEALTH_REGISTRY,
    type SourceHealthId,
} from './source-health.constants'
import { SourceHealthRepository } from './source-health.repository'
import type {
    SourceHealthFailureInput,
    SourceHealthRateLimitedInput,
    SourceHealthRow,
    SourceHealthSuccessInput,
} from './source-health.types'

@Injectable()
export class SourceHealthService {
    constructor(
        private readonly repository:
            SourceHealthRepository,
    ) { }

    startAttempt(
        sourceId: SourceHealthId,
        at = new Date(),
    ): Promise<void> {
        const source =
            getSourceHealthDefinition(sourceId)

        return this.repository.startAttempt({
            sourceId,
            displayName: source.displayName,
            at,
        })
    }

    markSuccess(
        sourceId: SourceHealthId,
        input: SourceHealthSuccessInput,
    ): Promise<void> {
        const source =
            getSourceHealthDefinition(sourceId)

        return this.repository.transition({
            sourceId,
            displayName: source.displayName,
            at: input.at,
            status: input.degraded
                ? SourceHealthStatus.DEGRADED
                : SourceHealthStatus.HEALTHY,
            lastHttpStatus: input.lastHttpStatus,
            cacheAvailable: input.cacheAvailable,
            detail: input.detail ?? null,
            actualError: false,
            success: true,
            metadata: input.metadata ?? {},
        })
    }

    markFailure(
        sourceId: SourceHealthId,
        input: SourceHealthFailureInput,
    ): Promise<void> {
        const source =
            getSourceHealthDefinition(sourceId)

        return this.repository.transition({
            sourceId,
            displayName: source.displayName,
            at: input.at,
            status: input.degraded
                ? SourceHealthStatus.DEGRADED
                : SourceHealthStatus.FAILED,
            lastHttpStatus: input.lastHttpStatus,
            cacheAvailable: input.cacheAvailable,
            detail: formatError(input.error),
            actualError: true,
            success: input.success,
            metadata: input.metadata ?? {},
        })
    }

    markRateLimited(
        sourceId: SourceHealthId,
        input: SourceHealthRateLimitedInput,
    ): Promise<void> {
        const source =
            getSourceHealthDefinition(sourceId)

        const metadata: Prisma.InputJsonObject = {
            ...(input.metadata ?? {}),
            ...(input.retryAt
                ? {
                    retryAt: input.retryAt.toISOString(),
                }
                : {}),
        }

        return this.repository.transition({
            sourceId,
            displayName: source.displayName,
            at: input.at,
            status: SourceHealthStatus.RATE_LIMITED,
            lastHttpStatus: input.lastHttpStatus,
            cacheAvailable: input.cacheAvailable,
            detail: formatError(
                input.error ?? {
                    code: 'SOURCE_RATE_LIMITED',
                    message: 'Source is rate limited',
                },
            ),
            actualError: true,
            success: input.success,
            metadata,
        })
    }

    getAll(): Promise<SourceHealthRow[]> {
        return this.repository.findAll(
            SOURCE_HEALTH_REGISTRY.map(
                (source) => source.dbId,
            ),
        )
    }
}

function formatError(error: {
    code: string
    message: string
}): string {
    return `${error.code}: ${error.message}`
}