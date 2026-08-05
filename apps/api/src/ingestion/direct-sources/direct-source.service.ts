import { Injectable } from '@nestjs/common'

import { ArticleIngestionService, type ProcessedArticle } from '../article/article-ingestion.service'
import type { PublicArticleCandidate } from '../article/article.types'
import type { NormalizedGdeltRequest } from '../ingestion.types'

type DirectSourceWindow = Pick<NormalizedGdeltRequest, 'from' | 'to'>

@Injectable()
export class DirectSourceService {
  constructor(private readonly articles: ArticleIngestionService) {}

  async process(
    candidates: readonly PublicArticleCandidate[],
    runId: string,
    window: DirectSourceWindow,
  ): Promise<{
    accepted: ProcessedArticle[]
    rejectedCount: number
    rateLimitedCount: number
    regionMismatchCount: number
    temporalMismatchCount: number
    temporalUnknownCount: number
    parserFailureCount: number
    degradedCount: number
    successfulFetchCount: number
    lastHttpStatus: number | null
  }> {
    const accepted: ProcessedArticle[] = []
    let rejectedCount = 0
    let rateLimitedCount = 0
    let regionMismatchCount = 0
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
        if (processed.parserFailed) parserFailureCount += 1
        if (processed.sourceStatus !== 'healthy') degradedCount += 1
        const temporalMatch = classifyPublicationTime(processed.document.publishedAt, window)
        if (temporalMatch === 'mismatch') temporalMismatchCount += 1
        if (temporalMatch === 'unknown') temporalUnknownCount += 1
        if (processed.requestedRegionMatched === false) {
          regionMismatchCount += 1
        } else if (temporalMatch === 'matched') {
          accepted.push(processed)
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
      temporalMismatchCount,
      temporalUnknownCount,
      parserFailureCount,
      degradedCount,
      successfulFetchCount,
      lastHttpStatus,
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
