import { ServiceUnavailableException } from '@nestjs/common'

export function storageUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: 'SOURCE_STORAGE_UNAVAILABLE',
    message: 'Source storage is unavailable',
  })
}

export function storageImmutabilityViolation(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: 'STORAGE_IMMUTABILITY_VIOLATION',
    message: 'Stored source snapshot failed integrity verification',
  })
}

