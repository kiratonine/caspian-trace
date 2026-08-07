export type SafeFetchErrorCode =
  | 'SAFE_FETCH_POLICY_INVALID'
  | 'SAFE_FETCH_URL_INVALID'
  | 'SAFE_FETCH_HTTPS_REQUIRED'
  | 'SAFE_FETCH_HOST_NOT_ALLOWED'
  | 'SAFE_FETCH_PORT_NOT_ALLOWED'
  | 'SAFE_FETCH_CREDENTIALS_NOT_ALLOWED'
  | 'SAFE_FETCH_IP_LITERAL_NOT_ALLOWED'
  | 'SAFE_FETCH_DNS_RESOLUTION_FAILED'
  | 'SAFE_FETCH_PRIVATE_ADDRESS_BLOCKED'
  | 'SAFE_FETCH_REDIRECT_INVALID'
  | 'SAFE_FETCH_TOO_MANY_REDIRECTS'
  | 'SAFE_FETCH_TIMEOUT'
  | 'SAFE_FETCH_NETWORK_ERROR'
  | 'SAFE_FETCH_TLS_ERROR'
  | 'SAFE_FETCH_RESPONSE_TOO_LARGE'
  | 'SAFE_FETCH_CONTENT_TYPE_MISMATCH'
  | 'SAFE_FETCH_HTTP_ERROR'
  | 'SAFE_FETCH_RATE_LIMITED'
  | 'SAFE_FETCH_TEXT_DECODING_FAILED'
  | 'SAFE_FETCH_JSON_INVALID'
  | 'SAFE_FETCH_RESPONSE_SCHEMA_INVALID'

export class SafeFetchError extends Error {
  readonly code: SafeFetchErrorCode
  readonly safeMessage: string
  readonly statusCode?: number
  readonly retryable: boolean
  readonly sourceStatus?: 'degraded' | 'rate_limited'
  readonly retryAfter?: string

  constructor(input: {
    code: SafeFetchErrorCode
    safeMessage: string
    statusCode?: number
    retryable?: boolean
    sourceStatus?: 'degraded' | 'rate_limited'
    retryAfter?: string
  }) {
    super(input.safeMessage)
    this.name = 'SafeFetchError'
    this.code = input.code
    this.safeMessage = input.safeMessage
    this.statusCode = input.statusCode
    this.retryable = input.retryable ?? false
    this.sourceStatus = input.sourceStatus
    this.retryAfter = input.retryAfter
  }
}

export function safeFetchError(
  code: SafeFetchErrorCode,
  safeMessage: string,
  options: {
    statusCode?: number
    retryable?: boolean
    sourceStatus?: 'degraded' | 'rate_limited'
    retryAfter?: string
  } = {},
): SafeFetchError {
  return new SafeFetchError({ code, safeMessage, ...options })
}
