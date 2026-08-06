import { createHash } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { SafeFetchService } from '../../common/http/safe-fetch/safe-fetch.service'
import { SafeFetchError } from '../../common/http/safe-fetch/safe-fetch.errors'
import type { FetchJsonResult } from '../../common/http/safe-fetch/safe-fetch.types'
import type { PlatformEnvironment } from '../../config/environment'
import { canonicalizeArticleUrl, parsePublicArticleUrl } from '../article/article-url'
import type { PublicArticleCandidate } from '../article/article.types'
import { findDirectSource } from '../direct-sources/direct-source-registry'
import type { NormalizedGdeltRequest } from '../ingestion.types'
import { publicIngestionError } from '../ingestion.errors'
import { buildGdeltQuery } from './gdelt-query'
import {
  GdeltArticleSchema,
  GdeltResponseSchema,
  type GdeltArticle,
  type GdeltResponse,
} from './gdelt.schemas'
import type { GdeltDiscoveryResult } from './gdelt.types'

@Injectable()
export class GdeltAdapter {
  private readonly endpoint: string
  private readonly gdeltHosts: string[]
  private readonly directHosts: string[]
  private readonly cacheTtlMs: number
  private readonly staleIfErrorMs: number
  private readonly httpMaxBytes: number
  private readonly httpTimeoutMs: number
  private readonly perDomainLimit: number

  constructor(
    private readonly safeFetch: SafeFetchService,
    config: ConfigService<PlatformEnvironment, true>,
  ) {
    this.endpoint = config.getOrThrow('GDELT_ENDPOINT_URL')
    this.gdeltHosts = config.getOrThrow('GDELT_ALLOWED_HOSTS')
    this.directHosts = config.getOrThrow('DIRECT_SOURCE_ALLOWED_HOSTS')
    this.cacheTtlMs = config.getOrThrow('GDELT_CACHE_TTL_SECONDS') * 1_000
    this.staleIfErrorMs = config.getOrThrow('GDELT_STALE_IF_ERROR_SECONDS') * 1_000
    this.httpMaxBytes = config.getOrThrow('HTTP_MAX_BYTES')
    this.httpTimeoutMs = config.getOrThrow('HTTP_TIMEOUT_MS')
    this.perDomainLimit = config.getOrThrow('DIRECT_SOURCE_MAX_ARTICLES_PER_DOMAIN')
  }

  async discover(request: NormalizedGdeltRequest): Promise<GdeltDiscoveryResult> {
    const url = buildGdeltQuery({
      endpoint: this.endpoint,
      from: request.from,
      to: request.to,
      regions: request.regions,
      maxRecords: request.maxRecords,
    })
    let response: FetchJsonResult<GdeltResponse>
    try {
      response = await this.safeFetch.fetchJson(url, GdeltResponseSchema, {
        allowedHosts: this.gdeltHosts,
        expectedContentTypes: ['application/json'],
        maxBytes: Math.min(2 * 1024 * 1024, this.httpMaxBytes),
        timeoutMs: Math.min(10_000, this.httpTimeoutMs),
        cache: { enabled: true, ttlMs: this.cacheTtlMs, staleIfErrorMs: this.staleIfErrorMs },
      })
    } catch (error) {
      if (
        error instanceof SafeFetchError &&
        (error.code === 'SAFE_FETCH_JSON_INVALID' ||
          error.code === 'SAFE_FETCH_RESPONSE_SCHEMA_INVALID')
      ) {
        throw publicIngestionError(
          'GDELT_RESPONSE_INVALID',
          'GDELT response does not match the expected schema',
        )
      }
      throw error
    }
    let invalidCandidateCount = 0
    const mapped: Array<{ candidate: PublicArticleCandidate; seen: number }> = []
    for (const raw of response.data.articles.slice(0, request.maxRecords)) {
      const parsed = GdeltArticleSchema.safeParse(raw)
      if (!parsed.success) {
        invalidCandidateCount += 1
        continue
      }
      const candidate = mapArticle(parsed.data, request)
      if (!candidate || !this.directHosts.includes(candidate.publisherHost)) {
        invalidCandidateCount += 1
        continue
      }
      mapped.push({ candidate, seen: seenTimestamp(parsed.data.seendate) })
    }
    mapped.sort((left, right) => right.seen - left.seen ||
      (left.candidate.discoveryTitle ?? '').localeCompare(right.candidate.discoveryTitle ?? '') ||
      left.candidate.originalUrl.localeCompare(right.candidate.originalUrl))
    const candidates = boundedCandidates(mapped.map(({ candidate }) => candidate), request.maxArticles, this.perDomainLimit)
    return {
      candidates,
      discoveredCount: response.data.articles.length,
      invalidCandidateCount,
      metadata: response.metadata,
      queryHash: createHash('sha256').update(url.searchParams.get('query') ?? '').digest('hex'),
    }
  }
}

function mapArticle(article: GdeltArticle, request: NormalizedGdeltRequest): PublicArticleCandidate | null {
  const url = parsePublicArticleUrl(article.url)
  if (!url) return null
  const source = findDirectSource(url.hostname)
  if (!source || !source.requestRegions.some((region) => request.regions.includes(region))) return null
  const requestedRegions = request.regions.filter((region) => source.requestRegions.includes(region))
  const title = article.title?.replace(/\s+/g, ' ').trim() ?? ''
  return {
    discoveryMode: 'gdelt',
    originalUrl: url.toString(),
    discoveryTitle: title.length > 0 && title.length <= 500 ? title : null,
    gdeltSeenAt: typeof article.seendate === 'string' && article.seendate.length <= 64 ? article.seendate : null,
    gdeltLanguage: boundedMetadata(article.language),
    gdeltSourceCountry: boundedMetadata(article.sourcecountry),
    requestedRegions,
    publisherHost: url.hostname,
    coverage: source.coverage,
  }
}

export function boundedCandidates(
  candidates: readonly PublicArticleCandidate[],
  maximum: number,
  perDomainLimit: number,
  excluded = new Set<string>(),
): PublicArticleCandidate[] {
  const result: PublicArticleCandidate[] = []
  const seen = new Set(excluded)
  const domains = new Map<string, number>()
  for (const candidate of candidates) {
    const canonical = canonicalizeArticleUrl(new URL(candidate.originalUrl))
    if (seen.has(canonical)) continue
    const count = domains.get(candidate.publisherHost) ?? 0
    if (count >= perDomainLimit) continue
    seen.add(canonical)
    domains.set(candidate.publisherHost, count + 1)
    result.push(candidate)
    if (result.length === maximum) break
  }
  return result
}

function boundedMetadata(value: string | undefined): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 100 ? value : null
}

function seenTimestamp(value: string | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY
  const gdelt = /^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/.exec(value)
  if (gdelt) return Date.UTC(Number(gdelt[1]), Number(gdelt[2]) - 1, Number(gdelt[3]), Number(gdelt[4]), Number(gdelt[5]), Number(gdelt[6]))
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}
