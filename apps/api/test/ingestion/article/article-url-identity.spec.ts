import { createHash } from 'node:crypto'

import { buildArticleIdentity } from '../../../src/ingestion/article/article-document-identity'
import { canonicalizeArticleUrl, parsePublicArticleUrl } from '../../../src/ingestion/article/article-url'
import { findDirectSource } from '../../../src/ingestion/direct-sources/direct-source-registry'

describe('public article URL and identity', () => {
  it('removes only known tracking parameters and sorts meaningful query', () => {
    expect(canonicalizeArticleUrl(new URL(
      'https://AZH.kz/article?utm_source=x&b=2&a=1&token=keep#section',
    ))).toBe('https://azh.kz/article?a=1&b=2&token=keep')
  })

  it('rejects non-HTTPS, credentials, and non-default ports', () => {
    expect(parsePublicArticleUrl('http://azh.kz/article')).toBeNull()
    expect(parsePublicArticleUrl('https://user:pass@azh.kz/article')).toBeNull()
    expect(parsePublicArticleUrl('https://azh.kz:444/article')).toBeNull()
  })

  it('builds deterministic versioned IDs and preserves discovered original URL', () => {
    const source = findDirectSource('azh.kz')!
    const common = {
      candidate: {
        discoveryMode: 'gdelt' as const,
        originalUrl: 'https://azh.kz/article?utm_source=gdelt',
        discoveryTitle: 'Source title', gdeltSeenAt: '20250930T120000Z',
        gdeltLanguage: 'Russian', gdeltSourceCountry: 'Kazakhstan',
        requestedRegions: ['atyrau'] as ['atyrau'], publisherHost: 'azh.kz',
        coverage: source.coverage,
      },
      source,
      canonicalUrl: 'https://azh.kz/article',
      runId: 'test-part08-run',
    }
    const first = buildArticleIdentity({ ...common, sha256: createHash('sha256').update('one').digest('hex') })
    const repeat = buildArticleIdentity({ ...common, sha256: createHash('sha256').update('one').digest('hex') })
    const changed = buildArticleIdentity({ ...common, sha256: createHash('sha256').update('two').digest('hex') })
    expect(first).toEqual(repeat)
    expect(changed.id).not.toBe(first.id)
    expect(first.originalUrl).toContain('utm_source=gdelt')
    expect(first.id).toMatch(/^doc-article-azh-kz-[0-9a-f]{12}-[0-9a-f]{12}$/)
  })
})
