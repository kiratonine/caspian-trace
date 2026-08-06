import { ArticleTextService } from '../../../src/ingestion/article/article-text.service'
import { createSafeFetchConfig } from '../../safe-fetch/test-environment'

describe('ArticleTextService', () => {
  const service = new ArticleTextService(createSafeFetchConfig())
  const now = new Date('2026-08-06T00:00:00Z')

  it('extracts bounded source title/date/text and deterministic relevance metadata', () => {
    const html = `<!doctype html><html><head>
      <meta property="og:title" content="Атырау: нефтепродукты в Жайыке">
      <meta property="article:published_time" content="2025-09-12T10:30:00+05:00">
      <script>secret navigation</script></head><body><nav>menu</nav><article>
      <p>В Атырау обнаружено загрязнение реки Жайык.</p>
      <p>Материал сообщает о нефтепродуктах без вывода о виновнике.</p></article></body></html>`
    const result = service.extract(Buffer.from(html), 'GDELT title', ['atyrau'], now)
    expect(result).toMatchObject({
      title: 'Атырау: нефтепродукты в Жайыке',
      publishedAt: '2025-09-12T05:30:00.000Z', titleMode: 'og_title',
      publishedAtMode: 'article_published_time', relevant: true,
      matchedRequestedRegions: ['atyrau'],
    })
    expect(result.text).not.toContain('secret navigation')
    expect(result.textSha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('uses source JSON-LD but never a GDELT seen date as publication time', () => {
    const jsonLd = `<html><head><script type="application/ld+json">{"datePublished":"2025-09-01T01:02:03Z"}</script></head><main><p>${'Атырау загрязнение '.repeat(3)}</p></main></html>`
    expect(service.extract(Buffer.from(jsonLd), null, ['atyrau'], now).publishedAtMode).toBe('json_ld')
    const noDate = `<html><main><p>${'Атырау загрязнение '.repeat(3)}</p></main></html>`
    expect(service.extract(Buffer.from(noDate), 'Seen only', ['atyrau'], now).publishedAt).toBeNull()
  })

  it('returns null for ambiguous source dates', () => {
    const html = `<html><head>
      <meta property="article:published_time" content="2025-09-01T00:00:00Z">
      <meta property="article:published_time" content="2025-09-02T00:00:00Z">
      </head><article><p>${'Атырау загрязнение '.repeat(3)}</p></article></html>`
    expect(service.extract(Buffer.from(html), null, ['atyrau'], now)).toMatchObject({ publishedAt: null, publishedAtMode: 'none' })
  })

  it('requires both geography and pollution for relevance', () => {
    const geography = service.extract(Buffer.from(`<main><p>${'Новости Атырау и Жайыка. '.repeat(3)}</p></main>`), null, ['atyrau'], now)
    const pollution = service.extract(Buffer.from(`<main><p>${'Сообщается о загрязнении и нефтепродуктах. '.repeat(3)}</p></main>`), null, ['atyrau'], now)
    expect(geography.relevant).toBe(false)
    expect(pollution.relevant).toBe(false)
  })

  it('matches only requested regional markers for national publishers', () => {
    const atyrauOnly = service.extract(
      Buffer.from(`<main><p>${'Атырау Жайык загрязнение нефтепродуктами. '.repeat(3)}</p></main>`),
      null,
      ['mangystau'],
      now,
    )
    expect(atyrauOnly).toMatchObject({
      matchedRequestedRegions: [],
      relevant: false,
    })

    const mangystau = service.extract(
      Buffer.from(`<main><p>${'Aktau Mangystau pollution oil spill. '.repeat(3)}</p></main>`),
      null,
      ['mangystau'],
      now,
    )
    expect(mangystau).toMatchObject({
      matchedRequestedRegions: ['mangystau'],
      relevant: true,
    })
  })

  it('does not treat Caspian alone as a requested-region marker', () => {
    const result = service.extract(
      Buffer.from(`<main><p>${'Caspian Каспий pollution нефтепродукты. '.repeat(3)}</p></main>`),
      null,
      ['atyrau', 'mangystau'],
      now,
    )
    expect(result.matchedGeographyKeywords).toEqual(expect.arrayContaining(['Каспий', 'Caspian']))
    expect(result).toMatchObject({ matchedRequestedRegions: [], relevant: false })
  })

  it('rejects invalid UTF-8, empty text, excessive text, and future dates', () => {
    expect(() => service.extract(Buffer.from([0xc3, 0x28]), null, ['atyrau'], now)).toThrow('valid UTF-8')
    expect(() => service.extract(Buffer.from('<html><body><nav>only nav</nav></body></html>'), null, ['atyrau'], now)).toThrow('text is empty')
    const bounded = new ArticleTextService(createSafeFetchConfig({ DIRECT_SOURCE_TEXT_MAX_CHARS: 1_000 }))
    expect(() => bounded.extract(Buffer.from(`<main><p>${'Атырау загрязнение '.repeat(100)}</p></main>`), null, ['atyrau'], now)).toThrow('configured limit')
    const future = `<html><head><meta property="article:published_time" content="2026-08-08T01:00:00Z"></head><main><p>${'Атырау загрязнение '.repeat(3)}</p></main></html>`
    expect(service.extract(Buffer.from(future), null, ['atyrau'], now).publishedAt).toBeNull()
  })
})
