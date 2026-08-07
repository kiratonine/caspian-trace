export type VerifiedSeedErrorCode =
  | 'VERIFIED_DATA_PATH_INVALID'
  | 'VERIFIED_DATA_SCHEMA_INVALID'
  | 'VERIFIED_DATA_HUMAN_REVIEW_INVALID'
  | 'VERIFIED_DATA_HUMAN_REVIEW_INCOMPLETE'
  | 'VERIFIED_SEED_CONFLICT'
  | 'SEED_CONFLICT_STATION_LABEL'

export class VerifiedSeedError extends Error {
  constructor(
    readonly code: VerifiedSeedErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'VerifiedSeedError'
  }
}

export function schemaError(message: string): VerifiedSeedError {
  return new VerifiedSeedError('VERIFIED_DATA_SCHEMA_INVALID', message)
}
