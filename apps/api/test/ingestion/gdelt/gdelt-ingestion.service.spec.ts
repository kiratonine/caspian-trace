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
  sourceText:
    'Атырау: обнаружена нефтяная плёнка.',
  parserFailed: false, requestedRegionMatched: true,
  sourceStatus: 'healthy' as const, cacheStatus: 'miss' as const, httpStatus: 200,
}

describe('GdeltIngestionService run and health semantics', () => {
  const gdelt = { discover: jest.fn() }
  const directAdapter = { candidates: jest.fn() }
  const directSources = { process: jest.fn() }
  const articles = { process: jest.fn() }
  const signalEnrichment = {
    run: jest.fn(),
  }
  const sourceHealth = {
    startAttempt: jest.fn(),
    markSuccess: jest.fn(),
    markFailure: jest.fn(),
    markRateLimited: jest.fn(),
  }
  const repository = {
    createPublicRun: jest.fn(),
    finalizeRun: jest.fn(),
    hasAcceptedPublicRun: jest.fn(),
  }
  const service = new GdeltIngestionService(
    gdelt as never,
    directAdapter as never,
    directSources as never,
    articles as never,
    signalEnrichment as never,
    sourceHealth as never,
    repository as never,
    createSafeFetchConfig(),
    clock,
  )

  beforeEach(() => {
    jest.clearAllMocks()
    repository.createPublicRun.mockResolvedValue({})
    repository.finalizeRun.mockResolvedValue(undefined)
    sourceHealth.startAttempt.mockResolvedValue(
      undefined,
    )

    sourceHealth.markSuccess.mockResolvedValue(
      undefined,
    )

    sourceHealth.markFailure.mockResolvedValue(
      undefined,
    )

    sourceHealth.markRateLimited.mockResolvedValue(
      undefined,
    )
    repository.hasAcceptedPublicRun.mockResolvedValue(false)
    gdelt.discover.mockResolvedValue(discovery('healthy', 'miss'))
    articles.process.mockResolvedValue(processed)
    signalEnrichment.run.mockResolvedValue({
      candidate: null,
      failed: false,
    })
    directAdapter.candidates.mockReturnValue([])
    directSources.process.mockResolvedValue({
      accepted: [],
      signalCandidates: [],
      enrichmentAttemptedCount: 0,
      enrichmentCandidateCount: 0,
      enrichmentFailedCount: 0,
      rejectedCount: 0,
      rateLimitedCount: 0,
      regionMismatchCount: 0,
      irrelevantCount: 0,
      temporalMismatchCount: 0,
      temporalUnknownCount: 0,
      parserFailureCount: 0,
      degradedCount: 0,
      successfulFetchCount: 0,
      lastHttpStatus: null,
    })
  })

  it('marks a healthy bounded GDELT-only run succeeded', async () => {
    const result = await service.run(body())

    expect(result).toMatchObject({
      status: 'succeeded',
      gdelt: {
        status: 'succeeded',
        acceptedCount: 1,
      },
      directFallback: {
        used: false,
      },
      enrichment: {
        attemptedCount: 1,
        candidateCount: 0,
        failedCount: 0,
      },
      signalCandidates: [],
    })

    expect(signalEnrichment.run).toHaveBeenCalledWith({
      sourceDocumentId:
        'doc-article-azh-kz-test',
      sourceText:
        'Атырау: обнаружена нефтяная плёнка.',
    })

    expect(
      sourceHealth.startAttempt,
    ).toHaveBeenCalledWith(
      'gdelt',
      expect.any(Date),
    )

    expect(
      sourceHealth.markSuccess,
    ).toHaveBeenCalledWith(
      'gdelt',
      expect.objectContaining({
        degraded: false,
        lastHttpStatus: 200,
        cacheAvailable: true,
      }),
    )

    expect(
      sourceHealth.markFailure,
    ).not.toHaveBeenCalled()

    expect(
      sourceHealth.markRateLimited,
    ).not.toHaveBeenCalled()

    expect(
      repository.finalizeRun,
    ).toHaveBeenCalled()

    const serializedFinalizeRunCalls =
      JSON.stringify(
        repository.finalizeRun.mock.calls,
      )

    expect(serializedFinalizeRunCalls).toContain(
      '"enrichmentAttemptedCount":1',
    )

    expect(serializedFinalizeRunCalls).toContain(
      '"enrichmentCandidateCount":0',
    )

    expect(serializedFinalizeRunCalls).toContain(
      '"enrichmentFailedCount":0',
    )
  })

  it('processes stale 429 articles but keeps run/health explicitly rate_limited', async () => {
    gdelt.discover.mockResolvedValueOnce(discovery('rate_limited', 'stale'))
    await expect(service.run(body())).resolves.toMatchObject({
      status: 'partial', gdelt: { status: 'rate_limited', sourceStatus: 'rate_limited', acceptedCount: 1 },
    })
    expect(repository.finalizeRun).toHaveBeenCalledWith(expect.objectContaining({
      status: 'RATE_LIMITED', acceptedCount: 1, errorCode: 'GDELT_RATE_LIMITED',
    }))
    expect(
      sourceHealth.markRateLimited,
    ).toHaveBeenCalledWith(
      'gdelt',
      expect.objectContaining({
        success: true,
        cacheAvailable: true,
        lastHttpStatus: 200,
        error: {
          code: 'GDELT_RATE_LIMITED',
          message:
            'GDELT source is rate limited; cached response was used',
        },
      }),
    )

    expect(
      sourceHealth.markSuccess,
    ).not.toHaveBeenCalled()

    expect(
      sourceHealth.markFailure,
    ).not.toHaveBeenCalled()
  })

  it('runs a separate direct fallback after 429 and never overwrites GDELT health', async () => {
    gdelt.discover.mockRejectedValueOnce(new SafeFetchError({
      code: 'SAFE_FETCH_RATE_LIMITED', safeMessage: 'raw upstream detail',
      sourceStatus: 'rate_limited', retryable: true, statusCode: 429,
    }))
    const directCandidate = { ...candidate, discoveryMode: 'direct_fallback' as const }
    directAdapter.candidates.mockReturnValueOnce([directCandidate])
    directSources.process.mockResolvedValueOnce({
      accepted: [
        {
          ...processed,
          document: {
            ...processed.document,
            discoveryMode:
              'direct_fallback' as const,
            publishedAt:
              '2025-09-09T10:16:00.000Z',
          },
        },
      ],
      signalCandidates: [],
      enrichmentAttemptedCount: 1,
      enrichmentCandidateCount: 0,
      enrichmentFailedCount: 0,
      rejectedCount: 0,
      rateLimitedCount: 0,
      regionMismatchCount: 0,
      irrelevantCount: 0,
      temporalMismatchCount: 0,
      temporalUnknownCount: 0,
      parserFailureCount: 0,
      degradedCount: 0,
      successfulFetchCount: 1,
      lastHttpStatus: 200,
    })
    const result = await service.run(body())
    expect(result).toMatchObject({
      status: 'partial', gdelt: { status: 'rate_limited', acceptedCount: 0 },
      directFallback: { used: true, status: 'succeeded', acceptedCount: 1 },
    })
    expect(
      sourceHealth.startAttempt,
    ).toHaveBeenNthCalledWith(
      1,
      'gdelt',
      expect.any(Date),
    )

    expect(
      sourceHealth.startAttempt,
    ).toHaveBeenNthCalledWith(
      2,
      'direct-sources',
      expect.any(Date),
    )

    expect(
      sourceHealth.markRateLimited,
    ).toHaveBeenCalledWith(
      'gdelt',
      expect.objectContaining({
        success: false,
        lastHttpStatus: 429,
      }),
    )

    expect(
      sourceHealth.markSuccess,
    ).toHaveBeenCalledWith(
      'direct-sources',
      expect.objectContaining({
        lastHttpStatus: 200,
        cacheAvailable: true,
      }),
    )

    expect(
      sourceHealth.markSuccess,
    ).not.toHaveBeenCalledWith(
      'gdelt',
      expect.anything(),
    )
    expect(repository.finalizeRun).not.toHaveBeenCalledWith(expect.objectContaining({ errorMessage: 'raw upstream detail' }))
    expect(directSources.process).toHaveBeenCalledWith(
      [directCandidate],
      expect.any(String),
      { from: new Date('2025-09-01T00:00:00Z'), to: new Date('2025-09-30T23:59:59Z') },
    )
  })

  it(
    'marks mixed direct temporal coverage partial while keeping health healthy and returning only matched',
    async () => {
      gdelt.discover.mockRejectedValueOnce(
        new SafeFetchError({
          code: 'SAFE_FETCH_NETWORK_ERROR',
          safeMessage: 'unavailable',
          sourceStatus: 'degraded',
          retryable: true,
        }),
      )

      const directCandidates = [0, 1, 2].map(
        (index) => ({
          ...candidate,
          discoveryMode:
            'direct_fallback' as const,
          originalUrl:
            `https://azh.kz/direct-${index}`,
        }),
      )

      directAdapter.candidates.mockReturnValueOnce(
        directCandidates,
      )

      const matched = {
        ...processed,
        document: {
          ...processed.document,
          discoveryMode:
            'direct_fallback' as const,
          canonicalUrl:
            directCandidates[0]!.originalUrl,
          publishedAt:
            '2025-09-09T10:16:00.000Z',
        },
      }

      directSources.process.mockResolvedValueOnce({
        accepted: [matched],
        signalCandidates: [],
        enrichmentAttemptedCount: 1,
        enrichmentCandidateCount: 0,
        enrichmentFailedCount: 0,
        rejectedCount: 0,
        rateLimitedCount: 0,
        regionMismatchCount: 0,
        irrelevantCount: 0,
        temporalMismatchCount: 1,
        temporalUnknownCount: 1,
        parserFailureCount: 0,
        degradedCount: 0,
        successfulFetchCount: 3,
        lastHttpStatus: 200,
      })

      const result = await service.run({
        ...body(),
        maxArticles: 3,
      })

      expect(directSources.process).toHaveBeenCalledTimes(
        1,
      )

      expect(result).toMatchObject({
        directFallback: {
          used: true,
          status: 'partial',
          acceptedCount: 1,
        },
        enrichment: {
          attemptedCount: 1,
          candidateCount: 0,
          failedCount: 0,
        },
        signalCandidates: [],
        documents: [
          {
            canonicalUrl:
              directCandidates[0]!.originalUrl,
          },
        ],
      })

      expect(
        repository.finalizeRun,
      ).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 'PARTIAL',
          acceptedCount: 1,
          rejectedCount: 0,
          errorCode: null,
          errorMessage: null,
        }),
      )

      const serializedLastFinalizeRunCall =
        JSON.stringify(
          repository.finalizeRun.mock.calls.at(-1),
        )

      expect(
        serializedLastFinalizeRunCall,
      ).toContain('"temporalMismatchCount":1')

      expect(
        serializedLastFinalizeRunCall,
      ).toContain('"temporalUnknownCount":1')

      expect(
        serializedLastFinalizeRunCall,
      ).toContain(
        '"enrichmentAttemptedCount":1',
      )

      expect(
        serializedLastFinalizeRunCall,
      ).toContain(
        '"enrichmentCandidateCount":0',
      )

      expect(
        serializedLastFinalizeRunCall,
      ).toContain(
        '"enrichmentFailedCount":0',
      )

      expect(
        sourceHealth.markSuccess,
      ).toHaveBeenLastCalledWith(
        'direct-sources',
        expect.objectContaining({
          lastHttpStatus: 200,
          cacheAvailable: true,
        }),
      )

      expect(
        sourceHealth.markFailure,
      ).not.toHaveBeenCalledWith(
        'direct-sources',
        expect.anything(),
      )

      expect(
        sourceHealth.markRateLimited,
      ).not.toHaveBeenCalledWith(
        'direct-sources',
        expect.anything(),
      )
    },
  )

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
    expect(signalEnrichment.run).not.toHaveBeenCalled()
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
    expect(
      sourceHealth.markFailure,
    ).toHaveBeenCalledWith(
      'gdelt',
      expect.objectContaining({
        degraded: false,
        success: false,
        cacheAvailable: false,
        error: {
          code: 'GDELT_RESPONSE_INVALID',
          message:
            'GDELT response does not match the expected schema',
        },
      }),
    )

    expect(
      sourceHealth.markSuccess,
    ).not.toHaveBeenCalled()

    expect(
      sourceHealth.markRateLimited,
    ).not.toHaveBeenCalled()
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
    expect(
      sourceHealth.markSuccess,
    ).toHaveBeenCalledWith(
      'gdelt',
      expect.objectContaining({
        degraded: false,
        lastHttpStatus: 200,
        cacheAvailable: false,
        detail:
          'GDELT_NO_ALLOWED_ARTICLES: GDELT returned no allowed articles for the requested coverage',
      }),
    )

    expect(
      sourceHealth.markFailure,
    ).not.toHaveBeenCalled()

    expect(
      sourceHealth.markRateLimited,
    ).not.toHaveBeenCalled()
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
      expect(signalEnrichment.run).not.toHaveBeenCalled()
    },
  )
  it(
    'does not accept a GDELT article whose parser failed',
    async () => {
      articles.process.mockResolvedValueOnce({
        ...processed,
        sourceText: null,
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

      expect(
        sourceHealth.markFailure,
      ).toHaveBeenCalledWith(
        'gdelt',
        expect.objectContaining({
          degraded: true,
          success: true,
          cacheAvailable: false,
          error: {
            code:
              'PUBLIC_ARTICLE_INGESTION_FAILED',
            message:
              'A public article was cached but could not be fully processed',
          },
        }),
      )

      expect(
        JSON.stringify(repository.finalizeRun.mock.calls),
      ).toContain('"parserFailureCount":1')
      expect(signalEnrichment.run).not.toHaveBeenCalled()
    },
  )

  it('returns a validated transient candidate without persisting its body', async () => {
    const signalCandidate = {
      sourceDocumentId:
        processed.document.sourceDocumentId,
      extractionMode: 'llm_candidate' as const,
      verificationStatus: 'unverified' as const,
      signal: {
        observedAt: null,
        observedPeriod: '2025-09',
        locationText: 'Атырау',
        phenomenon: 'oil_film' as const,
        excerpt:
          'Атырау: обнаружена нефтяная плёнка.',
        evidenceQuotes: [
          'обнаружена нефтяная плёнка',
        ],
        confidence: 0.91,
      },
    }

    signalEnrichment.run.mockResolvedValueOnce({
      candidate: signalCandidate,
      failed: false,
    })

    const result = await service.run({
      ...body(),
      includeDirectFallback: false,
    })

    expect(result).toMatchObject({
      status: 'succeeded',
      enrichment: {
        attemptedCount: 1,
        candidateCount: 1,
        failedCount: 0,
      },
      signalCandidates: [signalCandidate],
    })

    const persistedCalls = JSON.stringify(
      repository.finalizeRun.mock.calls,
    )

    expect(persistedCalls).not.toContain(
      'signalCandidates',
    )

    expect(persistedCalls).not.toContain(
      signalCandidate.signal.excerpt,
    )

    expect(persistedCalls).not.toContain(
      'evidenceQuotes',
    )
  })

  it('keeps a successful ingestion when optional enrichment fails', async () => {
    signalEnrichment.run.mockResolvedValueOnce({
      candidate: null,
      failed: true,
    })

    const result = await service.run({
      ...body(),
      includeDirectFallback: false,
    })

    expect(result).toMatchObject({
      status: 'succeeded',
      gdelt: {
        status: 'succeeded',
        acceptedCount: 1,
        rejectedCount: 0,
      },
      enrichment: {
        attemptedCount: 1,
        candidateCount: 0,
        failedCount: 1,
      },
      signalCandidates: [],
    })

    expect(
      sourceHealth.markSuccess,
    ).toHaveBeenCalledWith(
      'gdelt',
      expect.objectContaining({
        degraded: false,
        cacheAvailable: true,
      }),
    )

    expect(
      sourceHealth.markFailure,
    ).not.toHaveBeenCalled()

    expect(
      sourceHealth.markRateLimited,
    ).not.toHaveBeenCalled()

    expect(
      repository.finalizeRun,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'SUCCEEDED',
        acceptedCount: 1,
        rejectedCount: 0,
      }),
    )

    const serializedFinalizeRunCalls =
      JSON.stringify(
        repository.finalizeRun.mock.calls,
      )

    expect(serializedFinalizeRunCalls).toContain(
      '"enrichmentAttemptedCount":1',
    )

    expect(serializedFinalizeRunCalls).toContain(
      '"enrichmentCandidateCount":0',
    )

    expect(serializedFinalizeRunCalls).toContain(
      '"enrichmentFailedCount":1',
    )
  })

  it('aggregates GDELT and direct enrichment counters', async () => {
    const directCandidate = {
      ...candidate,
      discoveryMode: 'direct_fallback' as const,
      originalUrl:
        'https://azh.kz/direct-enrichment',
    }

    directAdapter.candidates.mockReturnValueOnce([
      directCandidate,
    ])

    const directSignalCandidate = {
      sourceDocumentId: 'direct-doc',
      extractionMode: 'llm_candidate' as const,
      verificationStatus: 'unverified' as const,
      signal: {
        observedAt: null,
        observedPeriod: '2025-09',
        locationText: 'Атырау',
        phenomenon: 'oil_film' as const,
        excerpt:
          'На реке обнаружена нефтяная плёнка.',
        evidenceQuotes: [
          'обнаружена нефтяная плёнка',
        ],
        confidence: 0.8,
      },
    }

    directSources.process.mockResolvedValueOnce({
      accepted: [
        {
          ...processed,
          document: {
            ...processed.document,
            sourceDocumentId: 'direct-doc',
            discoveryMode:
              'direct_fallback' as const,
            canonicalUrl:
              directCandidate.originalUrl,
            publishedAt:
              '2025-09-09T10:16:00.000Z',
          },
        },
      ],

      signalCandidates: [
        directSignalCandidate,
      ],
      enrichmentAttemptedCount: 1,
      enrichmentCandidateCount: 1,
      enrichmentFailedCount: 0,

      rejectedCount: 0,
      rateLimitedCount: 0,
      regionMismatchCount: 0,
      irrelevantCount: 0,
      temporalMismatchCount: 0,
      temporalUnknownCount: 0,
      parserFailureCount: 0,
      degradedCount: 0,
      successfulFetchCount: 1,
      lastHttpStatus: 200,
    })

    const result = await service.run({
      ...body(),
      maxArticles: 2,
    })

    expect(result.enrichment).toEqual({
      attemptedCount: 2,
      candidateCount: 1,
      failedCount: 0,
    })

    expect(result.signalCandidates).toEqual([
      directSignalCandidate,
    ])
  })
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
