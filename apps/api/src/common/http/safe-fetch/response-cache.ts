import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { PlatformEnvironment } from '../../../config/environment'
import type { SafeFetchMetadata } from './safe-fetch.types'

type CacheEntry = {
  body: Buffer
  metadata: Omit<SafeFetchMetadata, 'cacheStatus' | 'sourceStatus'>
  expiresAtMs: number
  staleUntilMs: number
  sizeBytes: number
}

export type SafeFetchCacheHit = {
  body: Buffer
  metadata: Omit<SafeFetchMetadata, 'cacheStatus' | 'sourceStatus'>
  state: 'fresh' | 'stale'
}

@Injectable()
export class SafeFetchResponseCache {
  private readonly entries = new Map<string, CacheEntry>()
  private readonly maximumEntries: number
  private readonly maximumBytes: number
  private totalBytes = 0

  constructor(config: ConfigService<PlatformEnvironment, true>) {
    this.maximumEntries = config.getOrThrow('SAFE_FETCH_CACHE_MAX_ENTRIES')
    this.maximumBytes = config.getOrThrow('SAFE_FETCH_CACHE_MAX_BYTES')
  }

  get(key: string, nowMs: number): SafeFetchCacheHit | null {
    const entry = this.entries.get(key)
    if (!entry) return null
    if (nowMs > entry.staleUntilMs) {
      this.delete(key, entry)
      return null
    }

    this.entries.delete(key)
    this.entries.set(key, entry)
    return {
      body: Buffer.from(entry.body),
      metadata: { ...entry.metadata },
      state: nowMs <= entry.expiresAtMs ? 'fresh' : 'stale',
    }
  }

  set(input: {
    key: string
    body: Buffer
    metadata: Omit<SafeFetchMetadata, 'cacheStatus' | 'sourceStatus'>
    nowMs: number
    ttlMs: number
    staleIfErrorMs: number
  }): void {
    if (input.body.length > this.maximumBytes) return
    const existing = this.entries.get(input.key)
    if (existing) this.delete(input.key, existing)

    const expiresAtMs = input.nowMs + input.ttlMs
    const staleUntilMs = expiresAtMs + input.staleIfErrorMs
    if (!Number.isSafeInteger(expiresAtMs) || !Number.isSafeInteger(staleUntilMs)) {
      return
    }

    const entry: CacheEntry = {
      body: Buffer.from(input.body),
      metadata: { ...input.metadata },
      expiresAtMs,
      staleUntilMs,
      sizeBytes: input.body.length,
    }
    this.entries.set(input.key, entry)
    this.totalBytes += entry.sizeBytes
    this.evictToBounds()
  }

  private evictToBounds(): void {
    while (
      this.entries.size > this.maximumEntries ||
      this.totalBytes > this.maximumBytes
    ) {
      const oldest = this.entries.entries().next().value
      if (oldest === undefined) return
      this.delete(oldest[0], oldest[1])
    }
  }

  private delete(key: string, entry: CacheEntry): void {
    if (!this.entries.delete(key)) return
    this.totalBytes -= entry.sizeBytes
  }
}
