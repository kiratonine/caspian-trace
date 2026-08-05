import { randomUUID } from 'node:crypto'

import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { SafeFetchError } from '../../common/http/safe-fetch/safe-fetch.errors'
import type { PlatformEnvironment } from '../../config/environment'
import { IngestionAdapter, IngestionRunStatus, SourceHealthStatus } from '../../generated/prisma/enums'
import type { RunGdeltIngestionDto } from '../dto/run-gdelt-ingestion.dto'
import { DirectSourceAdapter } from '../direct-sources/direct-source.adapter'
import { DirectSourceService } from '../direct-sources/direct-source.service'
import { ArticleIngestionService, type ProcessedArticle } from '../article/article-ingestion.service'
import type { ArticleDocumentResult, PublicArticleCandidate } from '../article/article.types'
import { INGESTION_CLOCK, type IngestionClock } from '../ingestion.constants'
import { PublicIngestionError } from '../ingestion.errors'
import { IngestionRepository } from '../ingestion.repository'
import type { GdeltIngestionResponse, NormalizedGdeltRequest, PublicRunStatus } from '../ingestion.types'
import { canonicalizeArticleUrl } from '../article/article-url'
import { GdeltAdapter } from './gdelt.adapter'

interface GdeltRunState {
  sourceStatus: 'healthy' | 'degraded' | 'rate_limited' | null
  cacheStatus: 'miss' | 'fresh' | 'stale' | null
  httpStatus: number | null
  fetchedCount: number
  discoveredCount: number
  allowedCandidateCount: number
  invalidCandidateCount: number
  regionMismatchCount: number
  accepted: ProcessedArticle[]
  rejectedCount: number
  queryHash: string | null
  error: { code: string; message: string } | null
  responseUsable: boolean
}

@Injectable()
export class GdeltIngestionService {
  private readonly maxRecords: number
  private readonly maxArticles: number
  private readonly maxWindowDays: number

  constructor(
    private readonly gdelt: GdeltAdapter,
    private readonly directAdapter: DirectSourceAdapter,
    private readonly directSources: DirectSourceService,
    private readonly articles: ArticleIngestionService,
    private readonly repository: IngestionRepository,
    config: ConfigService<PlatformEnvironment, true>,
    @Inject(INGESTION_CLOCK) private readonly clock: IngestionClock,
  ) {
    this.maxRecords = config.getOrThrow('GDELT_MAX_RECORDS')
    this.maxArticles = config.getOrThrow('GDELT_MAX_ARTICLES_PER_RUN')
    this.maxWindowDays = config.getOrThrow('GDELT_MAX_WINDOW_DAYS')
  }

  async run(dto: RunGdeltIngestionDto): Promise<GdeltIngestionResponse> {
    const request = normalizeGdeltRequest(dto, {
      now: this.clock.now(), maxRecords: this.maxRecords,
      maxArticles: this.maxArticles, maxWindowDays: this.maxWindowDays,
    })
    const startedAt = this.clock.now()
    const runId = randomUUID()
    await this.repository.createPublicRun({
      id: runId,
      adapter: IngestionAdapter.GDELT,
      metadata: requestMetadata(request),
    })
    await this.repository.markPublicHealthAttempt({ sourceId: 'gdelt', displayName: 'GDELT DOC 2.0', at: startedAt })

    const state: GdeltRunState = {
      sourceStatus: null, cacheStatus: null, httpStatus: null, fetchedCount: 0,
      discoveredCount: 0, allowedCandidateCount: 0, invalidCandidateCount: 0,
      accepted: [], rejectedCount: 0, regionMismatchCount: 0,
      queryHash: null, error: null, responseUsable: false,
    }
    let gdeltCandidates: PublicArticleCandidate[] = []
    try {
      const discovery = await this.gdelt.discover(request)
      state.responseUsable = true
      state.fetchedCount = 1
      state.sourceStatus = discovery.metadata.sourceStatus
      state.cacheStatus = discovery.metadata.cacheStatus
      state.httpStatus = discovery.metadata.statusCode
      state.discoveredCount = discovery.discoveredCount
      state.invalidCandidateCount = discovery.invalidCandidateCount
      state.allowedCandidateCount = discovery.candidates.length
      state.queryHash = discovery.queryHash
      gdeltCandidates = discovery.candidates
      if (discovery.metadata.sourceStatus !== 'healthy') {
        state.error = safeGdeltSourceError(discovery.metadata.sourceStatus)
      }
      for (const candidate of discovery.candidates) {
        try {
          const processed = await this.articles.process(candidate, runId)
          if (processed.requestedRegionMatched === false) {
            state.regionMismatchCount += 1
            continue
          }
          state.accepted.push(processed)
          if (processed.parserFailed || processed.sourceStatus !== 'healthy') {
            state.error ??= { code: 'PUBLIC_ARTICLE_INGESTION_FAILED', message: 'A public article was cached but could not be fully processed' }
          }
        } catch (error) {
          state.rejectedCount += 1
          state.error = normalizePublicError(error, 'PUBLIC_ARTICLE_INGESTION_FAILED', 'Public article ingestion failed')
        }
      }
      if (state.accepted.length === 0 && state.rejectedCount === 0) {
        state.error ??= { code: 'GDELT_NO_ALLOWED_ARTICLES', message: 'GDELT returned no allowed articles for the requested coverage' }
      }
    } catch (error) {
      state.sourceStatus = isRateLimited(error) ? 'rate_limited' : 'degraded'
      state.httpStatus = error instanceof SafeFetchError ? error.statusCode ?? null : null
      state.error = normalizePublicError(
        error,
        isRateLimited(error) ? 'GDELT_RATE_LIMITED' : 'GDELT_INGESTION_FAILED',
        isRateLimited(error) ? 'GDELT source is rate limited' : 'GDELT ingestion failed',
      )
    }

    const gdeltStatus = gdeltRunStatus(state)
    const finishedAt = this.clock.now()
    await this.repository.finalizeRun({
      id: runId,
      status: dbRunStatus(gdeltStatus),
      fetchedCount: state.fetchedCount,
      acceptedCount: state.accepted.length,
      rejectedCount: state.rejectedCount,
      errorCode: state.error?.code ?? null,
      errorMessage: state.error?.message ?? null,
      finishedAt,
      metadata: {
        ...requestMetadata(request),
        discoveredCount: state.discoveredCount,
        allowedCandidateCount: state.allowedCandidateCount,
        invalidCandidateCount: state.invalidCandidateCount,
        regionMismatchCount: state.regionMismatchCount,
        ...(state.queryHash ? { queryHash: state.queryHash } : {}),
        ...(state.cacheStatus ? { cacheStatus: state.cacheStatus } : {}),
        ...(state.sourceStatus ? { sourceStatus: state.sourceStatus } : {}),
      },
    })
    const gdeltCacheAvailable = state.accepted.length > 0 ||
      await this.repository.hasAcceptedPublicRun(IngestionAdapter.GDELT)
    await this.repository.finalizePublicHealth({
      sourceId: 'gdelt', displayName: 'GDELT DOC 2.0', at: finishedAt,
      status: gdeltHealthStatus(state), lastHttpStatus: state.httpStatus,
      cacheAvailable: gdeltCacheAvailable,
      detail: state.error ? `${state.error.code}: ${state.error.message}` : null,
      actualError: state.sourceStatus !== 'healthy' || state.rejectedCount > 0 || state.accepted.some((item) => item.parserFailed),
      success: state.responseUsable,
      metadata: {
        lastRunId: runId,
        cacheStatus: state.cacheStatus ?? 'none',
        originFresh: state.cacheStatus === 'miss' && state.sourceStatus === 'healthy',
      },
    })

    const direct = await this.runDirectFallback(request, gdeltCandidates, state.accepted)
    const documents = [...state.accepted.map((item) => item.document), ...direct.documents]
    return {
      status: topLevelStatus(gdeltStatus, direct.status, documents.length, direct.used),
      gdelt: {
        runId, status: gdeltStatus, sourceStatus: state.sourceStatus, cacheStatus: state.cacheStatus,
        discoveredCount: state.discoveredCount, allowedCandidateCount: state.allowedCandidateCount,
        acceptedCount: state.accepted.length, rejectedCount: state.rejectedCount,
      },
      directFallback: {
        used: direct.used, runId: direct.runId, status: direct.status,
        attemptedCount: direct.attemptedCount, acceptedCount: direct.documents.length,
        rejectedCount: direct.rejectedCount,
      },
      documents,
    }
  }

  private async runDirectFallback(
    request: NormalizedGdeltRequest,
    gdeltCandidates: readonly PublicArticleCandidate[],
    accepted: readonly ProcessedArticle[],
  ): Promise<{
    used: boolean
    runId: string | null
    status: PublicRunStatus | null
    attemptedCount: number
    rejectedCount: number
    documents: ArticleDocumentResult[]
  }> {
    if (!request.includeDirectFallback || accepted.length >= request.maxArticles) {
      return { used: false, runId: null, status: null, attemptedCount: 0, rejectedCount: 0, documents: [] }
    }
    const excluded = new Set(gdeltCandidates.map((candidate) => canonicalizeArticleUrl(new URL(candidate.originalUrl))))
    const candidates = this.directAdapter.candidates(request, request.maxArticles - accepted.length, excluded)
    if (candidates.length === 0) {
      return { used: false, runId: null, status: null, attemptedCount: 0, rejectedCount: 0, documents: [] }
    }
    const runId = randomUUID()
    const startedAt = this.clock.now()
    await this.repository.createPublicRun({
      id: runId, adapter: IngestionAdapter.DIRECT_SOURCE,
      metadata: { ...requestMetadata(request), candidateCount: candidates.length },
    })
    await this.repository.markPublicHealthAttempt({
      sourceId: 'direct-sources', displayName: 'Прямые публичные источники', at: startedAt,
    })
    const result = await this.directSources.process(candidates, runId, {
      from: request.from,
      to: request.to,
    })
    const parserFailures = result.parserFailureCount
    const degraded = result.degradedCount > 0
    const actualError = result.rejectedCount > 0 || parserFailures > 0 || degraded
    const status = directRunStatus(
      result.accepted.length,
      result.rejectedCount,
      result.rateLimitedCount,
      actualError,
      result.temporalMismatchCount + result.temporalUnknownCount > 0,
    )
    const finishedAt = this.clock.now()
    const error = actualError
      ? { code: 'DIRECT_SOURCE_INGESTION_FAILED', message: 'One or more direct public sources could not be fully processed' }
      : null
    await this.repository.finalizeRun({
      id: runId, status: dbRunStatus(status), fetchedCount: result.successfulFetchCount,
      acceptedCount: result.accepted.length, rejectedCount: result.rejectedCount,
      errorCode: error?.code ?? null, errorMessage: error?.message ?? null,
      finishedAt,
      metadata: {
        ...requestMetadata(request), candidateCount: candidates.length,
        parserFailures, regionMismatchCount: result.regionMismatchCount,
        temporalMismatchCount: result.temporalMismatchCount,
        temporalUnknownCount: result.temporalUnknownCount,
      },
    })
    const cacheAvailable = result.accepted.length > 0 ||
      await this.repository.hasAcceptedPublicRun(IngestionAdapter.DIRECT_SOURCE)
    await this.repository.finalizePublicHealth({
      sourceId: 'direct-sources', displayName: 'Прямые публичные источники', at: finishedAt,
      status: actualError ? directHealthStatus(status) : SourceHealthStatus.HEALTHY,
      lastHttpStatus: result.lastHttpStatus,
      cacheAvailable, detail: error ? `${error.code}: ${error.message}` : null,
      actualError, success: result.successfulFetchCount > 0,
      metadata: { lastRunId: runId },
    })
    return {
      used: true, runId, status, attemptedCount: candidates.length,
      rejectedCount: result.rejectedCount, documents: result.accepted.map((item) => item.document),
    }
  }
}

export function normalizeGdeltRequest(
  dto: RunGdeltIngestionDto,
  limits: { now: Date; maxRecords: number; maxArticles: number; maxWindowDays: number },
): NormalizedGdeltRequest {
  if (!strictZulu(dto.from) || !strictZulu(dto.to)) throw invalidRequest()
  const from = new Date(dto.from)
  const to = new Date(dto.to)
  const maxRecords = dto.maxRecords ?? limits.maxRecords
  const maxArticles = dto.maxArticles ?? Math.min(3, limits.maxArticles, maxRecords)
  if (
    !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to ||
    to.getTime() - from.getTime() > limits.maxWindowDays * 86_400_000 ||
    to.getTime() > limits.now.getTime() + 5 * 60_000 ||
    dto.regions.length === 0 || new Set(dto.regions).size !== dto.regions.length ||
    maxRecords < 1 || maxRecords > Math.min(25, limits.maxRecords) ||
    maxArticles < 1 || maxArticles > limits.maxArticles || maxArticles > maxRecords
  ) throw invalidRequest()
  return {
    from, to, regions: [...dto.regions], maxRecords, maxArticles,
    includeDirectFallback: dto.includeDirectFallback ?? true,
  }
}

function strictZulu(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    new Date(value).toISOString().startsWith(value.slice(0, 19))
}

function invalidRequest(): BadRequestException {
  return new BadRequestException({ code: 'GDELT_REQUEST_INVALID', message: 'GDELT ingestion request is invalid' })
}

function requestMetadata(request: NormalizedGdeltRequest): Record<string, string | number | boolean | string[]> {
  return {
    from: request.from.toISOString(), to: request.to.toISOString(), regions: request.regions,
    maxRecords: request.maxRecords, maxArticles: request.maxArticles,
    includeDirectFallback: request.includeDirectFallback,
  }
}

function normalizePublicError(error: unknown, code: string, message: string): { code: string; message: string } {
  if (error instanceof PublicIngestionError) return { code: error.code, message: error.safeMessage }
  if (error instanceof SafeFetchError && error.sourceStatus === 'rate_limited') {
    return { code: 'GDELT_RATE_LIMITED', message: 'GDELT source is rate limited' }
  }
  return { code, message }
}

function isRateLimited(error: unknown): boolean {
  return (error instanceof SafeFetchError && error.sourceStatus === 'rate_limited') ||
    (error instanceof PublicIngestionError && error.rateLimited)
}

function safeGdeltSourceError(status: 'degraded' | 'rate_limited'): { code: string; message: string } {
  return status === 'rate_limited'
    ? { code: 'GDELT_RATE_LIMITED', message: 'GDELT source is rate limited; cached response was used' }
    : { code: 'GDELT_INGESTION_FAILED', message: 'GDELT source is degraded; cached response was used' }
}

function gdeltRunStatus(state: GdeltRunState): PublicRunStatus {
  if (state.sourceStatus === 'rate_limited') return 'rate_limited'
  if (state.accepted.length > 0 && state.sourceStatus === 'healthy' && state.rejectedCount === 0 && !state.accepted.some((item) => item.parserFailed || item.sourceStatus !== 'healthy')) return 'succeeded'
  if (state.accepted.length > 0) return 'partial'
  return 'failed'
}

function gdeltHealthStatus(state: GdeltRunState): SourceHealthStatus {
  if (state.sourceStatus === 'rate_limited') return SourceHealthStatus.RATE_LIMITED
  if (!state.responseUsable) return SourceHealthStatus.FAILED
  if (state.sourceStatus === 'degraded' || state.rejectedCount > 0 || state.accepted.some((item) => item.parserFailed)) return SourceHealthStatus.DEGRADED
  return SourceHealthStatus.HEALTHY
}

function directRunStatus(
  accepted: number,
  rejected: number,
  rateLimited: number,
  actualError: boolean,
  temporalExclusions: boolean,
): PublicRunStatus {
  if (accepted > 0) return actualError || temporalExclusions ? 'partial' : 'succeeded'
  if (rejected > 0 && rateLimited === rejected) return 'rate_limited'
  return 'failed'
}

function directHealthStatus(status: PublicRunStatus): SourceHealthStatus {
  return {
    succeeded: SourceHealthStatus.HEALTHY,
    partial: SourceHealthStatus.DEGRADED,
    failed: SourceHealthStatus.FAILED,
    rate_limited: SourceHealthStatus.RATE_LIMITED,
  }[status]
}

function dbRunStatus(status: PublicRunStatus): IngestionRunStatus {
  return {
    succeeded: IngestionRunStatus.SUCCEEDED,
    partial: IngestionRunStatus.PARTIAL,
    failed: IngestionRunStatus.FAILED,
    rate_limited: IngestionRunStatus.RATE_LIMITED,
  }[status]
}

function topLevelStatus(
  gdelt: PublicRunStatus,
  direct: PublicRunStatus | null,
  accepted: number,
  directUsed: boolean,
): PublicRunStatus {
  if (gdelt === 'succeeded' && !directUsed) return 'succeeded'
  if (accepted > 0) return 'partial'
  if (gdelt === 'rate_limited' || direct === 'rate_limited') return 'rate_limited'
  return 'failed'
}
