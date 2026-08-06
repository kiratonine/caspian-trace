import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { SafeFetchError } from '../../src/common/http/safe-fetch/safe-fetch.errors'
import { IngestionRepository } from '../../src/ingestion/ingestion.repository'
import { KazhydrometAdapter } from '../../src/ingestion/kazhydromet/kazhydromet.adapter'
import {
  KazhydrometIngestionService,
  normalizeKazhydrometRequest,
} from '../../src/ingestion/kazhydromet/kazhydromet-ingestion.service'
import { PdfTextService } from '../../src/ingestion/kazhydromet/pdf-text.service'
import type { PdfCandidate } from '../../src/ingestion/kazhydromet/kazhydromet.types'
import type { NormalizedKazhydrometRequest } from '../../src/ingestion/ingestion.types'
import { SourcesService } from '../../src/sources/sources.service'
import { SourceHealthService } from '../../src/sources/source-health/source-health.service'

const candidate: PdfCandidate = {
  url: new URL('https://www.kazhydromet.kz/atyrau-russ-2025-09.pdf'),
  canonicalUrl: 'https://www.kazhydromet.kz/atyrau-russ-2025-09.pdf',
  listingUrl: 'https://www.kazhydromet.kz/bulletins', anchorText: 'Атырау сентябрь 2025 русский',
  contextText: '', publishedPeriod: '2025-09', regions: ['atyrau'], language: 'ru',
  discoveryMode: 'listing', confidence: 10,
}
const bytes = Buffer.from('%PDF-test')
const sha256 = 'a'.repeat(64)

describe('KazhydrometIngestionService', () => {
  const adapter = { discover: jest.fn(), fetch: jest.fn() }
  const repository = {
    createRun: jest.fn(),
    finalizeRun: jest.fn(),
    ensureSourceDocument: jest.fn(),
    findCachedSources: jest.fn(),
    findCachedSourceById: jest.fn(),
    findCachedSourceByCanonicalUrl: jest.fn(),
    hasCachedKazhydrometSnapshots: jest.fn(),
    persistPages: jest.fn(),
  }
  const sourceHealth = {
    startAttempt: jest.fn(),
    markSuccess: jest.fn(),
    markFailure: jest.fn(),
    markRateLimited: jest.fn(),
  }
  const sources = { cacheExistingSourceSnapshot: jest.fn(), readCachedSourceSnapshot: jest.fn() }
  const pdfText = { extractPages: jest.fn() }
  let service: KazhydrometIngestionService

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        KazhydrometIngestionService,
        { provide: KazhydrometAdapter, useValue: adapter },
        {
          provide: IngestionRepository,
          useValue: repository,
        },
        {
          provide: SourceHealthService,
          useValue: sourceHealth,
        },
        {
          provide: SourcesService,
          useValue: sources,
        },
        { provide: PdfTextService, useValue: pdfText },
        { provide: ConfigService, useValue: { getOrThrow: (): number => 3 } },
      ],
    }).compile()
    service = module.get(KazhydrometIngestionService)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    repository.createRun.mockResolvedValue({})
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
    repository.hasCachedKazhydrometSnapshots.mockResolvedValue(false)
    repository.findCachedSources.mockResolvedValue([])
    repository.findCachedSourceById.mockResolvedValue(null)
    repository.findCachedSourceByCanonicalUrl.mockResolvedValue(null)
    adapter.discover.mockResolvedValue({
      candidates: [candidate],
      metadata: { statusCode: 200, sourceStatus: 'healthy' },
    })
    adapter.fetch.mockResolvedValue({
      candidate, bytes, fetchedAt: new Date('2026-08-05T00:00:00Z'), httpStatus: 200,
      finalUrl: candidate.canonicalUrl, sha256, sourceStatus: 'healthy',
    })
    repository.ensureSourceDocument.mockResolvedValue({
      id: 'doc-kazhydromet-2025-09', originalUrl: candidate.canonicalUrl,
      canonicalUrl: candidate.canonicalUrl, mediaType: 'application/pdf', publishedPeriod: '2025-09',
      sha256, cachePath: null, status: 'UNVERIFIED',
    })
    sources.cacheExistingSourceSnapshot.mockResolvedValue({
      sourceDocumentId: 'doc-kazhydromet-2025-09', sha256, cachePath: 'kazhydromet_bulletin/2025/09/a.pdf',
      created: true, attached: true, status: 'UNVERIFIED',
    })
    pdfText.extractPages.mockResolvedValue([{
      pageNumber: 22, text: 'Атырау Жайык\nНефтепродукты 0,234 мг/дм³', textSha256: 'b'.repeat(64),
    }])
    repository.persistPages.mockResolvedValue({ pageCount: 1, createdCount: 1 })
  })

  it('finalizes a successful candidate-only run with accurate counts and health', async () => {
    await expect(service.run(validRequest())).resolves.toMatchObject({
      status: 'succeeded', discoveredCount: 1, fetchedCount: 1, cachedCount: 1,
      pageCount: 1, validatedCandidateCount: 1,
      documents: [expect.objectContaining({ sourceDocumentId: 'doc-kazhydromet-2025-09', relevantPageNumbers: [22] })],
    })
    expect(repository.persistPages).toHaveBeenCalled()
    expect(repository.finalizeRun).toHaveBeenCalledWith(expect.objectContaining({ status: 'SUCCEEDED', acceptedCount: 1 }))
    expect(
      sourceHealth.startAttempt,
    ).toHaveBeenCalledWith(
      'kazhydromet',
      expect.any(Date),
    )

    expect(
      sourceHealth.markSuccess,
    ).toHaveBeenCalledWith(
      'kazhydromet',
      expect.objectContaining({
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
    expect(repository).not.toHaveProperty('measurement')
  })

  it('marks a usable parser-partial run as degraded success', async () => {
    pdfText.extractPages.mockResolvedValueOnce([
      {
        pageNumber: 1,
        text:
          'Ежемесячный информационный бюллетень',
        textSha256: 'c'.repeat(64),
      },
    ])

    await expect(
      service.run(validRequest()),
    ).resolves.toMatchObject({
      status: 'partial',
      fetchedCount: 1,
      cachedCount: 1,
    })

    expect(
      sourceHealth.markSuccess,
    ).toHaveBeenCalledWith(
      'kazhydromet',
      expect.objectContaining({
        degraded: true,
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
  })

  it('retains the raw snapshot and records partial when parser fails', async () => {
    pdfText.extractPages.mockRejectedValueOnce(new Error('raw parser detail'))
    const result = await service.run(validRequest())
    expect(result.status).toBe('partial')
    expect(result.cachedCount).toBe(1)
    expect(result.documents[0]?.parserStatus).toBe('failed')
    expect(typeof result.documents[0]?.cachePath).toBe('string')
    expect(sources.cacheExistingSourceSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
      pdfText.extractPages.mock.invocationCallOrder[0]!,
    )
    expect(repository.finalizeRun).toHaveBeenCalledWith(expect.objectContaining({
      status: 'PARTIAL', rejectedCount: 1, errorMessage: 'Kazhydromet document ingestion failed',
    }))
    expect(
      sourceHealth.markFailure,
    ).toHaveBeenCalledWith(
      'kazhydromet',
      expect.objectContaining({
        degraded: true,
        success: false,
        cacheAvailable: true,
        error: {
          code:
            'KAZHYDROMET_INGESTION_FAILED',
          message:
            'Kazhydromet document ingestion failed',
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

  it('persists rate-limited run and health without fabricating an empty success', async () => {
    adapter.discover.mockRejectedValueOnce(new SafeFetchError({
      code: 'SAFE_FETCH_RATE_LIMITED', safeMessage: 'raw upstream', sourceStatus: 'rate_limited', retryable: true,
    }))
    await expect(service.run(validRequest())).resolves.toMatchObject({ status: 'rate_limited', documents: [] })
    expect(repository.finalizeRun).toHaveBeenCalledWith(expect.objectContaining({ status: 'RATE_LIMITED', errorCode: 'KAZHYDROMET_RATE_LIMITED' }))
    expect(
      sourceHealth.markRateLimited,
    ).toHaveBeenCalledWith(
      'kazhydromet',
      expect.objectContaining({
        success: false,
        cacheAvailable: false,
        error: {
          code: 'KAZHYDROMET_RATE_LIMITED',
          message:
            'Kazhydromet source is rate limited',
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

  it('uses cached snapshot after origin failure and reparses it', async () => {
    adapter.fetch.mockRejectedValueOnce(new SafeFetchError({
      code: 'SAFE_FETCH_NETWORK_ERROR', safeMessage: 'origin unavailable', sourceStatus: 'degraded', retryable: true,
    }))
    repository.findCachedSourceById.mockResolvedValueOnce({
      id: 'doc-kazhydromet-2025-09', originalUrl: candidate.canonicalUrl,
      canonicalUrl: candidate.canonicalUrl, mediaType: 'application/pdf', publishedPeriod: '2025-09',
      sha256, cachePath: 'kazhydromet_bulletin/2025/09/a.pdf', status: 'UNVERIFIED', regions: ['atyrau'],
    })
    sources.readCachedSourceSnapshot.mockResolvedValueOnce({
      bytes, mediaType: 'application/pdf', sha256, cachePath: 'kazhydromet_bulletin/2025/09/a.pdf',
    })
    await expect(service.run(validRequest())).resolves.toMatchObject({ status: 'partial', fetchedCount: 1, cachedCount: 1 })
    expect(pdfText.extractPages).toHaveBeenCalledWith(bytes)
    expect(repository.finalizeRun).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: 'KAZHYDROMET_ORIGIN_UNAVAILABLE',
      errorMessage: 'Kazhydromet document origin is unavailable; cached snapshot was used',
    }))
    expect(
      sourceHealth.markFailure,
    ).toHaveBeenCalledWith(
      'kazhydromet',
      expect.objectContaining({
        degraded: true,
        success: true,
        cacheAvailable: true,
        error: {
          code:
            'KAZHYDROMET_ORIGIN_UNAVAILABLE',
          message:
            'Kazhydromet document origin is unavailable; cached snapshot was used',
        },
      }),
    )

    expect(
      sourceHealth.markSuccess,
    ).not.toHaveBeenCalled()

    expect(
      sourceHealth.markRateLimited,
    ).not.toHaveBeenCalled()
    expect(repository.finalizeRun).not.toHaveBeenCalledWith(expect.objectContaining({ errorMessage: 'origin unavailable' }))
  })

  it('does not use an Atyrau cached source for a Mangystau request', async () => {
    adapter.discover.mockRejectedValueOnce(new SafeFetchError({
      code: 'SAFE_FETCH_NETWORK_ERROR', safeMessage: 'upstream raw detail', sourceStatus: 'degraded', retryable: true,
    }))
    repository.findCachedSources.mockResolvedValueOnce([])
    const result = await service.run({ ...validRequest(), regions: ['mangystau'] })
    expect(result).toMatchObject({ status: 'failed', discoveredCount: 0, documents: [] })
    expect(repository.findCachedSources).toHaveBeenCalledWith(expect.objectContaining({ regions: ['mangystau'] }))
    expect(adapter.fetch).not.toHaveBeenCalled()
    expect(sources.readCachedSourceSnapshot).not.toHaveBeenCalled()
  })

  it('uses a matching Mangystau cached source after discovery and origin failures', async () => {
    const mangystau = {
      ...candidate,
      url: new URL('https://www.kazhydromet.kz/mangystau-russ-2025-09.pdf'),
      canonicalUrl: 'https://www.kazhydromet.kz/mangystau-russ-2025-09.pdf',
      regions: ['mangystau'] as ['mangystau'],
      language: 'unknown' as const,
    }
    const cached = {
      id: 'test-part07-mangystau-source', originalUrl: mangystau.canonicalUrl,
      canonicalUrl: mangystau.canonicalUrl, mediaType: 'application/pdf', publishedPeriod: '2025-09',
      sha256, cachePath: 'kazhydromet_bulletin/2025/09/mangystau.pdf', status: 'UNVERIFIED',
      regions: ['mangystau'] as ['mangystau'],
    }
    adapter.discover.mockRejectedValueOnce(new SafeFetchError({
      code: 'SAFE_FETCH_NETWORK_ERROR', safeMessage: 'discovery raw detail', sourceStatus: 'degraded', retryable: true,
    }))
    repository.findCachedSources.mockResolvedValueOnce([cached])
    adapter.fetch.mockRejectedValueOnce(new SafeFetchError({
      code: 'SAFE_FETCH_NETWORK_ERROR', safeMessage: 'origin raw detail', sourceStatus: 'degraded', retryable: true,
    }))
    repository.findCachedSourceByCanonicalUrl.mockResolvedValueOnce(cached)
    sources.readCachedSourceSnapshot.mockResolvedValueOnce({
      bytes, mediaType: 'application/pdf', sha256, cachePath: cached.cachePath,
    })
    await expect(service.run({ ...validRequest(), regions: ['mangystau'] })).resolves.toMatchObject({
      status: 'partial', documents: [expect.objectContaining({ sourceDocumentId: cached.id, regions: ['mangystau'] })],
    })
    expect(sources.readCachedSourceSnapshot).toHaveBeenCalledWith(cached.id)
  })

  it('reports existing cache availability without treating a no-candidate run as partial', async () => {
    repository.hasCachedKazhydrometSnapshots.mockResolvedValueOnce(true)
    adapter.discover.mockResolvedValueOnce({
      candidates: [], metadata: { statusCode: 200, sourceStatus: 'healthy' },
    })
    await expect(service.run(validRequest())).resolves.toMatchObject({ status: 'failed', documents: [] })
    expect(
      sourceHealth.markFailure,
    ).toHaveBeenCalledWith(
      'kazhydromet',
      expect.objectContaining({
        degraded: false,
        success: false,
        cacheAvailable: true,
        error: {
          code: 'KAZHYDROMET_NO_CANDIDATES',
          message:
            'No matching Kazhydromet PDF bulletins were discovered',
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

  it('validates range and configured document maximum', () => {
    expect(normalizeKazhydrometRequest(validRequest(), 3)).toEqual(validRequest())
    expect(() => normalizeKazhydrometRequest({ ...validRequest(), from: '2025-10' }, 3)).toThrow('Kazhydromet ingestion request is invalid')
    expect(() => normalizeKazhydrometRequest({ ...validRequest(), from: '2023-09' }, 3)).toThrow()
    expect(() => normalizeKazhydrometRequest({ ...validRequest(), maxDocuments: 4 }, 3)).toThrow()
  })
})

function validRequest(): NormalizedKazhydrometRequest {
  return { from: '2025-09', to: '2025-09', regions: ['atyrau'] as ['atyrau'], maxDocuments: 1 }
}
