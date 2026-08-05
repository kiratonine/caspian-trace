import type { SourceDocumentStatus } from '../generated/prisma/enums'
import type { Prisma } from '../generated/prisma/client'

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
