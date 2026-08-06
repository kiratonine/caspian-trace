import { createHash } from 'node:crypto'

import {
  sourceDataInvalid,
  sourceInputInvalid,
  sourceMediaTypeUnsupported,
  sourceSnapshotTooLarge,
} from './sources.errors'
import { SOURCE_MEDIA_EXTENSIONS } from './storage/storage.constants'
import type { SupportedSourceMediaType } from './storage/storage.types'
import type { PreparedSnapshot } from './sources.types'

const SOURCE_TYPE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const PERIOD_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/
const SHA_PATTERN = /^[0-9a-f]{64}$/

export function normalizeSourceMediaType(
  mediaType: string,
): SupportedSourceMediaType {
  const normalized = mediaType.split(';', 1)[0]?.trim().toLowerCase()
  if (
    normalized === undefined ||
    !Object.hasOwn(SOURCE_MEDIA_EXTENSIONS, normalized)
  ) {
    throw sourceMediaTypeUnsupported()
  }
  return normalized as SupportedSourceMediaType
}

export function prepareSourceSnapshot(input: {
  bytes: Buffer
  mediaType: string
  sourceType: string
  publishedPeriod: string | null
  fetchedAt: Date
  maxBytes: number
}): PreparedSnapshot {
  if (input.bytes.length === 0) throw sourceDataInvalid()
  if (input.bytes.length > input.maxBytes) throw sourceSnapshotTooLarge()
  if (!SOURCE_TYPE_PATTERN.test(input.sourceType)) {
    throw sourceInputInvalid(
      'SOURCE_TYPE_PATH_INVALID',
      'Source type cannot be used in a storage path',
    )
  }
  if (!Number.isFinite(input.fetchedAt.getTime())) throw sourceDataInvalid()

  const mediaType = normalizeSourceMediaType(input.mediaType)
  if (
    mediaType === 'application/pdf' &&
    !input.bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))
  ) {
    throw sourceInputInvalid(
      'SOURCE_PDF_SIGNATURE_INVALID',
      'Source PDF signature is invalid',
    )
  }

  const [year, month] = resolveYearMonth(
    input.publishedPeriod,
    input.fetchedAt,
  )
  const sha256 = createHash('sha256').update(input.bytes).digest('hex')
  const extension = SOURCE_MEDIA_EXTENSIONS[mediaType]
  return {
    bytes: input.bytes,
    mediaType,
    sha256,
    cachePath: `${input.sourceType}/${year}/${month}/${sha256}.${extension}`,
  }
}

export function assertPersistedCachePath(input: {
  cachePath: string
  sha256: string
  mediaType: string
}): SupportedSourceMediaType {
  if (!SHA_PATTERN.test(input.sha256)) throw sourceDataInvalid()
  const mediaType = normalizePersistedMediaType(input.mediaType)
  const extension = SOURCE_MEDIA_EXTENSIONS[mediaType]
  const pathPattern = new RegExp(
    `^[a-z0-9][a-z0-9_-]{0,63}/\\d{4}/(?:0[1-9]|1[0-2])/${input.sha256}\\.${extension}$`,
  )
  if (!pathPattern.test(input.cachePath)) throw sourceDataInvalid()
  return mediaType
}

export function normalizePersistedMediaType(
  mediaType: string,
): SupportedSourceMediaType {
  try {
    return normalizeSourceMediaType(mediaType)
  } catch {
    throw sourceDataInvalid()
  }
}

function resolveYearMonth(
  publishedPeriod: string | null,
  fetchedAt: Date,
): [string, string] {
  if (publishedPeriod !== null) {
    const match = PERIOD_PATTERN.exec(publishedPeriod)
    if (!match?.[1] || !match[2]) throw sourceDataInvalid()
    return [match[1], match[2]]
  }
  return [
    String(fetchedAt.getUTCFullYear()).padStart(4, '0'),
    String(fetchedAt.getUTCMonth() + 1).padStart(2, '0'),
  ]
}
