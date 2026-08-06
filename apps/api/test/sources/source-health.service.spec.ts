import {
    SourceHealthStatus,
} from '../../src/generated/prisma/enums'
import { SourceHealthService } from '../../src/sources/source-health/source-health.service'

describe('SourceHealthService', () => {
    const repository = {
        startAttempt: jest.fn(),
        transition: jest.fn(),
        findAll: jest.fn(),
    }

    const service = new SourceHealthService(
        repository as never,
    )

    beforeEach(() => {
        jest.clearAllMocks()

        repository.startAttempt.mockResolvedValue(
            undefined,
        )
        repository.transition.mockResolvedValue(
            undefined,
        )
        repository.findAll.mockResolvedValue([])
    })

    it('starts an attempt using the registered source name', async () => {
        const at = new Date(
            '2026-08-06T12:00:00.000Z',
        )

        await service.startAttempt('gdelt', at)

        expect(
            repository.startAttempt,
        ).toHaveBeenCalledWith({
            sourceId: 'gdelt',
            displayName: 'GDELT DOC 2.0',
            at,
        })
    })

    it('marks a healthy success and resets error state', async () => {
        const at = new Date(
            '2026-08-06T12:01:00.000Z',
        )

        await service.markSuccess('kazhydromet', {
            at,
            lastHttpStatus: 200,
            cacheAvailable: true,
            metadata: {
                lastRunId: 'run-1',
            },
        })

        expect(
            repository.transition,
        ).toHaveBeenCalledWith({
            sourceId: 'kazhydromet',
            displayName:
                'Казгидромет: ежемесячные бюллетени',
            at,
            status: SourceHealthStatus.HEALTHY,
            lastHttpStatus: 200,
            cacheAvailable: true,
            detail: null,
            actualError: false,
            success: true,
            metadata: {
                lastRunId: 'run-1',
            },
        })
    })

    it('supports a usable but degraded success', async () => {
        const at = new Date(
            '2026-08-06T12:02:00.000Z',
        )

        await service.markSuccess(
            'direct-sources',
            {
                at,
                degraded: true,
                lastHttpStatus: 200,
                cacheAvailable: true,
                detail:
                    'Cached response was used',
            },
        )

        expect(
            repository.transition,
        ).toHaveBeenCalledWith({
            sourceId: 'direct-sources',
            displayName:
                'Прямые публичные источники',
            at,
            status: SourceHealthStatus.DEGRADED,
            lastHttpStatus: 200,
            cacheAvailable: true,
            detail:
                'Cached response was used',
            actualError: false,
            success: true,
            metadata: {},
        })
    })

    it('marks a failed source without losing a usable success flag', async () => {
        const at = new Date(
            '2026-08-06T12:03:00.000Z',
        )

        await service.markFailure('gdelt', {
            at,
            degraded: true,
            success: true,
            lastHttpStatus: 503,
            cacheAvailable: true,
            error: {
                code: 'GDELT_UPSTREAM_DEGRADED',
                message:
                    'Cached response was used',
            },
        })

        expect(
            repository.transition,
        ).toHaveBeenCalledWith({
            sourceId: 'gdelt',
            displayName: 'GDELT DOC 2.0',
            at,
            status: SourceHealthStatus.DEGRADED,
            lastHttpStatus: 503,
            cacheAvailable: true,
            detail:
                'GDELT_UPSTREAM_DEGRADED: Cached response was used',
            actualError: true,
            success: true,
            metadata: {},
        })
    })

    it('marks rate limiting and stores retryAt only in metadata', async () => {
        const at = new Date(
            '2026-08-06T12:04:00.000Z',
        )
        const retryAt = new Date(
            '2026-08-06T12:09:00.000Z',
        )

        await service.markRateLimited('gdelt', {
            at,
            retryAt,
            success: false,
            lastHttpStatus: 429,
            cacheAvailable: false,
            metadata: {
                lastRunId: 'run-2',
            },
            error: {
                code: 'GDELT_RATE_LIMITED',
                message:
                    'GDELT source is rate limited',
            },
        })

        expect(
            repository.transition,
        ).toHaveBeenCalledWith({
            sourceId: 'gdelt',
            displayName: 'GDELT DOC 2.0',
            at,
            status:
                SourceHealthStatus.RATE_LIMITED,
            lastHttpStatus: 429,
            cacheAvailable: false,
            detail:
                'GDELT_RATE_LIMITED: GDELT source is rate limited',
            actualError: true,
            success: false,
            metadata: {
                lastRunId: 'run-2',
                retryAt:
                    '2026-08-06T12:09:00.000Z',
            },
        })
    })

    it('reads only the three registered source IDs', async () => {
        await service.getAll()

        expect(
            repository.findAll,
        ).toHaveBeenCalledWith([
            'kazhydromet',
            'gdelt',
            'direct-sources',
        ])
    })
})