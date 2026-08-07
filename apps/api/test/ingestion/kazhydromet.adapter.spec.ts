import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { SafeFetchService } from '../../src/common/http/safe-fetch/safe-fetch.service'
import { KazhydrometAdapter } from '../../src/ingestion/kazhydromet/kazhydromet.adapter'
import type { PdfCandidate } from '../../src/ingestion/kazhydromet/kazhydromet.types'
import type { SafeFetchMetadata } from '../../src/common/http/safe-fetch/safe-fetch.types'

const candidate: PdfCandidate = {
  url: new URL('https://www.kazhydromet.kz/atyrau-russ.pdf'),
  canonicalUrl: 'https://www.kazhydromet.kz/atyrau-russ.pdf',
  listingUrl: 'https://www.kazhydromet.kz/bulletins',
  anchorText: 'Атырау сентябрь 2025 русский', contextText: '', publishedPeriod: '2025-09',
  regions: ['atyrau'], language: 'ru', discoveryMode: 'listing', confidence: 10,
}

describe('KazhydrometAdapter SafeFetch boundary', () => {
  const fetchText = jest.fn()
  const fetchBuffer = jest.fn()
  let adapter: KazhydrometAdapter

  beforeAll(async () => {
    const config = new Map<string, unknown>([
      ['KAZHYDROMET_BULLETINS_URL', 'https://www.kazhydromet.kz/bulletins'],
      ['KAZHYDROMET_ALLOWED_HOSTS', ['kazhydromet.kz', 'www.kazhydromet.kz']],
      ['HTTP_TIMEOUT_MS', 10_000], ['HTTP_MAX_BYTES', 15_728_640],
    ])
    const module = await Test.createTestingModule({ providers: [
      KazhydrometAdapter,
      { provide: SafeFetchService, useValue: { fetchText, fetchBuffer } },
      { provide: ConfigService, useValue: { getOrThrow: (key: string): unknown => config.get(key) } },
    ] }).compile()
    adapter = module.get(KazhydrometAdapter)
  })

  beforeEach(() => jest.clearAllMocks())

  it('discovers only through SafeFetch with bounded HTML cache policy', async () => {
    fetchText.mockResolvedValueOnce({
      text: '<p>Атырау сентябрь 2025 русский <a href="/atyrau-russ.pdf">PDF</a></p>',
      metadata: metadata('https://www.kazhydromet.kz/bulletins', 'text/html'),
    })
    await expect(adapter.discover({
      from: '2025-09', to: '2025-09', regions: ['atyrau'], maxDocuments: 1,
    })).resolves.toMatchObject({ candidates: [expect.objectContaining({ publishedPeriod: '2025-09' })] })
    expect(fetchText).toHaveBeenCalledWith(new URL('https://www.kazhydromet.kz/bulletins'), expect.objectContaining({
      allowedHosts: ['kazhydromet.kz', 'www.kazhydromet.kz'], expectedContentTypes: ['text/html'],
      maxBytes: 2 * 1024 * 1024, cache: { enabled: true, ttlMs: 900_000, staleIfErrorMs: 21_600_000 },
    }))
  })

  it('downloads PDF only through SafeFetch with cache disabled', async () => {
    fetchBuffer.mockResolvedValueOnce({
      body: Buffer.from('%PDF-test'),
      metadata: metadata(candidate.canonicalUrl, 'application/pdf'),
    })
    const result = await adapter.fetch(candidate)
    expect(result.candidate).toBe(candidate)
    expect(result.httpStatus).toBe(200)
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(fetchBuffer).toHaveBeenCalledWith(new URL(candidate.canonicalUrl), expect.objectContaining({
      expectedContentTypes: ['application/pdf'], maxBytes: 15_728_640,
      cache: { enabled: false, ttlMs: 1, staleIfErrorMs: 0 },
    }))
  })

  it.each([
    ['HTML', Buffer.from('<html>not pdf</html>')],
    ['short prefix', Buffer.from('%PDF')],
  ])('rejects %s body before parser and hashing identity', async (_label, body) => {
    fetchBuffer.mockResolvedValueOnce({ body, metadata: metadata(candidate.canonicalUrl, 'application/pdf') })
    await expect(adapter.fetch(candidate)).rejects.toMatchObject({ code: 'KAZHYDROMET_PDF_INVALID' })
  })
})

function metadata(finalUrl: string, contentType: string): SafeFetchMetadata {
  return {
    requestedUrl: finalUrl, finalUrl, statusCode: 200, contentType,
    fetchedAt: '2026-08-05T00:00:00.000Z', redirects: 0, attempts: 1,
    cacheStatus: 'miss', sourceStatus: 'healthy',
  }
}
