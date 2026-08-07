import { z } from 'zod'

import type { DnsResolverPort } from '../../src/common/http/safe-fetch/dns-resolver.port'
import {
  SafeFetchError,
  safeFetchError,
} from '../../src/common/http/safe-fetch/safe-fetch.errors'
import type { HttpsTransportPort } from '../../src/common/http/safe-fetch/https-transport.port'
import { SafeFetchResponseCache } from '../../src/common/http/safe-fetch/response-cache'
import { SafeFetchService } from '../../src/common/http/safe-fetch/safe-fetch.service'
import type {
  SafeFetchPolicy,
  SafeFetchRuntime,
} from '../../src/common/http/safe-fetch/safe-fetch.types'
import { createSafeFetchConfig } from './test-environment'

const url = new URL('https://kazhydromet.kz/ecology?period=2025-09')
const policy: SafeFetchPolicy = {
  allowedHosts: ['kazhydromet.kz', 'www.kazhydromet.kz'],
  expectedContentTypes: ['text/plain'],
  maxBytes: 1_000,
  timeoutMs: 1_000,
  cache: { enabled: false, ttlMs: 10, staleIfErrorMs: 100 },
}
const success = {
  statusCode: 200,
  contentType: 'text/plain',
  body: Buffer.from('source text'),
}

describe('SafeFetchService', () => {
  let dnsResolver: jest.Mocked<DnsResolverPort>
  let transport: jest.Mocked<HttpsTransportPort>
  let runtime: jest.Mocked<SafeFetchRuntime>
  let resolveAllMock: jest.MockedFunction<DnsResolverPort['resolveAll']>
  let transportRequestMock: jest.MockedFunction<HttpsTransportPort['request']>
  let sleepMock: jest.MockedFunction<SafeFetchRuntime['sleep']>
  let now: number
  let service: SafeFetchService

  beforeEach(() => {
    now = 1_000
    resolveAllMock = jest.fn()
    transportRequestMock = jest.fn()
    sleepMock = jest.fn((milliseconds: number) => {
      expect(milliseconds).toBeGreaterThanOrEqual(0)
      return Promise.resolve()
    })
    dnsResolver = { resolveAll: resolveAllMock }
    transport = { request: transportRequestMock }
    runtime = {
      now: jest.fn(() => now),
      random: jest.fn(() => 0),
      sleep: sleepMock,
    }
    resolveAllMock.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
    ])
    transportRequestMock.mockResolvedValue(success)
    const config = createSafeFetchConfig()
    service = new SafeFetchService(
      config,
      dnsResolver,
      transport,
      new SafeFetchResponseCache(config),
      runtime,
    )
  })

  it('pins the actual request to a validated DNS address', async () => {
    await service.fetchBuffer(url, policy)

    expect(resolveAllMock).toHaveBeenCalledWith('kazhydromet.kz')
    const transportInput = transportRequestMock.mock.calls[0]?.[0]
    expect(transportInput?.url.hostname).toBe('kazhydromet.kz')
    expect(transportInput?.pinnedAddress).toEqual({
      address: '93.184.216.34',
      family: 4,
    })
  })

  it('blocks the whole hostname for mixed public/private DNS answers', async () => {
    resolveAllMock.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ])

    await expect(service.fetchBuffer(url, policy)).rejects.toMatchObject({
      code: 'SAFE_FETCH_PRIVATE_ADDRESS_BLOCKED',
    })
    expect(transportRequestMock).not.toHaveBeenCalled()
  })

  it('rejects an empty DNS answer without connecting', async () => {
    resolveAllMock.mockResolvedValue([])
    await expect(service.fetchBuffer(url, policy)).rejects.toMatchObject({
      code: 'SAFE_FETCH_DNS_RESOLUTION_FAILED',
    })
    expect(transportRequestMock).not.toHaveBeenCalled()
  })

  it('revalidates DNS and pins each allowed redirect', async () => {
    transportRequestMock
      .mockResolvedValueOnce({
        statusCode: 302,
        location: 'https://www.kazhydromet.kz/final',
        body: Buffer.alloc(0),
      })
      .mockResolvedValueOnce(success)
    resolveAllMock
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '1.1.1.1', family: 4 }])

    const result = await service.fetchBuffer(url, policy)

    expect(result.metadata).toMatchObject({
      finalUrl: 'https://www.kazhydromet.kz/final',
      redirects: 1,
    })
    expect(resolveAllMock).toHaveBeenNthCalledWith(2, 'www.kazhydromet.kz')
    expect(transportRequestMock.mock.calls[1]?.[0].pinnedAddress).toEqual({
      address: '1.1.1.1',
      family: 4,
    })
  })

  it.each([
    ['outside allowlist', 'https://evil.example/private', 'SAFE_FETCH_HOST_NOT_ALLOWED'],
    ['IP literal', 'https://127.0.0.1/private', 'SAFE_FETCH_IP_LITERAL_NOT_ALLOWED'],
  ])('blocks a redirect to %s before a second connection', async (caseName, location, code) => {
    expect(caseName).not.toHaveLength(0)
    transportRequestMock.mockResolvedValueOnce({
      statusCode: 302,
      location,
      body: Buffer.alloc(0),
    })

    await expect(service.fetchBuffer(url, policy)).rejects.toMatchObject({ code })
    expect(transportRequestMock).toHaveBeenCalledTimes(1)
  })

  it('blocks a redirected hostname when any new DNS answer is private', async () => {
    transportRequestMock.mockResolvedValueOnce({
      statusCode: 302,
      location: 'https://www.kazhydromet.kz/private',
      body: Buffer.alloc(0),
    })
    resolveAllMock
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '10.0.0.1', family: 4 }])

    await expect(service.fetchBuffer(url, policy)).rejects.toMatchObject({
      code: 'SAFE_FETCH_PRIVATE_ADDRESS_BLOCKED',
    })
    expect(transportRequestMock).toHaveBeenCalledTimes(1)
  })

  it('rejects a missing or repeated Location header', async () => {
    transportRequestMock.mockResolvedValue({
      statusCode: 302,
      location: ['https://kazhydromet.kz/a', 'https://kazhydromet.kz/b'],
      body: Buffer.alloc(0),
    })
    await expect(service.fetchBuffer(url, policy)).rejects.toMatchObject({
      code: 'SAFE_FETCH_REDIRECT_INVALID',
    })
  })

  it('rejects a fourth redirect', async () => {
    transportRequestMock.mockResolvedValue({
      statusCode: 302,
      location: '/next',
      body: Buffer.alloc(0),
    })
    await expect(service.fetchBuffer(url, policy)).rejects.toMatchObject({
      code: 'SAFE_FETCH_TOO_MANY_REDIRECTS',
    })
    expect(transportRequestMock).toHaveBeenCalledTimes(4)
    expect(resolveAllMock).toHaveBeenCalledTimes(4)
  })

  it('uses Retry-After and makes at most one retry', async () => {
    transportRequestMock.mockResolvedValue({
      statusCode: 429,
      retryAfter: '2',
      body: Buffer.alloc(0),
    })
    await expect(service.fetchBuffer(url, policy)).rejects.toMatchObject({
      code: 'SAFE_FETCH_RATE_LIMITED',
    })
    expect(sleepMock).toHaveBeenCalledWith(100)
    expect(transportRequestMock).toHaveBeenCalledTimes(2)
  })

  it('uses backoff for invalid Retry-After and succeeds on the retry', async () => {
    transportRequestMock
      .mockResolvedValueOnce({
        statusCode: 429,
        retryAfter: 'invalid',
        body: Buffer.alloc(0),
      })
      .mockResolvedValueOnce(success)

    const result = await service.fetchBuffer(url, policy)
    expect(sleepMock).toHaveBeenCalledWith(10)
    expect(result.metadata.attempts).toBe(2)
  })

  it.each([408, 500, 502, 503, 504])(
    'retries HTTP %s exactly once and can recover',
    async (statusCode) => {
      transportRequestMock
        .mockResolvedValueOnce({ statusCode, body: Buffer.alloc(0) })
        .mockResolvedValueOnce(success)

      await expect(service.fetchBuffer(url, policy)).resolves.toMatchObject({
        metadata: { attempts: 2 },
      })
      expect(transportRequestMock).toHaveBeenCalledTimes(2)
    },
  )

  it('does not retry 404 or TLS certificate failures', async () => {
    transportRequestMock.mockResolvedValueOnce({
      statusCode: 404,
      body: Buffer.alloc(0),
    })
    await expect(service.fetchBuffer(url, policy)).rejects.toMatchObject({
      code: 'SAFE_FETCH_HTTP_ERROR',
      retryable: false,
    })
    expect(transportRequestMock).toHaveBeenCalledTimes(1)

    transportRequestMock.mockClear()
    const tlsError = Object.assign(new Error('certificate details'), {
      code: 'ERR_TLS_CERT_ALTNAME_INVALID',
    })
    transportRequestMock.mockRejectedValueOnce(tlsError)
    await expect(service.fetchBuffer(url, policy)).rejects.toMatchObject({
      code: 'SAFE_FETCH_TLS_ERROR',
      retryable: false,
    })
    expect(transportRequestMock).toHaveBeenCalledTimes(1)
  })

  it('aborts timed-out transport attempts and retries only once', async () => {
    jest.useFakeTimers()
    transportRequestMock.mockImplementation(
      async ({ signal }) =>
        await new Promise((_, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new Error('raw abort details')),
            { once: true },
          )
        }),
    )

    try {
      const result = expect(
        service.fetchBuffer(url, { ...policy, timeoutMs: 50 }),
      ).rejects.toMatchObject({ code: 'SAFE_FETCH_TIMEOUT' })
      await jest.advanceTimersByTimeAsync(50)
      await jest.advanceTimersByTimeAsync(50)
      await result
      expect(transportRequestMock).toHaveBeenCalledTimes(2)
    } finally {
      jest.useRealTimers()
    }
  })

  it('bounds DNS resolution with the same per-request timeout', async () => {
    jest.useFakeTimers()
    resolveAllMock.mockImplementation(async () => await new Promise(() => undefined))

    try {
      const result = expect(
        service.fetchBuffer(url, { ...policy, timeoutMs: 50 }),
      ).rejects.toMatchObject({ code: 'SAFE_FETCH_TIMEOUT' })
      await jest.advanceTimersByTimeAsync(50)
      await jest.advanceTimersByTimeAsync(50)
      await result
      expect(resolveAllMock).toHaveBeenCalledTimes(2)
      expect(transportRequestMock).not.toHaveBeenCalled()
    } finally {
      jest.useRealTimers()
    }
  })

  it('serves a fresh cached copy without another DNS or network request', async () => {
    const cachedPolicy = withCache(policy)
    const first = await service.fetchBuffer(url, cachedPolicy)
    first.body[0] = 0
    const second = await service.fetchBuffer(url, cachedPolicy)

    expect(second.body.toString()).toBe('source text')
    expect(second.metadata.cacheStatus).toBe('fresh')
    expect(transportRequestMock).toHaveBeenCalledTimes(1)
    expect(resolveAllMock).toHaveBeenCalledTimes(1)
  })

  it('returns stale cache as rate_limited after exhausted 429', async () => {
    const cachedPolicy = withCache(policy)
    await service.fetchBuffer(url, cachedPolicy)
    now = 1_020
    transportRequestMock.mockResolvedValue({
      statusCode: 429,
      body: Buffer.alloc(0),
    })

    await expect(service.fetchBuffer(url, cachedPolicy)).resolves.toMatchObject({
      body: Buffer.from('source text'),
      metadata: { cacheStatus: 'stale', sourceStatus: 'rate_limited' },
    })
  })

  it.each([503, 504])(
    'returns stale cache as degraded after exhausted HTTP %s',
    async (statusCode) => {
      const cachedPolicy = withCache(policy)
      await service.fetchBuffer(url, cachedPolicy)
      now = 1_020
      transportRequestMock.mockResolvedValue({
        statusCode,
        body: Buffer.alloc(0),
      })

      await expect(service.fetchBuffer(url, cachedPolicy)).resolves.toMatchObject({
        metadata: { cacheStatus: 'stale', sourceStatus: 'degraded' },
      })
    },
  )

  it('returns stale cache as degraded after an exhausted timeout', async () => {
    const cachedPolicy = withCache(policy)
    await service.fetchBuffer(url, cachedPolicy)
    now = 1_020
    transportRequestMock.mockRejectedValue(
      safeFetchError('SAFE_FETCH_TIMEOUT', 'Source request timed out', {
        retryable: true,
        sourceStatus: 'degraded',
      }),
    )

    await expect(service.fetchBuffer(url, cachedPolicy)).resolves.toMatchObject({
      metadata: { cacheStatus: 'stale', sourceStatus: 'degraded' },
    })
    expect(transportRequestMock).toHaveBeenCalledTimes(3)
  })

  it('does not reuse cache across policy fingerprints', async () => {
    const cachedPolicy = withCache(policy)
    await service.fetchBuffer(url, cachedPolicy)
    transportRequestMock.mockResolvedValue({
      ...success,
      contentType: 'text/html',
      body: Buffer.from('<html></html>'),
    })
    await service.fetchBuffer(url, {
      ...cachedPolicy,
      expectedContentTypes: ['text/html'],
    })
    expect(transportRequestMock).toHaveBeenCalledTimes(2)
  })

  it('preserves UTF-8 text without trimming', async () => {
    transportRequestMock.mockResolvedValue({
      ...success,
      body: Buffer.from('\nКаспий \n'),
    })
    await expect(service.fetchText(url, policy)).resolves.toMatchObject({
      text: '\nКаспий \n',
    })
  })

  it('rejects invalid UTF-8', async () => {
    transportRequestMock.mockResolvedValue({
      ...success,
      body: Buffer.from([0xc3, 0x28]),
    })
    await expect(service.fetchText(url, policy)).rejects.toMatchObject({
      code: 'SAFE_FETCH_TEXT_DECODING_FAILED',
    })
  })

  it('parses and validates JSON through Zod', async () => {
    transportRequestMock.mockResolvedValue({
      ...success,
      contentType: 'application/json',
      body: Buffer.from('{"items":[1,2]}'),
    })
    const jsonPolicy = { ...policy, expectedContentTypes: ['application/json'] }
    await expect(
      service.fetchJson(
        url,
        z.object({ items: z.array(z.number().int()) }),
        jsonPolicy,
      ),
    ).resolves.toMatchObject({ data: { items: [1, 2] } })
  })

  it.each([
    ['malformed JSON', Buffer.from('{'), 'SAFE_FETCH_JSON_INVALID'],
    [
      'schema mismatch',
      Buffer.from('{"items":"wrong"}'),
      'SAFE_FETCH_RESPONSE_SCHEMA_INVALID',
    ],
  ])('rejects %s without returning an empty value', async (caseName, body, code) => {
    expect(caseName).not.toHaveLength(0)
    transportRequestMock.mockResolvedValue({
      ...success,
      contentType: 'application/json',
      body,
    })
    await expect(
      service.fetchJson(
        url,
        z.object({ items: z.array(z.number()) }),
        { ...policy, expectedContentTypes: ['application/json'] },
      ),
    ).rejects.toMatchObject({ code })
  })

  it('does not cache malformed JSON and recovers through the next network response', async () => {
    const jsonPolicy = withCache({
      ...policy,
      expectedContentTypes: ['application/json'],
    })
    const schema = z.object({ value: z.number() })
    transportRequestMock
      .mockResolvedValueOnce({
        ...success,
        contentType: 'application/json',
        body: Buffer.from('{'),
      })
      .mockResolvedValueOnce({
        ...success,
        contentType: 'application/json',
        body: Buffer.from('{"value":1}'),
      })

    await expect(service.fetchJson(url, schema, jsonPolicy)).rejects.toMatchObject({
      code: 'SAFE_FETCH_JSON_INVALID',
    })
    await expect(service.fetchJson(url, schema, jsonPolicy)).resolves.toMatchObject({
      data: { value: 1 },
      metadata: { cacheStatus: 'miss' },
    })
    expect(transportRequestMock).toHaveBeenCalledTimes(2)
  })

  it('does not cache a JSON schema mismatch', async () => {
    const jsonPolicy = withCache({
      ...policy,
      expectedContentTypes: ['application/json'],
    })
    const schema = z.object({ value: z.number() })
    transportRequestMock
      .mockResolvedValueOnce({
        ...success,
        contentType: 'application/json',
        body: Buffer.from('{"value":"wrong"}'),
      })
      .mockResolvedValueOnce({
        ...success,
        contentType: 'application/json',
        body: Buffer.from('{"value":2}'),
      })

    await expect(service.fetchJson(url, schema, jsonPolicy)).rejects.toMatchObject({
      code: 'SAFE_FETCH_RESPONSE_SCHEMA_INVALID',
    })
    await expect(service.fetchJson(url, schema, jsonPolicy)).resolves.toMatchObject({
      data: { value: 2 },
    })
    expect(transportRequestMock).toHaveBeenCalledTimes(2)
  })

  it('does not cache invalid UTF-8 text', async () => {
    const textPolicy = withCache(policy)
    transportRequestMock
      .mockResolvedValueOnce({
        ...success,
        body: Buffer.from([0xc3, 0x28]),
      })
      .mockResolvedValueOnce({ ...success, body: Buffer.from('valid text') })

    await expect(service.fetchText(url, textPolicy)).rejects.toMatchObject({
      code: 'SAFE_FETCH_TEXT_DECODING_FAILED',
    })
    await expect(service.fetchText(url, textPolicy)).resolves.toMatchObject({
      text: 'valid text',
    })
    expect(transportRequestMock).toHaveBeenCalledTimes(2)
  })

  it('preserves a valid stale entry after malformed HTTP 200 JSON', async () => {
    const jsonPolicy = withCache({
      ...policy,
      expectedContentTypes: ['application/json'],
    })
    const schema = z.object({ value: z.number() })
    transportRequestMock.mockResolvedValueOnce({
      ...success,
      contentType: 'application/json',
      body: Buffer.from('{"value":7}'),
    })
    await service.fetchJson(url, schema, jsonPolicy)

    now = 1_020
    transportRequestMock.mockResolvedValueOnce({
      ...success,
      contentType: 'application/json',
      body: Buffer.from('{'),
    })
    await expect(service.fetchJson(url, schema, jsonPolicy)).rejects.toMatchObject({
      code: 'SAFE_FETCH_JSON_INVALID',
    })

    transportRequestMock.mockResolvedValue({
      statusCode: 503,
      body: Buffer.alloc(0),
    })
    await expect(service.fetchJson(url, schema, jsonPolicy)).resolves.toMatchObject({
      data: { value: 7 },
      metadata: { cacheStatus: 'stale', sourceStatus: 'degraded' },
    })
    expect(transportRequestMock).toHaveBeenCalledTimes(4)
  })

  it('caches only validated text and JSON as fresh hits', async () => {
    const textPolicy = withCache(policy)
    const jsonPolicy = withCache({
      ...policy,
      expectedContentTypes: ['application/json'],
    })
    const schema = z.object({ value: z.number() })
    transportRequestMock
      .mockResolvedValueOnce({ ...success, body: Buffer.from('valid text') })
      .mockResolvedValueOnce({
        ...success,
        contentType: 'application/json',
        body: Buffer.from('{"value":9}'),
      })

    await service.fetchText(url, textPolicy)
    await expect(service.fetchText(url, textPolicy)).resolves.toMatchObject({
      text: 'valid text',
      metadata: { cacheStatus: 'fresh' },
    })
    await service.fetchJson(url, schema, jsonPolicy)
    await expect(service.fetchJson(url, schema, jsonPolicy)).resolves.toMatchObject({
      data: { value: 9 },
      metadata: { cacheStatus: 'fresh' },
    })
    expect(transportRequestMock).toHaveBeenCalledTimes(2)
  })

  it('revalidates cached JSON with every supplied schema', async () => {
    transportRequestMock.mockResolvedValue({
      ...success,
      contentType: 'application/json',
      body: Buffer.from('{"value":1}'),
    })
    const jsonPolicy = withCache({
      ...policy,
      expectedContentTypes: ['application/json'],
    })
    await service.fetchJson(url, z.object({ value: z.number() }), jsonPolicy)

    await expect(
      service.fetchJson(url, z.object({ value: z.string() }), jsonPolicy),
    ).rejects.toMatchObject({ code: 'SAFE_FETCH_RESPONSE_SCHEMA_INVALID' })
    expect(transportRequestMock).toHaveBeenCalledTimes(1)
  })

  it('normalizes raw network errors without exposing their details', async () => {
    transportRequestMock.mockRejectedValue(
      new Error('secret query and socket details'),
    )
    let thrown: unknown
    try {
      await service.fetchBuffer(url, policy)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(SafeFetchError)
    expect(thrown).toMatchObject({
      code: 'SAFE_FETCH_NETWORK_ERROR',
      message: 'Source network request failed',
    })
    expect(String(thrown)).not.toContain('secret query')
  })
})

function withCache(input: SafeFetchPolicy): SafeFetchPolicy {
  return {
    ...input,
    cache: { enabled: true, ttlMs: 10, staleIfErrorMs: 100 },
  }
}
