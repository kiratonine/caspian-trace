import type { SourceDocumentStatus } from '../generated/prisma/enums'
import type { Prisma } from '../generated/prisma/client'
import type { ArticleDocumentResult } from './article/article.types'
import type {
  ArticleSignalCandidate,
  ArticleSignalEnrichmentSummary,
} from './article/article-signal-candidate'

export const KAZHYDROMET_REGIONS = ['atyrau', 'mangystau'] as const
export type KazhydrometRegion = (typeof KAZHYDROMET_REGIONS)[number]

export interface NormalizedKazhydrometRequest {
  from: string
  to: string
  regions: KazhydrometRegion[]
  maxDocuments: number
}

export interface KazhydrometDocumentResult {
  sourceDocumentId: string
  period: string | null
  regions: KazhydrometRegion[]
  sha256: string
  cachePath: string
  pageCount: number
  relevantPageNumbers: number[]
  validatedCandidateCount: number
  parserStatus: 'succeeded' | 'partial' | 'failed'
}

export interface KazhydrometIngestionResponse {
  runId: string
  status: 'succeeded' | 'partial' | 'failed' | 'rate_limited'
  discoveredCount: number
  fetchedCount: number
  cachedCount: number
  pageCount: number
  validatedCandidateCount: number
  rejectedCandidateCount: number
  documents: KazhydrometDocumentResult[]
}

export interface SourceDocumentIdentityInput {
  id: string
  originalUrl: string
  canonicalUrl: string
  publisher: string
  title: string
  sourceType: string
  mediaType: string
  publishedPeriod: string | null
  sha256: string
  extractionMetadata: Prisma.InputJsonObject
}

export interface IngestionSourceDocument {
  id: string
  originalUrl: string
  canonicalUrl: string
  mediaType: string
  publishedPeriod: string | null
  sha256: string | null
  cachePath: string | null
  status: SourceDocumentStatus
}

export interface CachedIngestionSourceDocument extends IngestionSourceDocument {
  regions: KazhydrometRegion[]
}

export interface PersistedPagesResult {
  pageCount: number
  createdCount: number
}

export interface NormalizedGdeltRequest {
  from: Date
  to: Date
  regions: KazhydrometRegion[]
  maxRecords: number
  maxArticles: number
  includeDirectFallback: boolean
}

export type PublicRunStatus = 'succeeded' | 'partial' | 'failed' | 'rate_limited'

export interface GdeltIngestionResponse {
  status: PublicRunStatus
  gdelt: {
    runId: string
    status: PublicRunStatus
    sourceStatus: 'healthy' | 'degraded' | 'rate_limited' | null
    cacheStatus: 'miss' | 'fresh' | 'stale' | null
    discoveredCount: number
    allowedCandidateCount: number
    acceptedCount: number
    rejectedCount: number
  }
  directFallback: {
    used: boolean
    runId: string | null
    status: PublicRunStatus | null
    attemptedCount: number
    acceptedCount: number
    rejectedCount: number
  }
  enrichment: ArticleSignalEnrichmentSummary
  signalCandidates: ArticleSignalCandidate[]
  documents: ArticleDocumentResult[]
}
