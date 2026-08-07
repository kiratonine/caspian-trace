import {
  validateSafeFetchPolicy,
  validateSafeFetchUrl,
} from '../../src/common/http/safe-fetch/safe-url'
import { SafeFetchError } from '../../src/common/http/safe-fetch/safe-fetch.errors'
import type { SafeFetchErrorCode } from '../../src/common/http/safe-fetch/safe-fetch.errors'

const ceilings = { maxBytes: 1_000, timeoutMs: 2_000 }
const policy = {
  allowedHosts: ['kazhydromet.kz'],
  expectedContentTypes: ['text/html'],
}

describe('SafeFetch URL and policy validation', () => {
  it('accepts an exact allowed HTTPS hostname', () => {
    expect(
      validateSafeFetchUrl(
        new URL('https://kazhydromet.kz/ecology?period=2025-09'),
        policy.allowedHosts,
      ).hostname,
    ).toBe('kazhydromet.kz')
  })

  it.each([
    ['HTTP', 'http://kazhydromet.kz/ecology', 'SAFE_FETCH_HTTPS_REQUIRED'],
    [
      'credentials',
      'https://user:secret@kazhydromet.kz/ecology',
      'SAFE_FETCH_CREDENTIALS_NOT_ALLOWED',
    ],
    [
      'non-443 port',
      'https://kazhydromet.kz:444/ecology',
      'SAFE_FETCH_PORT_NOT_ALLOWED',
    ],
    [
      'IPv4 literal',
      'https://127.0.0.1/ecology',
      'SAFE_FETCH_IP_LITERAL_NOT_ALLOWED',
    ],
    [
      'IPv6 literal',
      'https://[::1]/ecology',
      'SAFE_FETCH_IP_LITERAL_NOT_ALLOWED',
    ],
    [
      'trailing dot',
      'https://kazhydromet.kz./ecology',
      'SAFE_FETCH_HOST_NOT_ALLOWED',
    ],
    [
      'suffix lookalike',
      'https://kazhydromet.kz.evil.example/ecology',
      'SAFE_FETCH_HOST_NOT_ALLOWED',
    ],
    [
      'fragment',
      'https://kazhydromet.kz/ecology#page=1',
      'SAFE_FETCH_URL_INVALID',
    ],
  ] as ReadonlyArray<readonly [string, string, SafeFetchErrorCode]>)(
    'rejects %s URLs',
    (caseName, value, code) => {
      expect(caseName).not.toHaveLength(0)
      expectSafeFetchCode(
        () => validateSafeFetchUrl(new URL(value), policy.allowedHosts),
        code,
      )
    },
  )

  it.each([
    [{ ...policy, allowedHosts: [] }],
    [{ ...policy, allowedHosts: ['*.kazhydromet.kz'] }],
    [{ ...policy, allowedHosts: ['KAZHYDROMET.KZ'] }],
    [{ ...policy, expectedContentTypes: [] }],
    [{ ...policy, expectedContentTypes: ['text/*'] }],
    [{ ...policy, maxBytes: 1_001 }],
    [{ ...policy, maxBytes: 0 }],
    [{ ...policy, timeoutMs: 2_001 }],
    [
      {
        ...policy,
        cache: { enabled: true, ttlMs: 0, staleIfErrorMs: 1 },
      },
    ],
  ])('rejects an invalid policy %#', (candidate) => {
    expect(() => validateSafeFetchPolicy(candidate, ceilings)).toThrow(
      SafeFetchError,
    )
  })

  it('sorts policy fingerprints without increasing platform ceilings', () => {
    expect(
      validateSafeFetchPolicy(
        {
          allowedHosts: ['www.kazhydromet.kz', 'kazhydromet.kz'],
          expectedContentTypes: ['text/plain', 'text/html'],
          maxBytes: 100,
          timeoutMs: 250,
        },
        ceilings,
      ),
    ).toMatchObject({
      allowedHosts: ['kazhydromet.kz', 'www.kazhydromet.kz'],
      expectedContentTypes: ['text/html', 'text/plain'],
      maxBytes: 100,
      timeoutMs: 250,
    })
  })
})

function expectSafeFetchCode(
  callback: () => unknown,
  code: SafeFetchErrorCode,
): void {
  try {
    callback()
  } catch (error) {
    expect(error).toMatchObject({ code })
    return
  }
  throw new Error(`Expected ${code}`)
}
