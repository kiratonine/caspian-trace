import type { SourceDocumentStatus } from '../generated/prisma/enums'
import type { SupportedSourceMediaType } from './storage/storage.types'

export interface CacheExistingSourceSnapshotInput {
  sourceDocumentId: string
  bytes: Buffer
  mediaType: string
  fetchedAt: Date
  httpStatus: number
}

export interface CacheSourceResult {
  sourceDocumentId: string
  sha256: string
  cachePath: string
  created: boolean
  attached: boolean
  status: SourceDocumentStatus
}

export interface OpenSourceResult {
  location: string
}

export interface CachedSourceSnapshot {
  bytes: Buffer
  mediaType: SupportedSourceMediaType
  sha256: string
  cachePath: string
}

export interface PreparedSnapshot {
  bytes: Buffer
  mediaType: SupportedSourceMediaType
  sha256: string
  cachePath: string
}

export interface SourceForCache {
  id: string
  sourceType: string
  mediaType: string
  publishedPeriod: string | null
  fetchedAt: Date | null
  sha256: string | null
  cachePath: string | null
  httpStatus: number | null
  status: SourceDocumentStatus
}

export interface SourceForOpen {
  id: string
  mediaType: string
  sha256: string | null
  cachePath: string | null
  status: SourceDocumentStatus
}
