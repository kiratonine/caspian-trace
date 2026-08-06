import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common'

export function sourceDocumentNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'SOURCE_DOCUMENT_NOT_FOUND',
    message: 'Source document not found',
  })
}

export function sourceSnapshotNotAvailable(): NotFoundException {
  return new NotFoundException({
    code: 'SOURCE_SNAPSHOT_NOT_AVAILABLE',
    message: 'Source snapshot is not available',
  })
}

export function sourcePageNotSupported(): BadRequestException {
  return new BadRequestException({
    code: 'SOURCE_PAGE_NOT_SUPPORTED',
    message: 'Page is supported only for PDF snapshots',
  })
}

export function sourceMediaTypeUnsupported(): BadRequestException {
  return new BadRequestException({
    code: 'SOURCE_MEDIA_TYPE_UNSUPPORTED',
    message: 'Source media type is unsupported',
  })
}

export function sourceSnapshotTooLarge(): PayloadTooLargeException {
  return new PayloadTooLargeException({
    code: 'SOURCE_SNAPSHOT_TOO_LARGE',
    message: 'Source snapshot is too large',
  })
}

export function sourceSnapshotHashConflict(): ConflictException {
  return new ConflictException({
    code: 'SOURCE_SNAPSHOT_HASH_CONFLICT',
    message: 'Source document is already bound to another snapshot hash',
  })
}

export function sourceCachePathConflict(): ConflictException {
  return new ConflictException({
    code: 'SOURCE_CACHE_PATH_CONFLICT',
    message: 'Source document is already bound to another cache path',
  })
}

export function sourceDataInvalid(): InternalServerErrorException {
  return new InternalServerErrorException({
    code: 'SOURCE_DATA_INVALID',
    message: 'Stored source data is invalid',
  })
}

export function sourceInputInvalid(
  code: 'SOURCE_PDF_SIGNATURE_INVALID' | 'SOURCE_TYPE_PATH_INVALID',
  message: string,
): BadRequestException {
  return new BadRequestException({ code, message })
}

