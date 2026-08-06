import { createHash } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { SafeFetchService } from '../../common/http/safe-fetch/safe-fetch.service'
import type {
  FetchTextResult,
  SafeFetchMetadata,
} from '../../common/http/safe-fetch/safe-fetch.types'
import type { PlatformEnvironment } from '../../config/environment'
import { kazhydrometError } from '../ingestion.errors'
import type { NormalizedKazhydrometRequest } from '../ingestion.types'
import { discoverPdfCandidates } from './kazhydromet-discovery'
import type { KazhydrometRawSnapshot, PdfCandidate } from './kazhydromet.types'

export interface KazhydrometDiscoveryResult {
  candidates: PdfCandidate[]
  metadata: SafeFetchMetadata
}

@Injectable()
export class KazhydrometAdapter {
  private readonly listingUrl: string
  private readonly allowedHosts: readonly string[]
  private readonly timeoutMs: number
  private readonly maxBytes: number

  constructor(
    private readonly safeFetch: SafeFetchService,
    config: ConfigService<PlatformEnvironment, true>,
  ) {
    this.listingUrl = config.getOrThrow('KAZHYDROMET_BULLETINS_URL')
    this.allowedHosts = config.getOrThrow('KAZHYDROMET_ALLOWED_HOSTS')
    this.timeoutMs = config.getOrThrow('HTTP_TIMEOUT_MS')
    this.maxBytes = config.getOrThrow('HTTP_MAX_BYTES')
  }

  async discover(request: NormalizedKazhydrometRequest): Promise<KazhydrometDiscoveryResult> {
    const listingUrls = [new URL(this.listingUrl), ...requestedYearUrls(this.listingUrl, request)]
    const candidates = new Map<string, PdfCandidate>()
    let lastMetadata: SafeFetchMetadata | undefined
    let worstStatus: SafeFetchMetadata['sourceStatus'] = 'healthy'
    let firstError: unknown
    for (const listingUrl of listingUrls) {
      try {
        const result = await this.fetchListing(listingUrl)
        lastMetadata = result.metadata
        worstStatus = worseSourceStatus(worstStatus, result.metadata.sourceStatus)
        for (const candidate of discoverPdfCandidates({
          html: result.text,
          listingFinalUrl: result.metadata.finalUrl,
          allowedHosts: this.allowedHosts,
          request: { ...request, maxDocuments: 10 },
        })) candidates.set(candidate.canonicalUrl, candidate)
      } catch (error) {
        firstError ??= error
        worstStatus = worseSourceStatus(worstStatus, 'degraded')
      }
    }
    if (!lastMetadata) throw firstError
    return {
      candidates: [...candidates.values()]
        .sort((left, right) =>
          (left.publishedPeriod ?? '').localeCompare(right.publishedPeriod ?? '') ||
          (left.regions[0] ?? '').localeCompare(right.regions[0] ?? '') ||
          right.confidence - left.confidence ||
          left.canonicalUrl.localeCompare(right.canonicalUrl),
        )
        .slice(0, request.maxDocuments),
      metadata: { ...lastMetadata, sourceStatus: worstStatus },
    }
  }

  private fetchListing(url: URL): Promise<FetchTextResult> {
    return this.safeFetch.fetchText(url, {
      allowedHosts: this.allowedHosts,
      expectedContentTypes: ['text/html'],
      maxBytes: 2 * 1024 * 1024,
      timeoutMs: Math.min(10_000, this.timeoutMs),
      cache: { enabled: true, ttlMs: 15 * 60 * 1000, staleIfErrorMs: 6 * 60 * 60 * 1000 },
    })
  }

  async fetch(candidate: PdfCandidate): Promise<KazhydrometRawSnapshot> {
    const result = await this.safeFetch.fetchBuffer(new URL(candidate.canonicalUrl), {
      allowedHosts: this.allowedHosts,
      expectedContentTypes: ['application/pdf'],
      maxBytes: this.maxBytes,
      timeoutMs: Math.min(12_000, this.timeoutMs),
      cache: { enabled: false, ttlMs: 1, staleIfErrorMs: 0 },
    })
    if (!result.body.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw kazhydrometError('KAZHYDROMET_PDF_INVALID', 'Kazhydromet response is not a PDF')
    }
    const finalUrl = new URL(result.metadata.finalUrl)
    finalUrl.hash = ''
    return {
      candidate,
      bytes: Buffer.from(result.body),
      fetchedAt: new Date(result.metadata.fetchedAt),
      httpStatus: result.metadata.statusCode,
      finalUrl: finalUrl.toString(),
      sha256: createHash('sha256').update(result.body).digest('hex'),
      sourceStatus: result.metadata.sourceStatus,
    }
  }
}

function requestedYearUrls(
  configuredUrl: string,
  request: NormalizedKazhydrometRequest,
): URL[] {
  const firstYear = Number(request.from.slice(0, 4))
  const lastYear = Number(request.to.slice(0, 4))
  const base = new URL(configuredUrl)
  base.pathname = base.pathname.replace(/\/(?:20\d{2})\/?$/u, '').replace(/\/$/u, '')
  return Array.from({ length: lastYear - firstYear + 1 }, (_value, index) => {
    const url = new URL(base)
    url.pathname = `${base.pathname}/${firstYear + index}`
    return url
  })
}

function worseSourceStatus(
  left: SafeFetchMetadata['sourceStatus'],
  right: SafeFetchMetadata['sourceStatus'],
): SafeFetchMetadata['sourceStatus'] {
  const rank = { healthy: 0, degraded: 1, rate_limited: 2 } as const
  return rank[right] > rank[left] ? right : left
}
