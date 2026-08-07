import { createHash } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { SafeFetchService } from '../../common/http/safe-fetch/safe-fetch.service'
import type { PlatformEnvironment } from '../../config/environment'
import { SourcesService } from '../../sources/sources.service'
import { findDirectSource } from '../direct-sources/direct-source-registry'
import { INGESTION_CLOCK, type IngestionClock } from '../ingestion.constants'
import { publicIngestionError } from '../ingestion.errors'
import { IngestionRepository } from '../ingestion.repository'
import { buildArticleIdentity } from './article-document-identity'
import { canonicalizeArticleUrl } from './article-url'
import { ArticleTextService } from './article-text.service'
import type { ArticleDocumentResult, ArticleExtractionResult, PublicArticleCandidate } from './article.types'

export interface ProcessedArticle {
  document: ArticleDocumentResult
  sourceText: string | null
  parserFailed: boolean
  requestedRegionMatched: boolean | null
  sourceStatus: 'healthy' | 'degraded' | 'rate_limited'
  cacheStatus: 'miss' | 'fresh' | 'stale'
  httpStatus: number
}

@Injectable()
export class ArticleIngestionService {
  private readonly allowedHosts: string[]
  private readonly maximumBytes: number
  private readonly timeoutMs: number

  constructor(
    private readonly safeFetch: SafeFetchService,
    private readonly sources: SourcesService,
    private readonly repository: IngestionRepository,
    private readonly articleText: ArticleTextService,
    config: ConfigService<PlatformEnvironment, true>,
    @Inject(INGESTION_CLOCK) private readonly clock: IngestionClock,
  ) {
    this.allowedHosts = config.getOrThrow('DIRECT_SOURCE_ALLOWED_HOSTS')
    this.maximumBytes = config.getOrThrow('DIRECT_SOURCE_HTML_MAX_BYTES')
    this.timeoutMs = Math.min(10_000, config.getOrThrow('HTTP_TIMEOUT_MS'))
  }

  async process(candidate: PublicArticleCandidate, runId: string): Promise<ProcessedArticle> {
    const fetched = await this.safeFetch.fetchBuffer(new URL(candidate.originalUrl), {
      allowedHosts: this.allowedHosts,
      expectedContentTypes: ['text/html'],
      maxBytes: this.maximumBytes,
      timeoutMs: this.timeoutMs,
      cache: { enabled: true, ttlMs: 15 * 60 * 1_000, staleIfErrorMs: 24 * 60 * 60 * 1_000 },
    })
    if (fetched.body.length === 0) {
      throw publicIngestionError('PUBLIC_ARTICLE_TEXT_EMPTY', 'Public article response is empty')
    }
    const finalUrl = new URL(fetched.metadata.finalUrl)
    const source = findDirectSource(finalUrl.hostname)
    if (!source || !this.allowedHosts.includes(finalUrl.hostname)) {
      throw publicIngestionError('DIRECT_SOURCE_HOST_NOT_ALLOWED', 'Public article host is not allowed')
    }
    if (!source.requestRegions.some((region) => candidate.requestedRegions.includes(region))) {
      throw publicIngestionError('DIRECT_SOURCE_REGION_MISMATCH', 'Public article does not cover the requested region')
    }
    const canonicalUrl = canonicalizeArticleUrl(finalUrl)
    const sha256 = createHash('sha256').update(fetched.body).digest('hex')
    const identity = buildArticleIdentity({ candidate, source, canonicalUrl, sha256, runId })
    const initial = await this.repository.ensureArticleDocument(identity)
    const cached = await this.sources.cacheExistingSourceSnapshot({
      sourceDocumentId: initial.id,
      bytes: fetched.body,
      mediaType: 'text/html',
      fetchedAt: new Date(fetched.metadata.fetchedAt),
      httpStatus: fetched.metadata.statusCode,
    })
    if (cached.sha256 !== sha256) {
      throw publicIngestionError('PUBLIC_ARTICLE_SOURCE_CONFLICT', 'Cached public article hash does not match source identity')
    }

    let extraction: ArticleExtractionResult
    try {
      extraction = this.articleText.extract(
        fetched.body,
        candidate.discoveryTitle,
        candidate.requestedRegions,
        this.clock.now(),
      )
    } catch {
      await this.repository.markArticleParserFailure(initial.id, this.clock.now())
      return {
        document: {
          sourceDocumentId: initial.id,
          discoveryMode: candidate.discoveryMode,
          publisher: initial.publisher,
          title: initial.title,
          canonicalUrl: initial.canonicalUrl,
          publishedAt: initial.publishedAt?.toISOString() ?? null,
          sha256,
          cachePath: cached.cachePath,
          parserStatus: 'failed',
          relevant: null,
          matchedRequestedRegions: null,
          coverage: source.coverage,
        },
        sourceText: null,
        parserFailed: true,
        requestedRegionMatched: null,
        sourceStatus: fetched.metadata.sourceStatus,
        cacheStatus: fetched.metadata.cacheStatus,
        httpStatus: fetched.metadata.statusCode,
      }
    }
    const persisted = await this.repository.persistArticleExtraction({
      sourceDocumentId: initial.id,
      extraction,
      parsedAt: this.clock.now(),
    })
    return {
      document: {
        sourceDocumentId: persisted.id,
        discoveryMode: candidate.discoveryMode,
        publisher: persisted.publisher,
        title: persisted.title,
        canonicalUrl: persisted.canonicalUrl,
        publishedAt: persisted.publishedAt?.toISOString() ?? null,
        sha256,
        cachePath: cached.cachePath,
        parserStatus: 'succeeded',
        relevant: extraction.relevant,
        matchedRequestedRegions: extraction.matchedRequestedRegions,
        coverage: source.coverage,
      },
      sourceText: extraction.text,
      parserFailed: false,
      requestedRegionMatched: extraction.matchedRequestedRegions.length > 0,
      sourceStatus: fetched.metadata.sourceStatus,
      cacheStatus: fetched.metadata.cacheStatus,
      httpStatus: fetched.metadata.statusCode,
    }
  }
}
