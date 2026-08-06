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

export type PublicIngestionErrorCode =
  | 'GDELT_REQUEST_INVALID'
  | 'GDELT_RESPONSE_INVALID'
  | 'GDELT_NO_ALLOWED_ARTICLES'
  | 'GDELT_RATE_LIMITED'
  | 'GDELT_INGESTION_FAILED'
  | 'DIRECT_SOURCE_URL_INVALID'
  | 'DIRECT_SOURCE_HOST_NOT_ALLOWED'
  | 'DIRECT_SOURCE_REGION_MISMATCH'
  | 'DIRECT_SOURCE_INGESTION_FAILED'
  | 'PUBLIC_ARTICLE_SOURCE_CONFLICT'
  | 'PUBLIC_ARTICLE_METADATA_CONFLICT'
  | 'PUBLIC_ARTICLE_TEXT_INVALID'
  | 'PUBLIC_ARTICLE_TEXT_EMPTY'
  | 'PUBLIC_ARTICLE_TEXT_TOO_LARGE'
  | 'PUBLIC_ARTICLE_INGESTION_FAILED'

export class PublicIngestionError extends Error {
  constructor(
    readonly code: PublicIngestionErrorCode,
    readonly safeMessage: string,
    readonly rateLimited = false,
  ) {
    super(safeMessage)
    this.name = 'PublicIngestionError'
  }
}

export function publicIngestionError(
  code: PublicIngestionErrorCode,
  safeMessage: string,
  rateLimited = false,
): PublicIngestionError {
  return new PublicIngestionError(code, safeMessage, rateLimited)
}
