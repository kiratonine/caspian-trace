import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { PlatformEnvironment } from '../../../config/environment'
import {
  SAFE_FETCH_DNS_RESOLVER,
  SAFE_FETCH_MAX_REDIRECTS,
  SAFE_FETCH_MAX_RETRIES,
  SAFE_FETCH_REDIRECT_STATUSES,
  SAFE_FETCH_RETRYABLE_STATUSES,
  SAFE_FETCH_RUNTIME,
  SAFE_FETCH_TRANSPORT,
} from './safe-fetch.constants'
import { SafeFetchError, safeFetchError } from './safe-fetch.errors'
import type { DnsResolverPort } from './dns-resolver.port'
import type {
  HttpsTransportPort,
  SafeFetchTransportResponse,
} from './https-transport.port'
import { isPublicIpAddress } from './public-ip'
import { SafeFetchResponseCache } from './response-cache'
import {
  calculateBackoffMilliseconds,
  parseRetryAfterMilliseconds,
} from './retry-policy'
import {
  buildSafeFetchCacheKey,
  validateSafeFetchPolicy,
  validateSafeFetchUrl,
} from './safe-url'
import type {
  EffectiveSafeFetchPolicy,
  FetchBufferResult,
  FetchJsonResult,
  FetchTextResult,
  PinnedAddress,
  SafeFetchJsonSchema,
  SafeFetchMetadata,
  SafeFetchPolicy,
  SafeFetchRepresentation,
  SafeFetchRuntime,
} from './safe-fetch.types'

type NetworkResult = {
  body: Buffer
  metadata: Omit<SafeFetchMetadata, 'cacheStatus' | 'sourceStatus'>
}

type RepresentationResult<T> = {
  value: T
  metadata: SafeFetchMetadata
}

@Injectable()
export class SafeFetchService {
  private readonly maximumBytes: number
  private readonly maximumTimeoutMs: number
  private readonly userAgent: string
  private readonly retryBaseDelayMs: number
  private readonly retryMaximumDelayMs: number

  constructor(
    config: ConfigService<PlatformEnvironment, true>,
    @Inject(SAFE_FETCH_DNS_RESOLVER)
    private readonly dnsResolver: DnsResolverPort,
    @Inject(SAFE_FETCH_TRANSPORT)
    private readonly transport: HttpsTransportPort,
    private readonly cache: SafeFetchResponseCache,
    @Inject(SAFE_FETCH_RUNTIME)
    private readonly runtime: SafeFetchRuntime,
  ) {
    this.maximumBytes = config.getOrThrow('HTTP_MAX_BYTES')
    this.maximumTimeoutMs = config.getOrThrow('HTTP_TIMEOUT_MS')
    this.userAgent = config.getOrThrow('SAFE_FETCH_USER_AGENT')
    this.retryBaseDelayMs = config.getOrThrow(
      'SAFE_FETCH_RETRY_BASE_DELAY_MS',
    )
    this.retryMaximumDelayMs = config.getOrThrow(
      'SAFE_FETCH_RETRY_MAX_DELAY_MS',
    )
  }

  async fetchBuffer(
    url: URL,
    policy: SafeFetchPolicy,
  ): Promise<FetchBufferResult> {
    const result = await this.fetchRepresentation(
      url,
      policy,
      'buffer',
      (body) => Buffer.from(body),
    )
    return { body: result.value, metadata: result.metadata }
  }

  async fetchText(
    url: URL,
    policy: SafeFetchPolicy,
  ): Promise<FetchTextResult> {
    const result = await this.fetchRepresentation(
      url,
      policy,
      'text',
      decodeUtf8,
    )
    return { text: result.value, metadata: result.metadata }
  }

  async fetchJson<T>(
    url: URL,
    schema: SafeFetchJsonSchema<T>,
    policy: SafeFetchPolicy,
  ): Promise<FetchJsonResult<T>> {
    const result = await this.fetchRepresentation(
      url,
      policy,
      'json',
      (body) => decodeAndValidateJson(body, schema),
    )
    return { data: result.value, metadata: result.metadata }
  }

  private async fetchRepresentation<T>(
    inputUrl: URL,
    inputPolicy: SafeFetchPolicy,
    representation: SafeFetchRepresentation,
    validate: (body: Buffer) => T,
  ): Promise<RepresentationResult<T>> {
    const policy = validateSafeFetchPolicy(inputPolicy, {
      maxBytes: this.maximumBytes,
      timeoutMs: this.maximumTimeoutMs,
    })
    const requestedUrl = validateSafeFetchUrl(inputUrl, policy.allowedHosts)
    const cacheKey = buildSafeFetchCacheKey(
      requestedUrl,
      policy,
      representation,
    )

    if (policy.cache.enabled) {
      const cached = this.cache.get(cacheKey, this.runtime.now())
      if (cached?.state === 'fresh') {
        return {
          value: validate(cached.body),
          metadata: {
            ...cached.metadata,
            cacheStatus: 'fresh',
            sourceStatus: 'healthy',
          },
        }
      }
    }

    try {
      const network = await this.fetchWithRetry(requestedUrl, policy)
      const value = validate(network.body)
      if (policy.cache.enabled) {
        this.cache.set({
          key: cacheKey,
          body: network.body,
          metadata: network.metadata,
          nowMs: this.runtime.now(),
          ttlMs: policy.cache.ttlMs,
          staleIfErrorMs: policy.cache.staleIfErrorMs,
        })
      }
      return {
        value,
        metadata: {
          ...network.metadata,
          cacheStatus: 'miss',
          sourceStatus: 'healthy',
        },
      }
    } catch (error) {
      const normalized = normalizeNetworkError(error)
      if (policy.cache.enabled && normalized.retryable) {
        const cached = this.cache.get(cacheKey, this.runtime.now())
        if (cached?.state === 'stale') {
          return {
            value: validate(cached.body),
            metadata: {
              ...cached.metadata,
              cacheStatus: 'stale',
              sourceStatus:
                normalized.sourceStatus === 'rate_limited'
                  ? 'rate_limited'
                  : 'degraded',
            },
          }
        }
      }
      throw normalized
    }
  }

  private async fetchWithRetry(
    requestedUrl: URL,
    policy: EffectiveSafeFetchPolicy,
  ): Promise<NetworkResult> {
    let lastError: SafeFetchError | undefined
    for (let retryIndex = 0; retryIndex <= SAFE_FETCH_MAX_RETRIES; retryIndex += 1) {
      try {
        const result = await this.fetchAttempt(requestedUrl, policy)
        return {
          body: result.body,
          metadata: {
            requestedUrl: requestedUrl.toString(),
            finalUrl: result.finalUrl.toString(),
            statusCode: result.statusCode,
            contentType: result.contentType,
            fetchedAt: new Date(this.runtime.now()).toISOString(),
            redirects: result.redirects,
            attempts: retryIndex + 1,
          },
        }
      } catch (error) {
        const normalized = normalizeNetworkError(error)
        lastError = normalized
        if (!normalized.retryable || retryIndex === SAFE_FETCH_MAX_RETRIES) {
          throw normalized
        }
        const retryAfter =
          normalized.code === 'SAFE_FETCH_RATE_LIMITED'
            ? parseRetryAfterMilliseconds(
                normalized.retryAfter,
                this.runtime.now(),
                this.retryMaximumDelayMs,
              )
            : null
        const delayMs =
          retryAfter ??
          calculateBackoffMilliseconds({
            retryIndex,
            baseDelayMs: this.retryBaseDelayMs,
            maximumDelayMs: this.retryMaximumDelayMs,
            random: this.runtime.random(),
          })
        await this.runtime.sleep(delayMs)
      }
    }
    throw lastError ?? networkError()
  }

  private async fetchAttempt(
    requestedUrl: URL,
    policy: EffectiveSafeFetchPolicy,
  ): Promise<{
    body: Buffer
    finalUrl: URL
    statusCode: number
    contentType: string
    redirects: number
  }> {
    let currentUrl = requestedUrl
    let redirects = 0

    while (true) {
      currentUrl = validateSafeFetchUrl(currentUrl, policy.allowedHosts)
      const response = await this.resolveAndRequestWithTimeout(currentUrl, policy)

      if (SAFE_FETCH_REDIRECT_STATUSES.has(response.statusCode)) {
        if (redirects === SAFE_FETCH_MAX_REDIRECTS) {
          throw safeFetchError(
            'SAFE_FETCH_TOO_MANY_REDIRECTS',
            'Source returned too many redirects',
          )
        }
        if (typeof response.location !== 'string' || response.location === '') {
          throw safeFetchError(
            'SAFE_FETCH_REDIRECT_INVALID',
            'Source redirect is invalid',
          )
        }
        try {
          currentUrl = new URL(response.location, currentUrl)
        } catch {
          throw safeFetchError(
            'SAFE_FETCH_REDIRECT_INVALID',
            'Source redirect is invalid',
          )
        }
        redirects += 1
        continue
      }

      if (response.statusCode < 200 || response.statusCode > 299) {
        throw statusError(response)
      }
      if (response.contentType === undefined) {
        throw safeFetchError(
          'SAFE_FETCH_CONTENT_TYPE_MISMATCH',
          'Source content type does not match the expected type',
        )
      }
      return {
        body: response.body,
        finalUrl: currentUrl,
        statusCode: response.statusCode,
        contentType: response.contentType,
        redirects,
      }
    }
  }

  private async resolveAndPin(hostname: string): Promise<PinnedAddress> {
    const addresses = await this.dnsResolver.resolveAll(hostname)
    if (addresses.length === 0) {
      throw safeFetchError(
        'SAFE_FETCH_DNS_RESOLUTION_FAILED',
        'Source hostname could not be resolved',
      )
    }
    if (addresses.some(({ address }) => !isPublicIpAddress(address))) {
      throw safeFetchError(
        'SAFE_FETCH_PRIVATE_ADDRESS_BLOCKED',
        'Source hostname resolves to a blocked address',
      )
    }
    const selected = addresses[0]
    if (selected === undefined) {
      throw safeFetchError(
        'SAFE_FETCH_DNS_RESOLUTION_FAILED',
        'Source hostname could not be resolved',
      )
    }
    return selected
  }

  private async resolveAndRequestWithTimeout(
    url: URL,
    policy: EffectiveSafeFetchPolicy,
  ): Promise<SafeFetchTransportResponse> {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(timeoutError())
      }, policy.timeoutMs)
    })
    const request = async (): Promise<SafeFetchTransportResponse> => {
      const pinnedAddress = await this.resolveAndPin(url.hostname)
      if (controller.signal.aborted) throw timeoutError()
      return await this.transport.request({
        url,
        pinnedAddress,
        signal: controller.signal,
        userAgent: this.userAgent,
        expectedContentTypes: policy.expectedContentTypes,
        maxBytes: policy.maxBytes,
      })
    }

    try {
      return await Promise.race([request(), timeout])
    } catch (error) {
      if (controller.signal.aborted) throw timeoutError()
      throw normalizeNetworkError(error)
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
  }
}

function timeoutError(): SafeFetchError {
  return safeFetchError('SAFE_FETCH_TIMEOUT', 'Source request timed out', {
    retryable: true,
    sourceStatus: 'degraded',
  })
}

function decodeUtf8(body: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body)
  } catch {
    throw safeFetchError(
      'SAFE_FETCH_TEXT_DECODING_FAILED',
      'Source response is not valid UTF-8 text',
    )
  }
}

function decodeAndValidateJson<T>(
  body: Buffer,
  schema: SafeFetchJsonSchema<T>,
): T {
  let json: unknown
  try {
    json = JSON.parse(decodeUtf8(body)) as unknown
  } catch (error) {
    if (error instanceof SafeFetchError) throw error
    throw safeFetchError(
      'SAFE_FETCH_JSON_INVALID',
      'Source response is not valid JSON',
    )
  }

  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw safeFetchError(
      'SAFE_FETCH_RESPONSE_SCHEMA_INVALID',
      'Source response does not match the expected schema',
    )
  }
  return parsed.data
}

function statusError(response: SafeFetchTransportResponse): SafeFetchError {
  if (response.statusCode === 429) {
    return safeFetchError(
      'SAFE_FETCH_RATE_LIMITED',
      'Source rate limit was reached',
      {
        statusCode: 429,
        retryable: true,
        sourceStatus: 'rate_limited',
        retryAfter: response.retryAfter,
      },
    )
  }
  const retryable = SAFE_FETCH_RETRYABLE_STATUSES.has(response.statusCode)
  return safeFetchError('SAFE_FETCH_HTTP_ERROR', 'Source returned an HTTP error', {
    statusCode: response.statusCode,
    retryable,
    sourceStatus: retryable ? 'degraded' : undefined,
  })
}

function normalizeNetworkError(error: unknown): SafeFetchError {
  if (error instanceof SafeFetchError) return error
  if (isTlsError(error)) {
    return safeFetchError(
      'SAFE_FETCH_TLS_ERROR',
      'Source TLS verification failed',
    )
  }
  return networkError()
}

function networkError(): SafeFetchError {
  return safeFetchError(
    'SAFE_FETCH_NETWORK_ERROR',
    'Source network request failed',
    { retryable: true, sourceStatus: 'degraded' },
  )
}

function isTlsError(error: unknown): boolean {
  if (!(error instanceof Error) || !('code' in error)) return false
  const code = error.code
  return (
    typeof code === 'string' &&
    (code.startsWith('ERR_TLS_') ||
      code.startsWith('CERT_') ||
      code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
      code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
      code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
      code === 'ERR_TLS_CERT_ALTNAME_INVALID')
  )
}
