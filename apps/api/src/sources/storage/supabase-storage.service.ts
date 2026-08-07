import { createHash } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { PlatformEnvironment } from '../../config/environment'
import { storageImmutabilityViolation, storageUnavailable } from './storage.errors'
import type { SourceStoragePort } from './storage.port'
import type {
  StoredSnapshot,
  UploadImmutableSnapshotInput,
} from './storage.types'

type StorageErrorLike = {
  code?: unknown
  error?: unknown
  status?: unknown
  statusCode?: unknown
}

const DUPLICATE_ERROR_CODES = new Set([
  'Duplicate',
  'ResourceAlreadyExists',
  'KeyAlreadyExists',
  'already_exists',
])

const NOT_FOUND_ERROR_CODES = new Set([
  'NotFound',
  'ResourceNotFound',
  'ObjectNotFound',
  'KeyNotFound',
  'NoSuchKey',
  'not_found',
])

type StorageOnlyDatabase = {
  public: {
    Tables: Record<never, never>
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

@Injectable()
export class SupabaseStorageService implements SourceStoragePort {
  private readonly client: SupabaseClient<StorageOnlyDatabase>
  private readonly bucket: string

  constructor(config: ConfigService<PlatformEnvironment, true>) {
    this.bucket = config.getOrThrow('SUPABASE_SOURCE_BUCKET')
    this.client = createClient<StorageOnlyDatabase>(
      config.getOrThrow('SUPABASE_URL'),
      config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    )
  }

  async uploadImmutableSnapshot(
    input: UploadImmutableSnapshotInput,
  ): Promise<StoredSnapshot> {
    const { error } = await this.client.storage.from(this.bucket).upload(
      input.path,
      input.bytes,
      {
        contentType: input.mediaType,
        upsert: false,
        cacheControl: '31536000',
        metadata: {
          sha256: input.sha256,
          sourceDocumentId: input.sourceDocumentId,
        },
      },
    )

    if (!error) {
      return { path: input.path, sha256: input.sha256, created: true }
    }
    if (!isDuplicateError(error)) throw storageUnavailable()

    const existing = await this.download(input.path)
    const actualSha = createHash('sha256').update(existing).digest('hex')
    if (actualSha !== input.sha256) throw storageImmutabilityViolation()
    return { path: input.path, sha256: input.sha256, created: false }
  }

  async createSignedReadUrl(
    path: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresInSeconds)
    if (error || !data?.signedUrl) throw storageUnavailable()

    let parsed: URL
    try {
      parsed = new URL(data.signedUrl)
    } catch {
      throw storageUnavailable()
    }
    if (parsed.protocol !== 'https:') throw storageUnavailable()
    return parsed.toString()
  }

  async exists(path: string): Promise<boolean> {
    const { error } = await this.client.storage.from(this.bucket).download(path)
    if (!error) return true
    if (isNotFoundError(error)) return false
    throw storageUnavailable()
  }

  async download(path: string): Promise<Buffer> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(path)
    if (error || !data) throw storageUnavailable()
    try {
      return Buffer.from(await data.arrayBuffer())
    } catch {
      throw storageUnavailable()
    }
  }
}

function isDuplicateError(error: StorageErrorLike): boolean {
  return hasHttpStatus(error, 409) || hasErrorCode(error, DUPLICATE_ERROR_CODES)
}

function isNotFoundError(error: StorageErrorLike): boolean {
  return hasHttpStatus(error, 404) || hasErrorCode(error, NOT_FOUND_ERROR_CODES)
}

function hasHttpStatus(error: StorageErrorLike, expected: number): boolean {
  return [error.status, error.statusCode].some(
    (value) =>
      value === expected ||
      (typeof value === 'string' && value === String(expected)),
  )
}

function hasErrorCode(
  error: StorageErrorLike,
  expectedCodes: ReadonlySet<string>,
): boolean {
  return [error.error, error.code, error.status, error.statusCode].some(
    (value) => typeof value === 'string' && expectedCodes.has(value),
  )
}
