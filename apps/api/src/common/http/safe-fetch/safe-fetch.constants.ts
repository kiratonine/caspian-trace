export const SAFE_FETCH_MAX_REDIRECTS = 3
export const SAFE_FETCH_MAX_RETRIES = 1

export const SAFE_FETCH_RETRYABLE_STATUSES = new Set([
  408, 429, 500, 502, 503, 504,
])

export const SAFE_FETCH_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

export const SAFE_FETCH_SUPPORTED_CONTENT_TYPES = new Set([
  'application/pdf',
  'text/html',
  'application/json',
  'text/plain',
])

export const SAFE_FETCH_DNS_RESOLVER = Symbol('SAFE_FETCH_DNS_RESOLVER')
export const SAFE_FETCH_TRANSPORT = Symbol('SAFE_FETCH_TRANSPORT')
export const SAFE_FETCH_RUNTIME = Symbol('SAFE_FETCH_RUNTIME')
export const SAFE_FETCH_HTTPS_REQUEST = Symbol('SAFE_FETCH_HTTPS_REQUEST')
