import { randomUUID } from 'node:crypto'

import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { SafeFetchError } from '../../common/http/safe-fetch/safe-fetch.errors'
import type { PlatformEnvironment } from '../../config/environment'
import {
  IngestionAdapter,
  IngestionRunStatus,
} from '../../generated/prisma/enums'
import { SourceHealthService } from '../../sources/source-health/source-health.service'
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
import type { ArticleSignalCandidate } from '../article/article-signal-candidate'
import { ArticleSignalEnrichmentRunner } from '../article/article-signal-enrichment-runner.service'

interface GdeltRunState {
  sourceStatus: 'healthy' | 'degraded' | 'rate_limited' | null
  cacheStatus: 'miss' | 'fresh' | 'stale' | null
  httpStatus: number | null
  fetchedCount: number
  discoveredCount: number
  allowedCandidateCount: number
  invalidCandidateCount: number
  regionMismatchCount: number
  irrelevantCount: number
  parserFailureCount: number
  accepted: ProcessedArticle[]
  rejectedCount: number
  queryHash: string | null
  error: { code: string; message: string } | null
  responseUsable: boolean
  enrichmentAttemptedCount: number
  enrichmentCandidateCount: number
  enrichmentFailedCount: number
  signalCandidates: ArticleSignalCandidate[]
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
    private readonly signalEnrichment: ArticleSignalEnrichmentRunner,
    private readonly sourceHealth: SourceHealthService,
    private readonly repository: IngestionRepository,
    config: ConfigService<PlatformEnvironment, true>,
    @Inject(INGESTION_CLOCK)
    private readonly clock: IngestionClock,
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
    await this.sourceHealth.startAttempt(
      'gdelt',
      startedAt,
    )

    const state: GdeltRunState = {
      sourceStatus: null, cacheStatus: null, httpStatus: null, fetchedCount: 0,
      discoveredCount: 0, allowedCandidateCount: 0, invalidCandidateCount: 0,
      accepted: [], rejectedCount: 0, regionMismatchCount: 0,
      irrelevantCount: 0,
      parserFailureCount: 0,
      queryHash: null, error: null, responseUsable: false,
      enrichmentAttemptedCount: 0,
      enrichmentCandidateCount: 0,
      enrichmentFailedCount: 0,
      signalCandidates: [],
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

          if (processed.parserFailed) {
            state.parserFailureCount += 1
            state.error ??= {
              code: 'PUBLIC_ARTICLE_INGESTION_FAILED',
              message:
                'A public article was cached but could not be fully processed',
            }
            continue
          }

          if (processed.requestedRegionMatched !== true) {
            state.regionMismatchCount += 1
            continue
          }

          if (processed.document.relevant !== true) {
            state.irrelevantCount += 1
            continue
          }

          state.accepted.push(processed)
          state.enrichmentAttemptedCount += 1

          if (typeof processed.sourceText !== 'string') {
            state.enrichmentFailedCount += 1
          } else {
            const enrichment = await this.signalEnrichment.run({
              sourceDocumentId: processed.document.sourceDocumentId,
              sourceText: processed.sourceText,
            })

            if (enrichment.failed) {
              state.enrichmentFailedCount += 1
            } else if (enrichment.candidate !== null) {
              state.signalCandidates.push(enrichment.candidate)
              state.enrichmentCandidateCount += 1
            }
          }

          if (processed.sourceStatus !== 'healthy') {
            state.error ??= {
              code: 'PUBLIC_ARTICLE_INGESTION_FAILED',
              message:
                'A public article was cached but could not be fully processed',
            }
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
        irrelevantCount: state.irrelevantCount,
        parserFailureCount: state.parserFailureCount,
        ...(state.queryHash ? { queryHash: state.queryHash } : {}),
        ...(state.cacheStatus ? { cacheStatus: state.cacheStatus } : {}),
        ...(state.sourceStatus ? { sourceStatus: state.sourceStatus } : {}),
        enrichmentAttemptedCount: state.enrichmentAttemptedCount,
        enrichmentCandidateCount: state.enrichmentCandidateCount,
        enrichmentFailedCount: state.enrichmentFailedCount,
      },
    })
    const gdeltCacheAvailable =
      state.accepted.length > 0 ||
      await this.repository.hasAcceptedPublicRun(
        IngestionAdapter.GDELT,
      )

    await this.finalizeGdeltHealth(
      state,
      finishedAt,
      runId,
      gdeltCacheAvailable,
    )

    const direct = await this.runDirectFallback(request, gdeltCandidates, state.accepted)
    const documents = [...state.accepted.map((item) => item.document), ...direct.documents]
    const signalCandidates = [
      ...state.signalCandidates,
      ...direct.signalCandidates,
    ]
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
      enrichment: {
        attemptedCount:
          state.enrichmentAttemptedCount +
          direct.enrichmentAttemptedCount,
        candidateCount:
          state.enrichmentCandidateCount +
          direct.enrichmentCandidateCount,
        failedCount:
          state.enrichmentFailedCount +
          direct.enrichmentFailedCount,
      },
      signalCandidates,
      documents,
    }
  }

  private async finalizeGdeltHealth(
    state: GdeltRunState,
    at: Date,
    runId: string,
    cacheAvailable: boolean,
  ): Promise<void> {
    const baseInput = {
      at,
      lastHttpStatus: state.httpStatus,
      cacheAvailable,
      metadata: {
        lastRunId: runId,
        cacheStatus: state.cacheStatus ?? 'none',
        originFresh:
          state.cacheStatus === 'miss' &&
          state.sourceStatus === 'healthy',
      },
    }

    if (state.sourceStatus === 'rate_limited') {
      await this.sourceHealth.markRateLimited(
        'gdelt',
        {
          ...baseInput,
          success: state.responseUsable,
          error:
            state.error ?? {
              code: 'GDELT_RATE_LIMITED',
              message:
                'GDELT source is rate limited',
            },
        },
      )
      return
    }

    const actualError =
      state.sourceStatus !== 'healthy' ||
      state.rejectedCount > 0 ||
      state.parserFailureCount > 0

    const degraded =
      state.sourceStatus === 'degraded' ||
      state.rejectedCount > 0 ||
      state.parserFailureCount > 0 ||
      state.accepted.some(
        (item) =>
          item.sourceStatus !== 'healthy',
      )

    if (actualError) {
      await this.sourceHealth.markFailure(
        'gdelt',
        {
          ...baseInput,
          degraded: state.responseUsable,
          success: state.responseUsable,
          error:
            state.error ?? {
              code: 'GDELT_INGESTION_FAILED',
              message: 'GDELT ingestion failed',
            },
        },
      )
      return
    }

    await this.sourceHealth.markSuccess(
      'gdelt',
      {
        ...baseInput,
        degraded,
        detail:
          state.error === null
            ? null
            : `${state.error.code}: ${state.error.message}`,
      },
    )
  }

  private async finalizeDirectHealth(input: {
    status: PublicRunStatus
    at: Date
    runId: string
    lastHttpStatus: number | null
    cacheAvailable: boolean
    actualError: boolean
    success: boolean
    error: {
      code: string
      message: string
    } | null
  }): Promise<void> {
    const baseInput = {
      at: input.at,
      lastHttpStatus: input.lastHttpStatus,
      cacheAvailable: input.cacheAvailable,
      metadata: {
        lastRunId: input.runId,
      },
    }

    if (input.status === 'rate_limited') {
      await this.sourceHealth.markRateLimited(
        'direct-sources',
        {
          ...baseInput,
          success: input.success,
          error:
            input.error ?? {
              code: 'DIRECT_SOURCE_RATE_LIMITED',
              message:
                'One or more direct public sources are rate limited',
            },
        },
      )
      return
    }

    if (input.actualError) {
      await this.sourceHealth.markFailure(
        'direct-sources',
        {
          ...baseInput,
          degraded:
            input.status === 'partial',
          success: input.success,
          error:
            input.error ?? {
              code:
                'DIRECT_SOURCE_INGESTION_FAILED',
              message:
                'One or more direct public sources could not be fully processed',
            },
        },
      )
      return
    }

    await this.sourceHealth.markSuccess(
      'direct-sources',
      baseInput,
    )
  }

  private async runDirectFallback(
    request: NormalizedGdeltRequest,
    gdeltCandidates:
      readonly PublicArticleCandidate[],
    accepted: readonly ProcessedArticle[],
  ): Promise<{
    used: boolean
    runId: string | null
    status: PublicRunStatus | null
    attemptedCount: number
    rejectedCount: number

    enrichmentAttemptedCount: number
    enrichmentCandidateCount: number
    enrichmentFailedCount: number

    signalCandidates: ArticleSignalCandidate[]
    documents: ArticleDocumentResult[]
  }> {
    if (!request.includeDirectFallback || accepted.length >= request.maxArticles) {
      return {
        used: false,
        runId: null,
        status: null,
        attemptedCount: 0,
        rejectedCount: 0,
        enrichmentAttemptedCount: 0,
        enrichmentCandidateCount: 0,
        enrichmentFailedCount: 0,
        signalCandidates: [],
        documents: [],
      }
    }
    const excluded = new Set(gdeltCandidates.map((candidate) => canonicalizeArticleUrl(new URL(candidate.originalUrl))))
    const candidates = this.directAdapter.candidates(request, request.maxArticles - accepted.length, excluded)
    if (candidates.length === 0) {
      return {
        used: false,
        runId: null,
        status: null,
        attemptedCount: 0,
        rejectedCount: 0,
        enrichmentAttemptedCount: 0,
        enrichmentCandidateCount: 0,
        enrichmentFailedCount: 0,
        signalCandidates: [],
        documents: [],
      }
    }
    const runId = randomUUID()
    const startedAt = this.clock.now()
    await this.repository.createPublicRun({
      id: runId, adapter: IngestionAdapter.DIRECT_SOURCE,
      metadata: { ...requestMetadata(request), candidateCount: candidates.length },
    })
    await this.sourceHealth.startAttempt(
      'direct-sources',
      startedAt,
    )
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
        irrelevantCount: result.irrelevantCount,
        temporalMismatchCount: result.temporalMismatchCount,
        temporalUnknownCount: result.temporalUnknownCount,
        enrichmentAttemptedCount: result.enrichmentAttemptedCount,
        enrichmentCandidateCount: result.enrichmentCandidateCount,
        enrichmentFailedCount: result.enrichmentFailedCount,
      },
    })
    const cacheAvailable =
      result.accepted.length > 0 ||
      await this.repository.hasAcceptedPublicRun(
        IngestionAdapter.DIRECT_SOURCE,
      )

    await this.finalizeDirectHealth({
      status,
      at: finishedAt,
      runId,
      lastHttpStatus: result.lastHttpStatus,
      cacheAvailable,
      actualError,
      success:
        result.successfulFetchCount > 0,
      error,
    })
    return {
      used: true,
      runId,
      status,
      attemptedCount: candidates.length,
      rejectedCount: result.rejectedCount,

      enrichmentAttemptedCount:
        result.enrichmentAttemptedCount,
      enrichmentCandidateCount:
        result.enrichmentCandidateCount,
      enrichmentFailedCount:
        result.enrichmentFailedCount,

      signalCandidates: result.signalCandidates,

      documents: result.accepted.map(
        (item) => item.document,
      ),
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
  if (state.sourceStatus === 'rate_limited') {
    return 'rate_limited'
  }

  if (
    state.accepted.length > 0 &&
    state.sourceStatus === 'healthy' &&
    state.rejectedCount === 0 &&
    state.parserFailureCount === 0 &&
    !state.accepted.some(
      (item) => item.sourceStatus !== 'healthy',
    )
  ) {
    return 'succeeded'
  }

  if (state.accepted.length > 0) {
    return 'partial'
  }

  return 'failed'
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
