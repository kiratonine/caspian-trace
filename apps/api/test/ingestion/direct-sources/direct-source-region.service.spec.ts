import { DirectSourceAdapter } from '../../../src/ingestion/direct-sources/direct-source.adapter'
import { DirectSourceService } from '../../../src/ingestion/direct-sources/direct-source.service'
import { createSafeFetchConfig } from '../../safe-fetch/test-environment'
import type { NormalizedGdeltRequest } from '../../../src/ingestion/ingestion.types'
import type { ProcessedArticle } from '../../../src/ingestion/article/article-ingestion.service'
import type { PublicArticleCandidate } from '../../../src/ingestion/article/article.types'

describe('direct fallback requested-region acceptance', () => {
  const fallbackUrls = [
    'https://www.zakon.kz/obshestvo/6490267-v-atyrau-zelenaya-voda-v-reke-okazalas-sledom-neftyanogo-zagryazneniya.html',
    'https://www.inform.kz/ru/v-stochnih-vodah-atirau-obnaruzheni-ostatki-nefteproduktov-adef40',
    'https://azh.kz/ru/news/view/120575',
  ]
  const adapter = new DirectSourceAdapter(createSafeFetchConfig({
    DIRECT_SOURCE_ALLOWED_HOSTS: ['www.zakon.kz', 'www.inform.kz', 'azh.kz'],
    DIRECT_SOURCE_FALLBACK_URLS: fallbackUrls,
  }))

  const process = jest.fn()

  const enrichment = {
    run: jest.fn(),
  }

  const service = new DirectSourceService(
    { process } as never,
    enrichment as never,
  )

  beforeEach(() => {
    jest.clearAllMocks()

    enrichment.run.mockResolvedValue({
      candidate: null,
      failed: false,
    })
  })

  it('does not accept default Atyrau Zakon/Inform articles for Mangystau', async () => {
    const candidates = adapter.candidates(mangystauRequest(), 10, new Set())
    expect(candidates).toHaveLength(2)
    expect(candidates.every((candidate) => candidate.requestedRegions[0] === 'mangystau')).toBe(true)
    process.mockImplementation((candidate: PublicArticleCandidate) => Promise.resolve(processed(
      candidate.originalUrl,
      false,
      [],
    )))

    await expect(service.process(candidates, 'test-part08-direct-run', septemberWindow())).resolves.toMatchObject({
      accepted: [],
      regionMismatchCount: 2,
      successfulFetchCount: 2,
      rejectedCount: 0,
    })
    expect(enrichment.run).not.toHaveBeenCalled()
  })

  it('accepts a national article when its extracted text matches Mangystau', async () => {
    const candidates = adapter.candidates(
      mangystauRequest(),
      1,
      new Set(),
    )

    process.mockResolvedValueOnce(
      processed(
        candidates[0]!.originalUrl,
        true,
        ['mangystau'],
        '2025-09-09T10:16:00.000Z',
      ),
    )

    const result = await service.process(
      candidates,
      'test-part08-direct-run',
      septemberWindow(),
    )

    expect(result.accepted).toHaveLength(1)

    expect(
      result.accepted[0]?.requestedRegionMatched,
    ).toBe(true)

    expect(result).toMatchObject({
      enrichmentAttemptedCount: 1,
      enrichmentCandidateCount: 0,
      enrichmentFailedCount: 0,
      signalCandidates: [],
    })

    expect(enrichment.run).toHaveBeenCalledTimes(1)

    expect(result.accepted).toHaveLength(1)

    const acceptedArticle = result.accepted[0]!

    expect(enrichment.run).toHaveBeenCalledWith({
      sourceDocumentId:
        acceptedArticle.document.sourceDocumentId,
      sourceText:
        'Атырау: обнаружена нефтяная плёнка.',
    })
  })

  it('retains an October snapshot but does not accept it for September', async () => {
    const candidates = adapter.candidates(atyrauRequest(), 1, new Set())
    process.mockResolvedValueOnce(processed(
      candidates[0]!.originalUrl,
      true,
      [],
      '2025-10-08T21:10:00.000Z',
    ))

    await expect(service.process(candidates, 'test-part08-direct-run', septemberWindow())).resolves.toMatchObject({
      accepted: [],
      temporalMismatchCount: 1,
      temporalUnknownCount: 0,
      successfulFetchCount: 1,
    })
    expect(process).toHaveBeenCalledTimes(1)
    expect(enrichment.run).not.toHaveBeenCalled()
  })

  it('retains a snapshot with unknown publication time but does not accept it', async () => {
    const candidates = adapter.candidates(atyrauRequest(), 1, new Set())
    process.mockResolvedValueOnce(processed(candidates[0]!.originalUrl, true, [], null))

    await expect(service.process(candidates, 'test-part08-direct-run', septemberWindow())).resolves.toMatchObject({
      accepted: [],
      temporalMismatchCount: 0,
      temporalUnknownCount: 1,
      successfulFetchCount: 1,
    })
    expect(enrichment.run).not.toHaveBeenCalled()
  })

  it('accepts an exact source-derived date at the inclusive September boundary', async () => {
    const candidates = adapter.candidates(atyrauRequest(), 1, new Set())
    process.mockResolvedValueOnce(processed(
      candidates[0]!.originalUrl,
      true,
      [],
      '2025-09-30T23:59:59.000Z',
    ))

    const result = await service.process(candidates, 'test-part08-direct-run', septemberWindow())
    expect(result).toMatchObject({
      temporalMismatchCount: 0,
      temporalUnknownCount: 0,
    })
    expect(result.accepted).toHaveLength(1)
    expect(result.accepted[0]!.document.publishedAt).toBe('2025-09-30T23:59:59.000Z')
  })

  it('returns only the matched document from a matched/mismatch/unknown batch', async () => {
    const candidates = adapter.candidates(atyrauRequest(), 3, new Set())
    process
      .mockResolvedValueOnce(processed(candidates[0]!.originalUrl, true, [], '2025-09-09T10:16:00.000Z'))
      .mockResolvedValueOnce(processed(candidates[1]!.originalUrl, true, [], '2025-10-08T21:10:00.000Z'))
      .mockResolvedValueOnce(processed(candidates[2]!.originalUrl, true, [], null))

    const result = await service.process(candidates, 'test-part08-direct-run', septemberWindow())
    expect(result).toMatchObject({
      temporalMismatchCount: 1,
      temporalUnknownCount: 1,
      successfulFetchCount: 3,
    })
    expect(result.accepted.map((item) => item.document.canonicalUrl)).toEqual([candidates[0]!.originalUrl])
  })
  it(
    'does not accept an in-window same-region article without a pollution marker',
    async () => {
      const candidates = adapter.candidates(
        atyrauRequest(),
        1,
        new Set(),
      )

      const article = processed(
        candidates[0]!.originalUrl,
        true,
        [],
        '2025-09-09T10:16:00.000Z',
      )

      article.document.relevant = false

      process.mockResolvedValueOnce(article)

      await expect(
        service.process(
          candidates,
          'test-part08-direct-run',
          septemberWindow(),
        ),
      ).resolves.toMatchObject({
        accepted: [],
        irrelevantCount: 1,
        regionMismatchCount: 0,
        parserFailureCount: 0,
        successfulFetchCount: 1,
      })
      expect(enrichment.run).not.toHaveBeenCalled()
    },
  )
  it(
    'never accepts a parser failure even when a previous publication date is in-window',
    async () => {
      const candidates = adapter.candidates(
        atyrauRequest(),
        1,
        new Set(),
      )

      const article = processed(
        candidates[0]!.originalUrl,
        true,
        [],
        '2025-09-09T10:16:00.000Z',
      )

      article.parserFailed = true
      article.sourceText = null
      article.requestedRegionMatched = null
      article.document.parserStatus = 'failed'
      article.document.relevant = null
      article.document.matchedRequestedRegions = null

      process.mockResolvedValueOnce(article)

      await expect(
        service.process(
          candidates,
          'test-part08-direct-run',
          septemberWindow(),
        ),
      ).resolves.toMatchObject({
        accepted: [],
        parserFailureCount: 1,
        irrelevantCount: 0,
        temporalMismatchCount: 0,
        temporalUnknownCount: 0,
        successfulFetchCount: 1,
      })
      expect(enrichment.run).not.toHaveBeenCalled()
    },
  )

  it('returns a transient signal candidate for an accepted article', async () => {
    const candidates = adapter.candidates(
      atyrauRequest(),
      1,
      new Set(),
    )

    const article = processed(
      candidates[0]!.originalUrl,
      true,
      [],
      '2025-09-09T10:16:00.000Z',
    )

    process.mockResolvedValueOnce(article)

    const signalCandidate = {
      sourceDocumentId:
        article.document.sourceDocumentId,
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

    enrichment.run.mockResolvedValueOnce({
      candidate: signalCandidate,
      failed: false,
    })

    const result = await service.process(
      candidates,
      'test-part08-direct-run',
      septemberWindow(),
    )

    expect(result.accepted).toHaveLength(1)

    expect(result).toMatchObject({
      enrichmentAttemptedCount: 1,
      enrichmentCandidateCount: 1,
      enrichmentFailedCount: 0,
      signalCandidates: [signalCandidate],
    })
  })

  it('keeps an accepted article when optional enrichment fails', async () => {
    const candidates = adapter.candidates(
      atyrauRequest(),
      1,
      new Set(),
    )

    process.mockResolvedValueOnce(
      processed(
        candidates[0]!.originalUrl,
        true,
        [],
        '2025-09-09T10:16:00.000Z',
      ),
    )

    enrichment.run.mockResolvedValueOnce({
      candidate: null,
      failed: true,
    })

    const result = await service.process(
      candidates,
      'test-part08-direct-run',
      septemberWindow(),
    )

    expect(result.accepted).toHaveLength(1)

    expect(result).toMatchObject({
      enrichmentAttemptedCount: 1,
      enrichmentCandidateCount: 0,
      enrichmentFailedCount: 1,
      signalCandidates: [],
      rejectedCount: 0,
      parserFailureCount: 0,
      degradedCount: 0,
    })
  })
})

function mangystauRequest(): NormalizedGdeltRequest {
  return {
    from: new Date('2025-09-01T00:00:00Z'),
    to: new Date('2025-09-30T23:59:59Z'),
    regions: ['mangystau'],
    maxRecords: 25,
    maxArticles: 10,
    includeDirectFallback: true,
  }
}

function atyrauRequest(): NormalizedGdeltRequest {
  return { ...mangystauRequest(), regions: ['atyrau'] }
}

function septemberWindow(): Pick<NormalizedGdeltRequest, 'from' | 'to'> {
  const request = atyrauRequest()
  return { from: request.from, to: request.to }
}

function processed(
  canonicalUrl: string,
  requestedRegionMatched: boolean,
  matchedRequestedRegions: 'mangystau'[],
  publishedAt: string | null = null,
): ProcessedArticle {
  return {
    document: {
      sourceDocumentId: `doc-${requestedRegionMatched ? 'mangystau' : 'atyrau'}`,
      discoveryMode: 'direct_fallback',
      publisher: 'National source',
      title: 'Article',
      canonicalUrl,
      publishedAt,
      sha256: 'a'.repeat(64),
      cachePath: `public_article/2026/08/${'a'.repeat(64)}.html`,
      parserStatus: 'succeeded',
      relevant: requestedRegionMatched,
      matchedRequestedRegions,
      coverage: ['national'],
    },
    sourceText:
      'Атырау: обнаружена нефтяная плёнка.',
    parserFailed: false,
    requestedRegionMatched,
    sourceStatus: 'healthy',
    cacheStatus: 'miss',
    httpStatus: 200,
  }
}
