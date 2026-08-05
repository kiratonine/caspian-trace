import type { z } from 'zod'

export type SafeFetchPolicy = {
  allowedHosts: readonly string[]
  expectedContentTypes: readonly string[]
  maxBytes?: number
  timeoutMs?: number
  cache?: {
    enabled: boolean
    ttlMs: number
    staleIfErrorMs: number
  }
}

export type SafeFetchMetadata = {
  requestedUrl: string
  finalUrl: string
  statusCode: number
  contentType: string
  fetchedAt: string
  redirects: number
  attempts: number
  cacheStatus: 'miss' | 'fresh' | 'stale'
  sourceStatus: 'healthy' | 'degraded' | 'rate_limited'
}

export type FetchBufferResult = {
  body: Buffer
  metadata: SafeFetchMetadata
}

export type FetchTextResult = {
  text: string
  metadata: SafeFetchMetadata
}

export type FetchJsonResult<T> = {
  data: T
  metadata: SafeFetchMetadata
}

export type SafeFetchJsonSchema<T> = z.ZodType<T>

export type EffectiveSafeFetchPolicy = {
  allowedHosts: readonly string[]
  expectedContentTypes: readonly string[]
  maxBytes: number
  timeoutMs: number
  cache: {
    enabled: boolean
    ttlMs: number
    staleIfErrorMs: number
  }
}

export type PinnedAddress = {
  address: string
  family: 4 | 6
}

export type SafeFetchRepresentation = 'buffer' | 'text' | 'json'

export type SafeFetchRuntime = {
  now(): number
  random(): number
  sleep(milliseconds: number): Promise<void>
}
