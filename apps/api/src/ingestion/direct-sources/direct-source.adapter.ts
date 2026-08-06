import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { PlatformEnvironment } from '../../config/environment'
import { parsePublicArticleUrl } from '../article/article-url'
import type { PublicArticleCandidate } from '../article/article.types'
import { boundedCandidates } from '../gdelt/gdelt.adapter'
import type { NormalizedGdeltRequest } from '../ingestion.types'
import { findDirectSource } from './direct-source-registry'

@Injectable()
export class DirectSourceAdapter {
  private readonly fallbackUrls: string[]
  private readonly allowedHosts: string[]
  private readonly maximumPerDomain: number
  private readonly maximumPerRun: number

  constructor(config: ConfigService<PlatformEnvironment, true>) {
    this.fallbackUrls = config.getOrThrow('DIRECT_SOURCE_FALLBACK_URLS')
    this.allowedHosts = config.getOrThrow('DIRECT_SOURCE_ALLOWED_HOSTS')
    this.maximumPerDomain = config.getOrThrow('DIRECT_SOURCE_MAX_ARTICLES_PER_DOMAIN')
    this.maximumPerRun = config.getOrThrow('DIRECT_SOURCE_MAX_ARTICLES_PER_RUN')
  }

  candidates(
    request: NormalizedGdeltRequest,
    remaining: number,
    excludedCanonicalUrls: ReadonlySet<string>,
  ): PublicArticleCandidate[] {
    const candidates: PublicArticleCandidate[] = []
    for (const value of this.fallbackUrls) {
      const url = parsePublicArticleUrl(value)
      if (!url || !this.allowedHosts.includes(url.hostname)) continue
      const source = findDirectSource(url.hostname)
      if (!source) continue
      const requestedRegions = request.regions.filter((region) => source.requestRegions.includes(region))
      if (requestedRegions.length === 0) continue
      candidates.push({
        discoveryMode: 'direct_fallback',
        originalUrl: url.toString(),
        discoveryTitle: null,
        gdeltSeenAt: null,
        gdeltLanguage: null,
        gdeltSourceCountry: null,
        requestedRegions,
        publisherHost: url.hostname,
        coverage: source.coverage,
      })
    }
    return boundedCandidates(
      candidates,
      Math.min(remaining, this.maximumPerRun),
      this.maximumPerDomain,
      new Set(excludedCanonicalUrls),
    )
  }
}
