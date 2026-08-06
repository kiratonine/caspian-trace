import { randomUUID } from 'node:crypto'

import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { SafeFetchError } from '../../common/http/safe-fetch/safe-fetch.errors'
import type { PlatformEnvironment } from '../../config/environment'
import {
  IngestionRunStatus,
} from '../../generated/prisma/enums'
import { SourcesService } from '../../sources/sources.service'
import { SourceHealthService } from '../../sources/source-health/source-health.service'
import type { RunKazhydrometIngestionDto } from '../dto/run-kazhydromet-ingestion.dto'
import {
  KazhydrometIngestionError,
  kazhydrometError,
} from '../ingestion.errors'
import { IngestionRepository } from '../ingestion.repository'
import type {
  CachedIngestionSourceDocument,
  IngestionSourceDocument,
  KazhydrometDocumentResult,
  KazhydrometIngestionResponse,
  NormalizedKazhydrometRequest,
} from '../ingestion.types'
import { KazhydrometAdapter } from './kazhydromet.adapter'
import {
  extractMeasurementCandidates,
  findRelevantPages,
  validateCandidateAgainstText,
} from './kazhydromet-candidates'
import { buildSourceDocumentIdentity } from './kazhydromet-document-identity'
import { PdfTextService } from './pdf-text.service'
import type {
  KazhydrometRawSnapshot,
  PdfCandidate,
} from './kazhydromet.types'

interface MutableRunState {
  discoveredCount: number
  fetchedCount: number
  cachedCount: number
  acceptedCount: number
  rejectedCount: number
  pageCount: number
  validatedCandidateCount: number
  rejectedCandidateCount: number
  cacheAvailable: boolean
  snapshotAvailableInRun: boolean
  degraded: boolean
  rateLimited: boolean
  lastHttpStatus: number | null
  lastError: { code: string; message: string } | null
  documents: KazhydrometDocumentResult[]
}

@Injectable()
export class KazhydrometIngestionService {
  private readonly maxDocuments: number

  constructor(
    private readonly adapter: KazhydrometAdapter,
    private readonly repository: IngestionRepository,
    private readonly sourceHealth: SourceHealthService,
    private readonly sources: SourcesService,
    private readonly pdfText: PdfTextService,
    config: ConfigService<PlatformEnvironment, true>,
  ) {
    this.maxDocuments = config.getOrThrow('KAZHYDROMET_MAX_DOCUMENTS_PER_RUN')
  }

  async run(dto: RunKazhydrometIngestionDto): Promise<KazhydrometIngestionResponse> {
    const request = normalizeKazhydrometRequest(dto, this.maxDocuments)
    const runId = randomUUID()
    const startedAt = new Date()
    const state = emptyState()
    await this.repository.createRun(runId, request)
    await this.sourceHealth.startAttempt(
      'kazhydromet',
      startedAt,
    )

    try {
      state.cacheAvailable = await this.repository.hasCachedKazhydrometSnapshots()
      let candidates: PdfCandidate[] = []
      try {
        const discovery = await this.adapter.discover(request)
        candidates = discovery.candidates
        state.discoveredCount = candidates.length
        state.lastHttpStatus = discovery.metadata.statusCode
        state.degraded = discovery.metadata.sourceStatus !== 'healthy'
        state.rateLimited = discovery.metadata.sourceStatus === 'rate_limited'
      } catch (error) {
        const safe = normalizeError(error, 'KAZHYDROMET_DISCOVERY_FAILED', 'Kazhydromet bulletin discovery failed')
        state.lastError = safe
        state.degraded = true
        state.rateLimited = isRateLimited(error)
        const cached = await this.repository.findCachedSources(request)
        candidates = cached.map(cachedCandidate)
        state.discoveredCount = candidates.length
      }

      if (candidates.length === 0) {
        state.lastError ??= {
          code: 'KAZHYDROMET_NO_CANDIDATES',
          message: 'No matching Kazhydromet PDF bulletins were discovered',
        }
      }

      for (const candidate of candidates) {
        try {
          const processed = await this.processCandidate(candidate, state)
          state.documents.push(processed)
          if (processed.parserStatus !== 'succeeded') state.degraded = true
        } catch (error) {
          state.rejectedCount += 1
          state.degraded = true
          state.rateLimited ||= isRateLimited(error)
          state.lastError = normalizeError(error, 'KAZHYDROMET_INGESTION_FAILED', 'Kazhydromet document ingestion failed')
        }
      }
    } catch (error) {
      state.degraded = true
      state.rateLimited ||= isRateLimited(error)
      state.lastError = normalizeError(error, 'KAZHYDROMET_INGESTION_FAILED', 'Kazhydromet ingestion failed')
    }

    const status = deriveStatus(state)
    const finishedAt = new Date()
    await this.repository.finalizeRun({
      id: runId,
      status: toRunStatus(status),
      fetchedCount: state.fetchedCount,
      acceptedCount: state.acceptedCount,
      rejectedCount: state.rejectedCount,
      errorCode: state.lastError?.code ?? null,
      errorMessage: state.lastError?.message ?? null,
      finishedAt,
      metadata: {
        discoveredCount: state.discoveredCount,
        cachedCount: state.cachedCount,
        pageCount: state.pageCount,
        validatedCandidateCount: state.validatedCandidateCount,
        rejectedCandidateCount: state.rejectedCandidateCount,
        documentIds: state.documents.map((document) => document.sourceDocumentId),
      },
    })
    await this.finalizeSourceHealth(
      status,
      state,
      finishedAt,
      runId,
    )

    return response(runId, status, state)
  }

  private async finalizeSourceHealth(
    status: KazhydrometIngestionResponse['status'],
    state: MutableRunState,
    at: Date,
    runId: string,
  ): Promise<void> {
    const baseInput = {
      at,
      lastHttpStatus: state.lastHttpStatus,
      cacheAvailable: state.cacheAvailable,
      metadata: {
        lastRunId: runId,
      },
    }

    if (status === 'succeeded') {
      await this.sourceHealth.markSuccess(
        'kazhydromet',
        baseInput,
      )
      return
    }

    if (status === 'rate_limited') {
      await this.sourceHealth.markRateLimited(
        'kazhydromet',
        {
          ...baseInput,
          success: state.acceptedCount > 0,
          error:
            state.lastError ?? {
              code: 'KAZHYDROMET_RATE_LIMITED',
              message:
                'Kazhydromet source is rate limited',
            },
        },
      )
      return
    }

    if (
      status === 'partial' &&
      state.lastError === null
    ) {
      await this.sourceHealth.markSuccess(
        'kazhydromet',
        {
          ...baseInput,
          degraded: true,
        },
      )
      return
    }

    await this.sourceHealth.markFailure(
      'kazhydromet',
      {
        ...baseInput,
        degraded: status === 'partial',
        success: state.acceptedCount > 0,
        error:
          state.lastError ?? {
            code: 'KAZHYDROMET_INGESTION_FAILED',
            message:
              'Kazhydromet ingestion failed',
          },
      },
    )
  }

  private async processCandidate(
    candidate: PdfCandidate,
    state: MutableRunState,
  ): Promise<KazhydrometDocumentResult> {
    let snapshot: KazhydrometRawSnapshot
    let document: IngestionSourceDocument
    let cachePath: string
    try {
      snapshot = await this.adapter.fetch(candidate)
      state.fetchedCount += 1
      state.lastHttpStatus = snapshot.httpStatus
      state.degraded ||= snapshot.sourceStatus !== 'healthy'
      state.rateLimited ||= snapshot.sourceStatus === 'rate_limited'
      document = await this.repository.ensureSourceDocument(buildSourceDocumentIdentity(snapshot))
      const cached = await this.sources.cacheExistingSourceSnapshot({
        sourceDocumentId: document.id,
        bytes: snapshot.bytes,
        mediaType: 'application/pdf',
        fetchedAt: snapshot.fetchedAt,
        httpStatus: snapshot.httpStatus,
      })
      if (cached.sha256 !== snapshot.sha256) {
        throw kazhydrometError('KAZHYDROMET_SOURCE_CONFLICT', 'Cached snapshot hash does not match source identity')
      }
      cachePath = cached.cachePath
      state.cachedCount += 1
      state.cacheAvailable = true
      state.snapshotAvailableInRun = true
    } catch (error) {
      if (!isOriginFailure(error)) throw error
      const fallback = await this.findCachedCandidateDocument(candidate)
      if (!fallback) throw error
      const cached = await this.sources.readCachedSourceSnapshot(fallback.id)
      snapshot = {
        candidate,
        bytes: cached.bytes,
        fetchedAt: new Date(),
        httpStatus: fallback.cachePath === null ? 0 : 200,
        finalUrl: fallback.canonicalUrl,
        sha256: cached.sha256,
        sourceStatus: isRateLimited(error) ? 'rate_limited' : 'degraded',
      }
      document = fallback
      cachePath = cached.cachePath
      state.fetchedCount += 1
      state.cachedCount += 1
      state.cacheAvailable = true
      state.snapshotAvailableInRun = true
      state.degraded = true
      state.rateLimited ||= isRateLimited(error)
      state.lastError = normalizeError(
        error,
        'KAZHYDROMET_ORIGIN_UNAVAILABLE',
        'Kazhydromet document origin is unavailable; cached snapshot was used',
      )
    }

    try {
      const pages = await this.pdfText.extractPages(snapshot.bytes)
      const relevantPages = findRelevantPages(pages)
      let validated = 0
      let rejected = 0
      for (const relevant of relevantPages) {
        const page = pages.find((value) => value.pageNumber === relevant.pageNumber)
        if (!page) continue
        for (const candidateValue of extractMeasurementCandidates(page)) {
          if (validateCandidateAgainstText(candidateValue, page).valid) validated += 1
          else rejected += 1
        }
      }
      const parserStatus = relevantPages.length > 0 ? 'succeeded' : 'partial'
      await this.repository.persistPages({
        sourceDocumentId: document.id,
        pages,
        kazhydrometMetadata: {
          parserVersion: 1,
          listingUrl: candidate.listingUrl,
          discoveryMode: candidate.discoveryMode,
          pageCount: pages.length,
          relevantPageNumbers: relevantPages.map((page) => page.pageNumber),
          validatedCandidateCount: validated,
          rejectedCandidateCount: rejected,
          parserStatus,
          lastParsedAt: new Date().toISOString(),
        },
      })
      state.acceptedCount += 1
      state.pageCount += pages.length
      state.validatedCandidateCount += validated
      state.rejectedCandidateCount += rejected
      return {
        sourceDocumentId: document.id,
        period: candidate.publishedPeriod,
        regions: candidate.regions,
        sha256: snapshot.sha256,
        cachePath,
        pageCount: pages.length,
        relevantPageNumbers: relevantPages.map((page) => page.pageNumber),
        validatedCandidateCount: validated,
        parserStatus,
      }
    } catch (error) {
      state.cacheAvailable = true
      state.snapshotAvailableInRun = true
      state.documents.push({
        sourceDocumentId: document.id,
        period: candidate.publishedPeriod,
        regions: candidate.regions,
        sha256: snapshot.sha256,
        cachePath,
        pageCount: 0,
        relevantPageNumbers: [],
        validatedCandidateCount: 0,
        parserStatus: 'failed',
      })
      throw error
    }
  }

  private async findCachedCandidateDocument(candidate: PdfCandidate): Promise<CachedIngestionSourceDocument | null> {
    if (candidate.regions.length === 1 && candidate.regions[0] === 'atyrau' && candidate.language === 'ru' && candidate.publishedPeriod) {
      const byId = await this.repository.findCachedSourceById(
        `doc-kazhydromet-${candidate.publishedPeriod}`,
        candidate.regions,
      )
      if (byId) return byId
    }
    return this.repository.findCachedSourceByCanonicalUrl(candidate.canonicalUrl, candidate.regions)
  }
}

export function normalizeKazhydrometRequest(
  dto: RunKazhydrometIngestionDto,
  configuredMaximum: number,
): NormalizedKazhydrometRequest {
  const from = monthIndex(dto.from)
  const to = monthIndex(dto.to)
  const maxDocuments = dto.maxDocuments ?? Math.min(3, configuredMaximum)
  if (from === null || to === null || from > to || to - from + 1 > 24 || maxDocuments > configuredMaximum) {
    throw new BadRequestException({
      code: 'KAZHYDROMET_REQUEST_INVALID',
      message: 'Kazhydromet ingestion request is invalid',
    })
  }
  return { from: dto.from, to: dto.to, regions: [...dto.regions], maxDocuments }
}

function monthIndex(value: string): number | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value)
  if (!match) return null
  return Number(match[1]) * 12 + Number(match[2]) - 1
}

function emptyState(): MutableRunState {
  return {
    discoveredCount: 0, fetchedCount: 0, cachedCount: 0, acceptedCount: 0,
    rejectedCount: 0, pageCount: 0, validatedCandidateCount: 0,
    rejectedCandidateCount: 0, cacheAvailable: false, snapshotAvailableInRun: false, degraded: false,
    rateLimited: false, lastHttpStatus: null, lastError: null, documents: [],
  }
}

function deriveStatus(state: MutableRunState): KazhydrometIngestionResponse['status'] {
  if (state.acceptedCount > 0 && state.rejectedCount === 0 && !state.degraded) return 'succeeded'
  if (state.acceptedCount > 0 || state.snapshotAvailableInRun) return 'partial'
  if (state.rateLimited) return 'rate_limited'
  return 'failed'
}

function toRunStatus(status: KazhydrometIngestionResponse['status']): IngestionRunStatus {
  return {
    succeeded: IngestionRunStatus.SUCCEEDED,
    partial: IngestionRunStatus.PARTIAL,
    failed: IngestionRunStatus.FAILED,
    rate_limited: IngestionRunStatus.RATE_LIMITED,
  }[status]
}


function response(
  runId: string,
  status: KazhydrometIngestionResponse['status'],
  state: MutableRunState,
): KazhydrometIngestionResponse {
  return {
    runId, status, discoveredCount: state.discoveredCount,
    fetchedCount: state.fetchedCount, cachedCount: state.cachedCount,
    pageCount: state.pageCount, validatedCandidateCount: state.validatedCandidateCount,
    rejectedCandidateCount: state.rejectedCandidateCount, documents: state.documents,
  }
}

function normalizeError(error: unknown, fallbackCode: string, fallbackMessage: string): { code: string; message: string } {
  if (error instanceof KazhydrometIngestionError) return { code: error.code, message: error.safeMessage }
  if (error instanceof SafeFetchError) {
    return {
      code: error.sourceStatus === 'rate_limited' ? 'KAZHYDROMET_RATE_LIMITED' : fallbackCode,
      message: error.sourceStatus === 'rate_limited' ? 'Kazhydromet source is rate limited' : fallbackMessage,
    }
  }
  return { code: fallbackCode, message: fallbackMessage }
}

function isRateLimited(error: unknown): boolean {
  return (error instanceof SafeFetchError && error.sourceStatus === 'rate_limited') ||
    (error instanceof KazhydrometIngestionError && error.rateLimited)
}

function isOriginFailure(error: unknown): boolean {
  return error instanceof SafeFetchError
}

function cachedCandidate(document: CachedIngestionSourceDocument): PdfCandidate {
  const isAtyrau = document.id === `doc-kazhydromet-${document.publishedPeriod}`
  return {
    url: new URL(document.originalUrl),
    canonicalUrl: document.canonicalUrl,
    listingUrl: document.originalUrl,
    anchorText: '',
    contextText: '',
    publishedPeriod: document.publishedPeriod,
    regions: document.regions,
    language: isAtyrau ? 'ru' : 'unknown',
    discoveryMode: 'listing',
    confidence: 0,
  }
}
