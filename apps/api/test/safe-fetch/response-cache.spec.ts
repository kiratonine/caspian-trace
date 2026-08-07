import { SafeFetchResponseCache } from '../../src/common/http/safe-fetch/response-cache'
import { createSafeFetchConfig } from './test-environment'

const metadata = {
  requestedUrl: 'https://kazhydromet.kz/a',
  finalUrl: 'https://kazhydromet.kz/a',
  statusCode: 200,
  contentType: 'text/plain',
  fetchedAt: '2026-08-05T00:00:00.000Z',
  redirects: 0,
  attempts: 1,
}

describe('SafeFetchResponseCache', () => {
  it('returns copies and distinguishes fresh, stale, and expired entries', () => {
    const cache = createCache(2, 10)
    const original = Buffer.from('abc')
    cache.set({
      key: 'a',
      body: original,
      metadata,
      nowMs: 100,
      ttlMs: 10,
      staleIfErrorMs: 20,
    })
    original[0] = 0

    const fresh = cache.get('a', 110)
    expect(fresh).toMatchObject({ state: 'fresh' })
    expect(fresh?.body.toString()).toBe('abc')
    if (fresh) fresh.body[0] = 0
    expect(cache.get('a', 111)?.body.toString()).toBe('abc')
    expect(cache.get('a', 130)).toMatchObject({ state: 'stale' })
    expect(cache.get('a', 131)).toBeNull()
  })

  it('evicts the least recently used entry by entry count', () => {
    const cache = createCache(2, 100)
    set(cache, 'a', 'a')
    set(cache, 'b', 'b')
    expect(cache.get('a', 1)).not.toBeNull()
    set(cache, 'c', 'c')

    expect(cache.get('b', 1)).toBeNull()
    expect(cache.get('a', 1)).not.toBeNull()
    expect(cache.get('c', 1)).not.toBeNull()
  })

  it('evicts to the total byte bound and skips oversized objects', () => {
    const cache = createCache(5, 4)
    set(cache, 'a', 'abc')
    set(cache, 'b', 'de')
    expect(cache.get('a', 1)).toBeNull()
    expect(cache.get('b', 1)?.body.toString()).toBe('de')

    set(cache, 'large', '12345')
    expect(cache.get('large', 1)).toBeNull()
  })
})

function set(
  cache: SafeFetchResponseCache,
  key: string,
  value: string,
): void {
  cache.set({
    key,
    body: Buffer.from(value),
    metadata,
    nowMs: 0,
    ttlMs: 10,
    staleIfErrorMs: 10,
  })
}

function createCache(
  maximumEntries: number,
  maximumBytes: number,
): SafeFetchResponseCache {
  return new SafeFetchResponseCache(
    createSafeFetchConfig({
      SAFE_FETCH_CACHE_MAX_ENTRIES: maximumEntries,
      SAFE_FETCH_CACHE_MAX_BYTES: maximumBytes,
    }),
  )
}
