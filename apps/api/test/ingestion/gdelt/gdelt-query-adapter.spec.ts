import { GdeltAdapter } from '../../../src/ingestion/gdelt/gdelt.adapter'
import { buildGdeltQuery } from '../../../src/ingestion/gdelt/gdelt-query'
import { GdeltResponseSchema } from '../../../src/ingestion/gdelt/gdelt.schemas'
import { createSafeFetchConfig } from '../../safe-fetch/test-environment'
import type { NormalizedGdeltRequest } from '../../../src/ingestion/ingestion.types'
import { SafeFetchError } from '../../../src/common/http/safe-fetch/safe-fetch.errors'

describe('GDELT query and adapter security boundary', () => {
  it('builds only fixed DOC 2.0 parameters with exact UTC timestamps and bounded records', () => {
    const url = buildGdeltQuery({
      endpoint: 'https://api.gdeltproject.org/api/v2/doc/doc',
      from: new Date('2025-09-01T00:00:00Z'), to: new Date('2025-09-30T23:59:59Z'),
      regions: ['atyrau', 'mangystau'], maxRecords: 99,
    })
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      mode: 'artlist', format: 'json', maxrecords: '25', sort: 'datedesc',
      startdatetime: '20250901000000', enddatetime: '20250930235959',
    })
    expect(url.searchParams.get('query')).toContain('Атырау')
    expect(url.searchParams.get('query')).toContain('Мангистау')
    expect(url.searchParams.get('query')).toContain('нефтепродукты')
    expect([...url.searchParams.keys()].sort()).toEqual([
      'enddatetime', 'format', 'maxrecords', 'mode', 'query', 'sort', 'startdatetime',
    ])
  })

  it('validates top-level response while allowing invalid article items to be counted', () => {
    expect(GdeltResponseSchema.safeParse({ articles: [{ url: 'bad' }] }).success).toBe(true)
    expect(GdeltResponseSchema.safeParse({ articles: [] }).success).toBe(true)
    expect(GdeltResponseSchema.safeParse({}).success).toBe(false)
    expect(GdeltResponseSchema.safeParse({ error: 'rate limit' }).success).toBe(false)
    expect(GdeltResponseSchema.safeParse({ articles: 'bad' }).success).toBe(false)
    expect(GdeltResponseSchema.safeParse({ articles: Array(101).fill({}) }).success).toBe(false)
  })

  it('normalizes fail-closed JSON/schema errors without exposing validation issues', async () => {
    const fetchJson = jest.fn().mockRejectedValue(new SafeFetchError({
      code: 'SAFE_FETCH_RESPONSE_SCHEMA_INVALID',
      safeMessage: 'raw schema detail',
    }))
    const adapter = new GdeltAdapter({ fetchJson } as never, createSafeFetchConfig())
    await expect(adapter.discover(request())).rejects.toMatchObject({
      code: 'GDELT_RESPONSE_INVALID',
      safeMessage: 'GDELT response does not match the expected schema',
    })
  })

  it('authorizes actual URL host, never GDELT domain, and applies dedup/domain limits', async () => {
    const fetchJson = jest.fn().mockResolvedValue({
      data: { articles: [
        { url: 'https://azh.kz/article?utm_source=gdelt', title: 'B', seendate: '20250901T000000Z', domain: 'evil.example' },
        { url: 'https://azh.kz/article?utm_source=other', title: 'A', seendate: '20250902T000000Z' },
        { url: 'https://evil.example/article', title: 'External', domain: 'azh.kz' },
        { url: 'not a url' },
      ] },
      metadata: {
        requestedUrl: 'https://api.gdeltproject.org/api/v2/doc/doc', finalUrl: 'https://api.gdeltproject.org/api/v2/doc/doc',
        statusCode: 200, contentType: 'application/json', fetchedAt: '2026-08-06T00:00:00Z',
        redirects: 0, attempts: 1, cacheStatus: 'miss', sourceStatus: 'healthy',
      },
    })
    const adapter = new GdeltAdapter({ fetchJson } as never, createSafeFetchConfig())
    const result = await adapter.discover(request())
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]?.publisherHost).toBe('azh.kz')
    expect(result.invalidCandidateCount).toBe(2)
    expect(fetchJson).toHaveBeenCalledTimes(1)
  })
})

function request(): NormalizedGdeltRequest {
  return {
    from: new Date('2025-09-01T00:00:00Z'), to: new Date('2025-09-30T23:59:59Z'),
    regions: ['atyrau'] as ['atyrau'], maxRecords: 25, maxArticles: 5, includeDirectFallback: true,
  }
}
