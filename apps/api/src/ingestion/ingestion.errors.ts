export type KazhydrometErrorCode =
  | 'KAZHYDROMET_REQUEST_INVALID'
  | 'KAZHYDROMET_DISCOVERY_FAILED'
  | 'KAZHYDROMET_NO_CANDIDATES'
  | 'KAZHYDROMET_PDF_INVALID'
  | 'KAZHYDROMET_PDF_TEXT_EMPTY'
  | 'KAZHYDROMET_PDF_TOO_MANY_PAGES'
  | 'KAZHYDROMET_PDF_TEXT_TOO_LARGE'
  | 'KAZHYDROMET_SOURCE_CONFLICT'
  | 'KAZHYDROMET_PAGE_CONFLICT'
  | 'KAZHYDROMET_RATE_LIMITED'
  | 'KAZHYDROMET_INGESTION_FAILED'

export class KazhydrometIngestionError extends Error {
  constructor(
    readonly code: KazhydrometErrorCode,
    readonly safeMessage: string,
    readonly rateLimited = false,
  ) {
    super(safeMessage)
    this.name = 'KazhydrometIngestionError'
  }
}

export function kazhydrometError(
  code: KazhydrometErrorCode,
  safeMessage: string,
  rateLimited = false,
): KazhydrometIngestionError {
  return new KazhydrometIngestionError(code, safeMessage, rateLimited)
}
