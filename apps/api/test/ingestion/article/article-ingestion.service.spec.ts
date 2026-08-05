import { ArticleIngestionService } from '../../../src/ingestion/article/article-ingestion.service'
import { findDirectSource } from '../../../src/ingestion/direct-sources/direct-source-registry'
import { createSafeFetchConfig } from '../../safe-fetch/test-environment'

const bytes = Buffer.from('<html><article><p>Атырау: обнаружено загрязнение нефтепродуктами.</p></article></html>')
const candidate = {
  discoveryMode: 'gdelt' as const,
  originalUrl: 'https://azh.kz/article?utm_source=gdelt', discoveryTitle: 'Source title',
  gdeltSeenAt: '20250901T000000Z', gdeltLanguage: null, gdeltSourceCountry: null,
  requestedRegions: ['atyrau'] as ['atyrau'], publisherHost: 'azh.kz',
  coverage: findDirectSource('azh.kz')!.coverage,
}

describe('ArticleIngestionService', () => {
  const safeFetch = { fetchBuffer: jest.fn() }
  const sources = { cacheExistingSourceSnapshot: jest.fn() }
  const repository = {
    ensureArticleDocument: jest.fn(), persistArticleExtraction: jest.fn(), markArticleParserFailure: jest.fn(),
  }
  const articleText = { extract: jest.fn() }
  const clock = { now: (): Date => new Date('2026-08-06T00:00:00Z') }
  const service = new ArticleIngestionService(
    safeFetch as never, sources as never, repository as never, articleText as never,
    createSafeFetchConfig({ DIRECT_SOURCE_ALLOWED_HOSTS: ['azh.kz', 'lada.kz'] }), clock,
  )

  beforeEach(() => {
    jest.clearAllMocks()
    safeFetch.fetchBuffer.mockResolvedValue({
      body: bytes,
      metadata: {
        requestedUrl: candidate.originalUrl, finalUrl: 'https://azh.kz/article?utm_source=gdelt',
        statusCode: 200, contentType: 'text/html', fetchedAt: '2026-08-06T00:00:00Z',
        redirects: 0, attempts: 1, cacheStatus: 'miss', sourceStatus: 'healthy',
      },
    })
    repository.ensureArticleDocument.mockResolvedValue({
      id: 'doc-article-azh-kz-test', canonicalUrl: 'https://azh.kz/article', publisher: 'Ак Жайык',
      title: 'Source title', publishedAt: null, sha256: 'a'.repeat(64), cachePath: null,
    })
    sources.cacheExistingSourceSnapshot.mockResolvedValue({
      sha256: 'c1694ca63adf873fdc98047c6f66ab49f384519867c5363e00e271733c17f040',
      cachePath: 'public_article/2026/08/x.html',
    })
    articleText.extract.mockReturnValue({
      title: 'Extracted', publishedAt: null, text: 'not persisted', textSha256: 'b'.repeat(64),
      textChars: 50, titleMode: 'og_title', publishedAtMode: 'none',
      matchedGeographyKeywords: ['Атырау'], matchedRequestedRegions: ['atyrau'],
      matchedPollutionKeywords: ['загрязнение'], relevant: true,
    })
    repository.persistArticleExtraction.mockResolvedValue({
      id: 'doc-article-azh-kz-test', canonicalUrl: 'https://azh.kz/article', publisher: 'Ак Жайык',
      title: 'Extracted', publishedAt: null, sha256: 'a'.repeat(64), cachePath: 'public_article/2026/08/x.html',
    })
  })

  it('caches exact raw bytes before parser and removes tracking from canonical URL', async () => {
    const result = await service.process(candidate, 'test-part08-run')
    expect(result).toMatchObject({ requestedRegionMatched: true })
    expect(result.document).toMatchObject({
      canonicalUrl: 'https://azh.kz/article', parserStatus: 'succeeded',
      matchedRequestedRegions: ['atyrau'],
    })
    expect(sources.cacheExistingSourceSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
      articleText.extract.mock.invocationCallOrder[0]!,
    )
    expect(sources.cacheExistingSourceSnapshot).toHaveBeenCalledWith(expect.objectContaining({ bytes }))
    expect(articleText.extract).toHaveBeenCalledWith(
      bytes,
      candidate.discoveryTitle,
      candidate.requestedRegions,
      clock.now(),
    )
  })

  it('retains a mismatched raw snapshot but marks it outside the requested region', async () => {
    articleText.extract.mockReturnValueOnce({
      title: 'Mangystau only', publishedAt: null, text: 'not persisted',
      textSha256: 'c'.repeat(64), textChars: 50, titleMode: 'og_title',
      publishedAtMode: 'none', matchedGeographyKeywords: ['Мангистау'],
      matchedRequestedRegions: [], matchedPollutionKeywords: ['загрязнение'], relevant: false,
    })

    const result = await service.process(candidate, 'test-part08-run')
    expect(result).toMatchObject({ requestedRegionMatched: false })
    expect(result.document).toMatchObject({ matchedRequestedRegions: [], relevant: false })
    expect(sources.cacheExistingSourceSnapshot).toHaveBeenCalledTimes(1)
    expect(repository.persistArticleExtraction).toHaveBeenCalledTimes(1)
  })

  it('retains cached snapshot and records parser failure without throwing', async () => {
    articleText.extract.mockImplementationOnce(() => { throw new Error('raw parser detail') })
    const result = await service.process(candidate, 'test-part08-run')
    expect(result.parserFailed).toBe(true)
    expect(result).toMatchObject({ requestedRegionMatched: null })
    expect(result.document).toMatchObject({
      parserStatus: 'failed', relevant: null, matchedRequestedRegions: null,
    })
    expect(repository.markArticleParserFailure).toHaveBeenCalled()
  })

  it('rejects a redirected host with mismatched regional coverage', async () => {
    safeFetch.fetchBuffer.mockResolvedValueOnce({
      body: bytes,
      metadata: {
        requestedUrl: candidate.originalUrl, finalUrl: 'https://lada.kz/article', statusCode: 200,
        contentType: 'text/html', fetchedAt: '2026-08-06T00:00:00Z', redirects: 1,
        attempts: 1, cacheStatus: 'miss', sourceStatus: 'healthy',
      },
    })
    await expect(service.process(candidate, 'test-part08-run')).rejects.toMatchObject({
      code: 'DIRECT_SOURCE_REGION_MISMATCH',
    })
    expect(repository.ensureArticleDocument).not.toHaveBeenCalled()
  })
})
