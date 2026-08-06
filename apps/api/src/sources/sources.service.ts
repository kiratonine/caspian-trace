import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'node:crypto'

import type { PlatformEnvironment } from '../config/environment'
import {
  assertPersistedCachePath,
  normalizePersistedMediaType,
  normalizeSourceMediaType,
  prepareSourceSnapshot,
} from './source-snapshot'
import {
  sourceCachePathConflict,
  sourceDataInvalid,
  sourceDocumentNotFound,
  sourcePageNotSupported,
  sourceSnapshotHashConflict,
  sourceSnapshotNotAvailable,
  sourceSnapshotTooLarge,
} from './sources.errors'
import { SourcesRepository } from './sources.repository'
import { SOURCE_STORAGE } from './storage/storage.constants'
import type { SourceStoragePort } from './storage/storage.port'
import type {
  CachedSourceSnapshot,
  CacheExistingSourceSnapshotInput,
  CacheSourceResult,
  OpenSourceResult,
} from './sources.types'
import { storageImmutabilityViolation } from './storage/storage.errors'

@Injectable()
export class SourcesService {
  private readonly maxBytes: number
  private readonly signedUrlTtlSeconds: number

  constructor(
    private readonly repository: SourcesRepository,
    @Inject(SOURCE_STORAGE) private readonly storage: SourceStoragePort,
    config: ConfigService<PlatformEnvironment, true>,
  ) {
    this.maxBytes = config.getOrThrow('HTTP_MAX_BYTES')
    this.signedUrlTtlSeconds = config.getOrThrow(
      'SOURCE_SIGNED_URL_TTL_SECONDS',
    )
  }

  async cacheExistingSourceSnapshot(
    input: CacheExistingSourceSnapshotInput,
  ): Promise<CacheSourceResult> {
    assertCacheInput(input)
    const document = await this.repository.findForCache(input.sourceDocumentId)
    if (!document) throw sourceDocumentNotFound()

    const requestedMediaType = normalizeSourceMediaType(input.mediaType)
    if (normalizePersistedMediaType(document.mediaType) !== requestedMediaType) {
      throw sourceDataInvalid()
    }
    const preparedSnapshot = prepareSourceSnapshot({
      bytes: input.bytes,
      mediaType: requestedMediaType,
      sourceType: document.sourceType,
      publishedPeriod: document.publishedPeriod,
      fetchedAt: input.fetchedAt,
      maxBytes: this.maxBytes,
    })
    if (document.sha256 !== null && document.sha256 !== preparedSnapshot.sha256) {
      throw sourceSnapshotHashConflict()
    }
    let cachePath = preparedSnapshot.cachePath
    if (document.cachePath !== null && document.sha256 !== null) {
      if (!document.cachePath.startsWith(`${document.sourceType}/`)) {
        throw sourceCachePathConflict()
      }
      let persistedMediaType: ReturnType<typeof assertPersistedCachePath>
      try {
        persistedMediaType = assertPersistedCachePath({
          cachePath: document.cachePath,
          sha256: document.sha256,
          mediaType: document.mediaType,
        })
      } catch {
        throw sourceCachePathConflict()
      }
      if (persistedMediaType !== requestedMediaType) throw sourceDataInvalid()
      cachePath = document.cachePath
    }

    const stored = await this.storage.uploadImmutableSnapshot({
      path: cachePath,
      bytes: preparedSnapshot.bytes,
      mediaType: preparedSnapshot.mediaType,
      sha256: preparedSnapshot.sha256,
      sourceDocumentId: input.sourceDocumentId,
    })
    if (
      stored.path !== cachePath ||
      stored.sha256 !== preparedSnapshot.sha256
    ) {
      throw sourceDataInvalid()
    }

    const attached = await this.repository.attachSnapshot({
      sourceDocumentId: input.sourceDocumentId,
      sha256: preparedSnapshot.sha256,
      cachePath,
      fetchedAt: input.fetchedAt,
      httpStatus: input.httpStatus,
    })
    return {
      sourceDocumentId: attached.document.id,
      sha256: preparedSnapshot.sha256,
      cachePath,
      created: stored.created,
      attached: attached.attached,
      status: attached.document.status,
    }
  }

  async openSource(id: string, page?: number): Promise<OpenSourceResult> {
    const document = await this.repository.findForOpen(id)
    if (!document) throw sourceDocumentNotFound()
    if (document.cachePath === null || document.sha256 === null) {
      throw sourceSnapshotNotAvailable()
    }
    const mediaType = assertPersistedCachePath({
      cachePath: document.cachePath,
      sha256: document.sha256,
      mediaType: document.mediaType,
    })
    if (page !== undefined && mediaType !== 'application/pdf') {
      throw sourcePageNotSupported()
    }

    const signedUrl = await this.storage.createSignedReadUrl(
      document.cachePath,
      this.signedUrlTtlSeconds,
    )
    let location: URL
    try {
      location = new URL(signedUrl)
    } catch {
      throw sourceDataInvalid()
    }
    if (location.protocol !== 'https:') throw sourceDataInvalid()
    if (page !== undefined) location.hash = `page=${page}`
    return { location: location.toString() }
  }

  async readCachedSourceSnapshot(
    sourceDocumentId: string,
  ): Promise<CachedSourceSnapshot> {
    const document = await this.repository.findForCache(sourceDocumentId)
    if (!document) throw sourceDocumentNotFound()
    if (document.cachePath === null || document.sha256 === null) {
      throw sourceSnapshotNotAvailable()
    }
    const mediaType = assertPersistedCachePath({
      cachePath: document.cachePath,
      sha256: document.sha256,
      mediaType: document.mediaType,
    })
    const downloaded = await this.storage.download(document.cachePath)
    if (downloaded.byteLength > this.maxBytes) throw sourceSnapshotTooLarge()
    const bytes = Buffer.from(downloaded)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    if (sha256 !== document.sha256) throw storageImmutabilityViolation()
    return {
      bytes,
      mediaType,
      sha256,
      cachePath: document.cachePath,
    }
  }
}

function assertCacheInput(input: CacheExistingSourceSnapshotInput): void {
  if (
    input.sourceDocumentId.length === 0 ||
    input.sourceDocumentId.trim() !== input.sourceDocumentId ||
    !Number.isInteger(input.httpStatus) ||
    input.httpStatus < 100 ||
    input.httpStatus > 599 ||
    !Number.isFinite(input.fetchedAt.getTime())
  ) {
    throw sourceDataInvalid()
  }
}
