import {
    SourceHealthStatus,
} from '../../src/generated/prisma/enums'
import { SourceHealthRepository } from '../../src/sources/source-health/source-health.repository'

describe('SourceHealthRepository', () => {
    const sourceHealth = {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
    }

    const transaction = {
        sourceHealth,
    }

    const prisma = {
        sourceHealth,
        $transaction: jest.fn(
            async (
                operation: (
                    client: typeof transaction,
                ) => Promise<void>,
            ): Promise<void> => {
                await operation(transaction)
            },
        ),
    }

    const repository =
        new SourceHealthRepository(
            prisma as never,
        )

    beforeEach(() => {
        jest.clearAllMocks()

        sourceHealth.upsert.mockResolvedValue({
            sourceId: 'gdelt',
        })

        sourceHealth.findUnique.mockResolvedValue(
            null,
        )

        sourceHealth.findMany.mockResolvedValue([])
    })

    it('starts an attempt without resetting prior health fields', async () => {
        const at = new Date(
            '2026-08-06T10:00:00.000Z',
        )

        await repository.startAttempt({
            sourceId: 'gdelt',
            displayName: 'GDELT DOC 2.0',
            at,
        })

        expect(
            sourceHealth.upsert,
        ).toHaveBeenCalledWith({
            where: {
                sourceId: 'gdelt',
            },
            create: {
                sourceId: 'gdelt',
                displayName: 'GDELT DOC 2.0',
                status:
                    SourceHealthStatus.NEVER_RUN,
                lastAttemptAt: at,
            },
            update: {
                displayName: 'GDELT DOC 2.0',
                lastAttemptAt: at,
            },
            select: {
                sourceId: true,
            },
        })
    })

    it('merges metadata and resets consecutive errors on success', async () => {
        const at = new Date(
            '2026-08-06T10:01:00.000Z',
        )

        sourceHealth.findUnique.mockResolvedValueOnce({
            metadata: {
                lastRunId: 'old-run',
                retained: true,
            },
            consecutiveErrors: 2,
        })

        await repository.transition({
            sourceId: 'gdelt',
            displayName: 'GDELT DOC 2.0',
            at,
            status: SourceHealthStatus.HEALTHY,
            lastHttpStatus: 200,
            cacheAvailable: true,
            detail: null,
            actualError: false,
            success: true,
            metadata: {
                lastRunId: 'new-run',
                originFresh: true,
            },
        })

        expect(
            sourceHealth.upsert,
        ).toHaveBeenCalledWith({
            where: {
                sourceId: 'gdelt',
            },
            create: {
                sourceId: 'gdelt',
                displayName: 'GDELT DOC 2.0',
                status: SourceHealthStatus.HEALTHY,
                lastAttemptAt: at,
                lastSuccessAt: at,
                lastHttpStatus: 200,
                cacheAvailable: true,
                consecutiveErrors: 0,
                detail: null,
                metadata: {
                    lastRunId: 'new-run',
                    retained: true,
                    originFresh: true,
                },
            },
            update: {
                displayName: 'GDELT DOC 2.0',
                status: SourceHealthStatus.HEALTHY,
                lastAttemptAt: at,
                lastSuccessAt: at,
                lastHttpStatus: 200,
                cacheAvailable: true,
                consecutiveErrors: 0,
                detail: null,
                metadata: {
                    lastRunId: 'new-run',
                    retained: true,
                    originFresh: true,
                },
            },
            select: {
                sourceId: true,
            },
        })
    })

    it('increments consecutive errors without overwriting lastSuccessAt', async () => {
        const at = new Date(
            '2026-08-06T10:02:00.000Z',
        )

        sourceHealth.findUnique.mockResolvedValueOnce({
            metadata: {
                lastRunId: 'old-run',
            },
            consecutiveErrors: 2,
        })

        await repository.transition({
            sourceId: 'direct-sources',
            displayName:
                'Прямые публичные источники',
            at,
            status: SourceHealthStatus.FAILED,
            lastHttpStatus: 503,
            cacheAvailable: false,
            detail:
                'DIRECT_SOURCE_INGESTION_FAILED: Upstream failed',
            actualError: true,
            success: false,
            metadata: {
                lastRunId: 'failed-run',
            },
        })

        expect(
            sourceHealth.upsert,
        ).toHaveBeenCalledWith({
            where: {
                sourceId: 'direct-sources',
            },
            create: {
                sourceId: 'direct-sources',
                displayName:
                    'Прямые публичные источники',
                status: SourceHealthStatus.FAILED,
                lastAttemptAt: at,
                lastSuccessAt: null,
                lastHttpStatus: 503,
                cacheAvailable: false,
                consecutiveErrors: 3,
                detail:
                    'DIRECT_SOURCE_INGESTION_FAILED: Upstream failed',
                metadata: {
                    lastRunId: 'failed-run',
                },
            },
            update: {
                displayName:
                    'Прямые публичные источники',
                status: SourceHealthStatus.FAILED,
                lastAttemptAt: at,
                lastHttpStatus: 503,
                cacheAvailable: false,
                consecutiveErrors: 3,
                detail:
                    'DIRECT_SOURCE_INGESTION_FAILED: Upstream failed',
                metadata: {
                    lastRunId: 'failed-run',
                },
            },
            select: {
                sourceId: true,
            },
        })
    })

    it('can record a usable cached response while retaining an error status', async () => {
        const at = new Date(
            '2026-08-06T10:03:00.000Z',
        )

        sourceHealth.findUnique.mockResolvedValueOnce({
            metadata: {
                previous: true,
            },
            consecutiveErrors: 1,
        })

        await repository.transition({
            sourceId: 'gdelt',
            displayName: 'GDELT DOC 2.0',
            at,
            status:
                SourceHealthStatus.RATE_LIMITED,
            lastHttpStatus: 429,
            cacheAvailable: true,
            detail:
                'GDELT_RATE_LIMITED: Cached response was used',
            actualError: true,
            success: true,
            metadata: {
                cacheStatus: 'stale',
            },
        })

        expect(
            sourceHealth.upsert,
        ).toHaveBeenCalledWith({
            where: {
                sourceId: 'gdelt',
            },
            create: {
                sourceId: 'gdelt',
                displayName: 'GDELT DOC 2.0',
                status:
                    SourceHealthStatus.RATE_LIMITED,
                lastAttemptAt: at,
                lastSuccessAt: at,
                lastHttpStatus: 429,
                cacheAvailable: true,
                consecutiveErrors: 2,
                detail:
                    'GDELT_RATE_LIMITED: Cached response was used',
                metadata: {
                    previous: true,
                    cacheStatus: 'stale',
                },
            },
            update: {
                displayName: 'GDELT DOC 2.0',
                status:
                    SourceHealthStatus.RATE_LIMITED,
                lastAttemptAt: at,
                lastSuccessAt: at,
                lastHttpStatus: 429,
                cacheAvailable: true,
                consecutiveErrors: 2,
                detail:
                    'GDELT_RATE_LIMITED: Cached response was used',
                metadata: {
                    previous: true,
                    cacheStatus: 'stale',
                },
            },
            select: {
                sourceId: true,
            },
        })
    })

    it('uses an explicit select when reading registered sources', async () => {
        await repository.findAll([
            'kazhydromet',
            'gdelt',
            'direct-sources',
        ])

        expect(
            sourceHealth.findMany,
        ).toHaveBeenCalledWith({
            where: {
                sourceId: {
                    in: [
                        'kazhydromet',
                        'gdelt',
                        'direct-sources',
                    ],
                },
            },
            select: {
                sourceId: true,
                status: true,
                lastSuccessAt: true,
                cacheAvailable: true,
            },
        })
    })
})
