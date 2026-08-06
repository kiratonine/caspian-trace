import { SafeFetchError } from '../../../src/common/http/safe-fetch/safe-fetch.errors'
import { findDirectSource } from '../../../src/ingestion/direct-sources/direct-source-registry'
import { GdeltIngestionService, normalizeGdeltRequest } from '../../../src/ingestion/gdelt/gdelt-ingestion.service'
import { createSafeFetchConfig } from '../../safe-fetch/test-environment'
import type { GdeltDiscoveryResult } from '../../../src/ingestion/gdelt/gdelt.types'
import type { RunGdeltIngestionDto } from '../../../src/ingestion/dto/run-gdelt-ingestion.dto'
import { publicIngestionError } from '../../../src/ingestion/ingestion.errors'

const clock = { now: (): Date => new Date('2026-08-06T00:00:00Z') }
const candidate = {
  discoveryMode: 'gdelt' as const,
  originalUrl: 'https://azh.kz/article', discoveryTitle: 'Article', gdeltSeenAt: null,
  gdeltLanguage: null, gdeltSourceCountry: null, requestedRegions: ['atyrau'] as ['atyrau'],
  publisherHost: 'azh.kz', coverage: findDirectSource('azh.kz')!.coverage,
}
const processed = {
  document: {
    sourceDocumentId: 'doc-article-azh-kz-test', discoveryMode: 'gdelt' as const,
    publisher: 'Ак Жайык', title: 'Article', canonicalUrl: 'https://azh.kz/article',
    publishedAt: null, sha256: 'a'.repeat(64), cachePath: 'public_article/2026/08/a.html',
    parserStatus: 'succeeded' as const, relevant: true,
    matchedRequestedRegions: ['atyrau'] as ['atyrau'], coverage: candidate.coverage,
  },
  parserFailed: false, requestedRegionMatched: true,
  sourceStatus: 'healthy' as const, cacheStatus: 'miss' as const, httpStatus: 200,
}

describe('GdeltIngestionService run and health semantics', () => {
  const gdelt = { discover: jest.fn() }
  const directAdapter = { candidates: jest.fn() }
  const directSources = { process: jest.fn() }
  const articles = { process: jest.fn() }
  const repository = {
    createPublicRun: jest.fn(), markPublicHealthAttempt: jest.fn(), finalizeRun: jest.fn(),
    finalizePublicHealth: jest.fn(), hasAcceptedPublicRun: jest.fn(),
  }
  const service = new GdeltIngestionService(
    gdelt as never, directAdapter as never, directSources as never, articles as never,
    repository as never, createSafeFetchConfig(), clock,
  )

  beforeEach(() => {
    jest.clearAllMocks()
    repository.createPublicRun.mockResolvedValue({})
    repository.markPublicHealthAttempt.mockResolvedValue(undefined)
    repository.finalizeRun.mockResolvedValue(undefined)
    repository.finalizePublicHealth.mockResolvedValue(undefined)
    repository.hasAcceptedPublicRun.mockResolvedValue(false)
    gdelt.discover.mockResolvedValue(discovery('healthy', 'miss'))
    articles.process.mockResolvedValue(processed)
    directAdapter.candidates.mockReturnValue([])
    directSources.process.mockResolvedValue({
      accepted: [], rejectedCount: 0, rateLimitedCount: 0, regionMismatchCount: 0,
      irrelevantCount: 0,
      temporalMismatchCount: 0, temporalUnknownCount: 0,
      parserFailureCount: 0, degradedCount: 0,
      successfulFetchCount: 0, lastHttpStatus: null,
    })
  })

  it('marks a healthy bounded GDELT-only run succeeded', async () => {
    await expect(service.run(body())).resolves.toMatchObject({
      status: 'succeeded', gdelt: { status: 'succeeded', acceptedCount: 1 },
      directFallback: { used: false },
    })
    expect(repository.finalizePublicHealth).toHaveBeenCalledWith(expect.objectContaining({
      sourceId: 'gdelt', status: 'HEALTHY', actualError: false,
    }))
  })

  it('processes stale 429 articles but keeps run/health explicitly rate_limited', async () => {
    gdelt.discover.mockResolvedValueOnce(discovery('rate_limited', 'stale'))
    await expect(service.run(body())).resolves.toMatchObject({
      status: 'partial', gdelt: { status: 'rate_limited', sourceStatus: 'rate_limited', acceptedCount: 1 },
    })
    expect(repository.finalizeRun).toHaveBeenCalledWith(expect.objectContaining({
      status: 'RATE_LIMITED', acceptedCount: 1, errorCode: 'GDELT_RATE_LIMITED',
    }))
    expect(repository.finalizePublicHealth).toHaveBeenCalledWith(expect.objectContaining({
      sourceId: 'gdelt', status: 'RATE_LIMITED', success: true, actualError: true,
    }))
  })

  it('runs a separate direct fallback after 429 and never overwrites GDELT health', async () => {
    gdelt.discover.mockRejectedValueOnce(new SafeFetchError({
      code: 'SAFE_FETCH_RATE_LIMITED', safeMessage: 'raw upstream detail',
      sourceStatus: 'rate_limited', retryable: true, statusCode: 429,
    }))
    const directCandidate = { ...candidate, discoveryMode: 'direct_fallback' as const }
    directAdapter.candidates.mockReturnValueOnce([directCandidate])
    directSources.process.mockResolvedValueOnce({
      accepted: [{
        ...processed, document: {
          ...processed.document,
          discoveryMode: 'direct_fallback' as const,
          publishedAt: '2025-09-09T10:16:00.000Z',
        }
      }],
      rejectedCount: 0, rateLimitedCount: 0, regionMismatchCount: 0,
      irrelevantCount: 0,
      temporalMismatchCount: 0, temporalUnknownCount: 0,
      parserFailureCount: 0, degradedCount: 0,
      successfulFetchCount: 1, lastHttpStatus: 200,
    })
    const result = await service.run(body())
    expect(result).toMatchObject({
      status: 'partial', gdelt: { status: 'rate_limited', acceptedCount: 0 },
      directFallback: { used: true, status: 'succeeded', acceptedCount: 1 },
    })
    expect(repository.finalizePublicHealth).toHaveBeenNthCalledWith(1, expect.objectContaining({ sourceId: 'gdelt', status: 'RATE_LIMITED' }))
    expect(repository.finalizePublicHealth).toHaveBeenNthCalledWith(2, expect.objectContaining({ sourceId: 'direct-sources', status: 'HEALTHY' }))
    expect(repository.finalizeRun).not.toHaveBeenCalledWith(expect.objectContaining({ errorMessage: 'raw upstream detail' }))
    expect(directSources.process).toHaveBeenCalledWith(
      [directCandidate],
      expect.any(String),
      { from: new Date('2025-09-01T00:00:00Z'), to: new Date('2025-09-30T23:59:59Z') },
    )
  })

  it('marks mixed direct temporal coverage partial while keeping health healthy and returning only matched', async () => {
    gdelt.discover.mockRejectedValueOnce(new SafeFetchError({
      code: 'SAFE_FETCH_NETWORK_ERROR', safeMessage: 'unavailable', sourceStatus: 'degraded', retryable: true,
    }))
    const directCandidates = [0, 1, 2].map((index) => ({
      ...candidate,
      discoveryMode: 'direct_fallback' as const,
      originalUrl: `https://azh.kz/direct-${index}`,
    }))
    directAdapter.candidates.mockReturnValueOnce(directCandidates)
    const matched = {
      ...processed,
      document: {
        ...processed.document,
        discoveryMode: 'direct_fallback' as const,
        canonicalUrl: directCandidates[0]!.originalUrl,
        publishedAt: '2025-09-09T10:16:00.000Z',
      },
    }
    directSources.process.mockResolvedValueOnce({
      accepted: [matched], rejectedCount: 0, rateLimitedCount: 0, regionMismatchCount: 0,
      irrelevantCount: 0,
      temporalMismatchCount: 1, temporalUnknownCount: 1,
      parserFailureCount: 0, degradedCount: 0,
      successfulFetchCount: 3, lastHttpStatus: 200,
    })

    const result = await service.run({ ...body(), maxArticles: 3 })
    expect(result).toMatchObject({
      directFallback: { used: true, status: 'partial', acceptedCount: 1 },
      documents: [{ canonicalUrl: directCandidates[0]!.originalUrl }],
    })
    expect(repository.finalizeRun).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'PARTIAL', acceptedCount: 1, rejectedCount: 0,
      errorCode: null, errorMessage: null,
    }))
    expect(JSON.stringify(repository.finalizeRun.mock.calls.at(-1))).toContain('"temporalMismatchCount":1')
    expect(JSON.stringify(repository.finalizeRun.mock.calls.at(-1))).toContain('"temporalUnknownCount":1')
    expect(repository.finalizePublicHealth).toHaveBeenLastCalledWith(expect.objectContaining({
      sourceId: 'direct-sources', status: 'HEALTHY', actualError: false, success: true,
    }))
  })

  it('never converts a no-stale 429 to an empty success', async () => {
    gdelt.discover.mockRejectedValueOnce(new SafeFetchError({
      code: 'SAFE_FETCH_RATE_LIMITED', safeMessage: 'raw', sourceStatus: 'rate_limited', retryable: true,
    }))
    await expect(service.run({ ...body(), includeDirectFallback: false })).resolves.toMatchObject({
      status: 'rate_limited', documents: [], gdelt: { status: 'rate_limited' },
    })
  })

  it('does not accept a Mangystau-only GDELT article for an Atyrau request', async () => {
    articles.process.mockResolvedValueOnce({
      ...processed,
      requestedRegionMatched: false,
      document: {
        ...processed.document,
        relevant: false,
        matchedRequestedRegions: [],
      },
    })
    const result = await service.run({ ...body(), includeDirectFallback: false })
    expect(result).toMatchObject({
      status: 'failed', documents: [], gdelt: { acceptedCount: 0 },
    })
    expect(repository.finalizeRun).toHaveBeenCalledWith(expect.objectContaining({
      acceptedCount: 0,
    }))
    expect(JSON.stringify(repository.finalizeRun.mock.calls)).toContain('"regionMismatchCount":1')
  })

  it('marks a schema-invalid GDELT response failed without a successful health update', async () => {
    gdelt.discover.mockRejectedValueOnce(publicIngestionError(
      'GDELT_RESPONSE_INVALID',
      'GDELT response does not match the expected schema',
    ))
    const result = await service.run({ ...body(), includeDirectFallback: false })
    expect(result).toMatchObject({ status: 'failed', gdelt: { acceptedCount: 0 } })
    expect(repository.finalizeRun).toHaveBeenCalledWith(expect.objectContaining({
      status: 'FAILED', errorCode: 'GDELT_RESPONSE_INVALID',
      errorMessage: 'GDELT response does not match the expected schema',
    }))
    expect(repository.finalizePublicHealth).toHaveBeenCalledWith(expect.objectContaining({
      sourceId: 'gdelt', status: 'FAILED', success: false, actualError: true,
    }))
  })

  it('keeps an explicit empty articles response usable but returns no-results failed', async () => {
    gdelt.discover.mockResolvedValueOnce({
      ...discovery('healthy', 'miss'),
      candidates: [],
      discoveredCount: 0,
    })
    await expect(service.run({ ...body(), includeDirectFallback: false })).resolves.toMatchObject({
      status: 'failed', documents: [], gdelt: { acceptedCount: 0, discoveredCount: 0 },
    })
    expect(repository.finalizePublicHealth).toHaveBeenCalledWith(expect.objectContaining({
      sourceId: 'gdelt', status: 'HEALTHY', success: true, actualError: false,
    }))
  })
  it(
    'does not accept a same-region GDELT article without a pollution marker',
    async () => {
      articles.process.mockResolvedValueOnce({
        ...processed,
        document: {
          ...processed.document,
          relevant: false,
        },
      })

      const result = await service.run({
        ...body(),
        includeDirectFallback: false,
      })

      expect(result).toMatchObject({
        status: 'failed',
        documents: [],
        gdelt: {
          acceptedCount: 0,
        },
      })

      expect(
        JSON.stringify(repository.finalizeRun.mock.calls),
      ).toContain('"irrelevantCount":1')
    },
  )
  it(
    'does not accept a GDELT article whose parser failed',
    async () => {
      articles.process.mockResolvedValueOnce({
        ...processed,
        parserFailed: true,
        requestedRegionMatched: null,
        document: {
          ...processed.document,
          parserStatus: 'failed',
          relevant: null,
          matchedRequestedRegions: null,
        },
      })

      const result = await service.run({
        ...body(),
        includeDirectFallback: false,
      })

      expect(result).toMatchObject({
        status: 'failed',
        documents: [],
        gdelt: {
          acceptedCount: 0,
        },
      })

      expect(repository.finalizePublicHealth).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceId: 'gdelt',
          status: 'DEGRADED',
          actualError: true,
        }),
      )

      expect(
        JSON.stringify(repository.finalizeRun.mock.calls),
      ).toContain('"parserFailureCount":1')
    },
  )
})

describe('normalizeGdeltRequest', () => {
  const limits = { now: clock.now(), maxRecords: 25, maxArticles: 10, maxWindowDays: 31 }

  it('normalizes strict Z timestamps and defaults without accepting a query or URL', () => {
    expect(normalizeGdeltRequest(body(), limits)).toMatchObject({
      maxRecords: 25, maxArticles: 1, includeDirectFallback: true, regions: ['atyrau'],
    })
  })

  it.each([
    { ...body(), from: '2025-09-01T00:00:00+00:00' },
    { ...body(), from: '2025-09-30T23:59:59Z', to: '2025-09-01T00:00:00Z' },
    { ...body(), from: '2025-01-01T00:00:00Z' },
    { ...body(), to: '2026-08-06T00:06:00Z' },
    { ...body(), maxRecords: 26 },
    { ...body(), maxRecords: 1, maxArticles: 2 },
  ])('rejects invalid window/bounds %#', (value) => {
    expect(() => normalizeGdeltRequest(value, limits)).toThrow('GDELT ingestion request is invalid')
  })
})

function discovery(sourceStatus: 'healthy' | 'degraded' | 'rate_limited', cacheStatus: 'miss' | 'fresh' | 'stale'): GdeltDiscoveryResult {
  return {
    candidates: [candidate], discoveredCount: 1, invalidCandidateCount: 0, queryHash: 'a'.repeat(64),
    metadata: {
      requestedUrl: 'https://api.gdeltproject.org/api/v2/doc/doc',
      finalUrl: 'https://api.gdeltproject.org/api/v2/doc/doc', statusCode: 200,
      contentType: 'application/json', fetchedAt: '2026-08-06T00:00:00Z', redirects: 0,
      attempts: 1, cacheStatus, sourceStatus,
    },
  }
}

function body(): RunGdeltIngestionDto {
  return {
    from: '2025-09-01T00:00:00Z', to: '2025-09-30T23:59:59Z',
    regions: ['atyrau'] as ['atyrau'], maxRecords: 25, maxArticles: 1, includeDirectFallback: true,
  }
}
