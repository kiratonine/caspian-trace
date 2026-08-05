import { isIP } from 'node:net'

import { SAFE_FETCH_SUPPORTED_CONTENT_TYPES } from './safe-fetch.constants'
import { safeFetchError } from './safe-fetch.errors'
import type {
  EffectiveSafeFetchPolicy,
  SafeFetchPolicy,
  SafeFetchRepresentation,
} from './safe-fetch.types'

const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/

export function validateSafeFetchPolicy(
  policy: SafeFetchPolicy,
  ceilings: { maxBytes: number; timeoutMs: number },
): EffectiveSafeFetchPolicy {
  if (
    typeof policy !== 'object' ||
    policy === null ||
    !Array.isArray(policy.allowedHosts) ||
    policy.allowedHosts.length === 0 ||
    !Array.isArray(policy.expectedContentTypes) ||
    policy.expectedContentTypes.length === 0
  ) {
    throw policyInvalid()
  }

  const allowedHosts = [...new Set(policy.allowedHosts)]
  if (
    allowedHosts.length !== policy.allowedHosts.length ||
    allowedHosts.some(
      (hostname) =>
        typeof hostname !== 'string' ||
        hostname !== hostname.toLowerCase() ||
        hostname.endsWith('.') ||
        isIpLiteral(hostname) ||
        !HOSTNAME_PATTERN.test(hostname),
    )
  ) {
    throw policyInvalid()
  }

  const expectedContentTypes = [...new Set(policy.expectedContentTypes)]
  if (
    expectedContentTypes.length !== policy.expectedContentTypes.length ||
    expectedContentTypes.some(
      (contentType) =>
        typeof contentType !== 'string' ||
        !SAFE_FETCH_SUPPORTED_CONTENT_TYPES.has(contentType),
    )
  ) {
    throw policyInvalid()
  }

  const maxBytes = policy.maxBytes ?? ceilings.maxBytes
  const timeoutMs = policy.timeoutMs ?? ceilings.timeoutMs
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1 ||
    maxBytes > ceilings.maxBytes ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > ceilings.timeoutMs
  ) {
    throw policyInvalid()
  }

  const cache = policy.cache ?? {
    enabled: false,
    ttlMs: 1,
    staleIfErrorMs: 0,
  }
  if (
    typeof cache !== 'object' ||
    cache === null ||
    typeof cache.enabled !== 'boolean' ||
    !Number.isSafeInteger(cache.ttlMs) ||
    cache.ttlMs < 1 ||
    !Number.isSafeInteger(cache.staleIfErrorMs) ||
    cache.staleIfErrorMs < 0
  ) {
    throw policyInvalid()
  }

  return {
    allowedHosts: allowedHosts.sort(),
    expectedContentTypes: expectedContentTypes.sort(),
    maxBytes,
    timeoutMs,
    cache: { ...cache },
  }
}

export function validateSafeFetchUrl(
  input: URL,
  allowedHosts: readonly string[],
): URL {
  if (!(input instanceof URL)) {
    throw safeFetchError('SAFE_FETCH_URL_INVALID', 'Source URL is invalid')
  }

  const url = new URL(input.toString())
  if (url.protocol !== 'https:') {
    throw safeFetchError(
      'SAFE_FETCH_HTTPS_REQUIRED',
      'Source URL must use HTTPS',
    )
  }
  if (url.username !== '' || url.password !== '') {
    throw safeFetchError(
      'SAFE_FETCH_CREDENTIALS_NOT_ALLOWED',
      'Source URL credentials are not allowed',
    )
  }
  if (url.port !== '' && url.port !== '443') {
    throw safeFetchError(
      'SAFE_FETCH_PORT_NOT_ALLOWED',
      'Source URL port is not allowed',
    )
  }
  if (url.hash !== '' || url.hostname === '') {
    throw safeFetchError('SAFE_FETCH_URL_INVALID', 'Source URL is invalid')
  }
  if (isIpLiteral(url.hostname)) {
    throw safeFetchError(
      'SAFE_FETCH_IP_LITERAL_NOT_ALLOWED',
      'Source URL IP literals are not allowed',
    )
  }
  if (url.hostname.endsWith('.')) {
    throw safeFetchError(
      'SAFE_FETCH_HOST_NOT_ALLOWED',
      'Source hostname is not allowed',
    )
  }
  if (!allowedHosts.includes(url.hostname)) {
    throw safeFetchError(
      'SAFE_FETCH_HOST_NOT_ALLOWED',
      'Source hostname is not allowed',
    )
  }
  return url
}

export function buildSafeFetchCacheKey(
  url: URL,
  policy: EffectiveSafeFetchPolicy,
  representation: SafeFetchRepresentation,
): string {
  return JSON.stringify({
    url: url.toString(),
    allowedHosts: policy.allowedHosts,
    expectedContentTypes: policy.expectedContentTypes,
    maxBytes: policy.maxBytes,
    representation,
  })
}

function isIpLiteral(hostname: string): boolean {
  const unwrapped =
    hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname
  return isIP(unwrapped) !== 0
}

function policyInvalid(): Error {
  return safeFetchError(
    'SAFE_FETCH_POLICY_INVALID',
    'Safe fetch policy is invalid',
  )
}
