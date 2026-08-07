import { Injectable } from '@nestjs/common'

import { ArticleIngestionService, type ProcessedArticle } from '../article/article-ingestion.service'
import type { PublicArticleCandidate } from '../article/article.types'
import type { NormalizedGdeltRequest } from '../ingestion.types'
import type { ArticleSignalCandidate } from '../article/article-signal-candidate'
import { ArticleSignalEnrichmentRunner } from '../article/article-signal-enrichment-runner.service'

type DirectSourceWindow = Pick<NormalizedGdeltRequest, 'from' | 'to'>

@Injectable()
export class DirectSourceService {
  constructor(
    private readonly articles: ArticleIngestionService,
    private readonly signalEnrichment: ArticleSignalEnrichmentRunner,
  ) { }

  async process(
    candidates: readonly PublicArticleCandidate[],
    runId: string,
    window: DirectSourceWindow,
  ): Promise<{
    accepted: ProcessedArticle[]
    rejectedCount: number
    rateLimitedCount: number
    regionMismatchCount: number
    irrelevantCount: number
    temporalMismatchCount: number
    temporalUnknownCount: number
    parserFailureCount: number
    degradedCount: number
    successfulFetchCount: number
    lastHttpStatus: number | null
    signalCandidates: ArticleSignalCandidate[]
    enrichmentAttemptedCount: number
    enrichmentCandidateCount: number
    enrichmentFailedCount: number
  }> {
    const accepted: ProcessedArticle[] = []
    const signalCandidates: ArticleSignalCandidate[] = []
    let enrichmentAttemptedCount = 0
    let enrichmentCandidateCount = 0
    let enrichmentFailedCount = 0
    let rejectedCount = 0
    let rateLimitedCount = 0
    let regionMismatchCount = 0
    let irrelevantCount = 0
    let temporalMismatchCount = 0
    let temporalUnknownCount = 0
    let parserFailureCount = 0
    let degradedCount = 0
    let successfulFetchCount = 0
    let lastHttpStatus: number | null = null
    for (const candidate of candidates) {
      try {
        const processed = await this.articles.process(candidate, runId)
        successfulFetchCount += 1
        lastHttpStatus = processed.httpStatus
        if (processed.sourceStatus !== 'healthy') {
          degradedCount += 1
        }

        if (processed.parserFailed) {
          parserFailureCount += 1
          continue
        }

        const temporalMatch = classifyPublicationTime(
          processed.document.publishedAt,
          window,
        )

        if (temporalMatch === 'mismatch') {
          temporalMismatchCount += 1
        }

        if (temporalMatch === 'unknown') {
          temporalUnknownCount += 1
        }

        if (processed.requestedRegionMatched !== true) {
          regionMismatchCount += 1
          continue
        }

        if (processed.document.relevant !== true) {
          irrelevantCount += 1
          continue
        }

        if (temporalMatch !== 'matched') {
          continue
        }

        accepted.push(processed)
        enrichmentAttemptedCount += 1

        if (typeof processed.sourceText !== 'string') {
          enrichmentFailedCount += 1
          continue
        }

        const enrichment = await this.signalEnrichment.run({
          sourceDocumentId: processed.document.sourceDocumentId,
          sourceText: processed.sourceText,
        })

        if (enrichment.failed) {
          enrichmentFailedCount += 1
        } else if (enrichment.candidate !== null) {
          signalCandidates.push(enrichment.candidate)
          enrichmentCandidateCount += 1
        }
      } catch (error) {
        rejectedCount += 1
        if (isRateLimited(error)) rateLimitedCount += 1
      }
    }
    return {
      accepted,
      rejectedCount,
      rateLimitedCount,
      regionMismatchCount,
      irrelevantCount,
      temporalMismatchCount,
      temporalUnknownCount,
      parserFailureCount,
      degradedCount,
      successfulFetchCount,
      lastHttpStatus,
      signalCandidates,
      enrichmentAttemptedCount,
      enrichmentCandidateCount,
      enrichmentFailedCount,
    }
  }
}

function classifyPublicationTime(
  publishedAt: string | null,
  window: DirectSourceWindow,
): 'matched' | 'mismatch' | 'unknown' {
  if (publishedAt === null) return 'unknown'
  const timestamp = new Date(publishedAt).getTime()
  if (!Number.isFinite(timestamp)) return 'unknown'
  return timestamp >= window.from.getTime() && timestamp <= window.to.getTime()
    ? 'matched'
    : 'mismatch'
}

function isRateLimited(error: unknown): boolean {
  return typeof error === 'object' && error !== null &&
    (('sourceStatus' in error && error.sourceStatus === 'rate_limited') ||
      ('rateLimited' in error && error.rateLimited === true))
}
