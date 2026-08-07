import type { IncomingHttpHeaders } from 'node:http'
import type { RequestOptions } from 'node:https'
import type { Readable } from 'node:stream'

import type { PinnedAddress } from './safe-fetch.types'

export type SafeFetchTransportRequest = {
  url: URL
  pinnedAddress: PinnedAddress
  signal: AbortSignal
  userAgent: string
  expectedContentTypes: readonly string[]
  maxBytes: number
}

export type SafeFetchTransportResponse = {
  statusCode: number
  contentType?: string
  location?: string | readonly string[]
  retryAfter?: string
  body: Buffer
}

export interface HttpsTransportPort {
  request(input: SafeFetchTransportRequest): Promise<SafeFetchTransportResponse>
}

export type SafeFetchIncomingMessage = Readable & {
  statusCode?: number
  headers: IncomingHttpHeaders
}

export interface SafeFetchClientRequest {
  once(event: 'error', listener: (error: Error) => void): this
  destroy(error?: Error): this
  end(): void
}

export type SafeFetchHttpsRequestFactory = (
  options: RequestOptions,
  onResponse: (response: SafeFetchIncomingMessage) => void,
) => SafeFetchClientRequest
