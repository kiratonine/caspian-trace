import * as https from 'node:https'
import type { LookupFunction } from 'node:net'

import { Inject, Injectable } from '@nestjs/common'

import {
  SAFE_FETCH_HTTPS_REQUEST,
  SAFE_FETCH_REDIRECT_STATUSES,
} from './safe-fetch.constants'
import { safeFetchError } from './safe-fetch.errors'
import type {
  HttpsTransportPort,
  SafeFetchClientRequest,
  SafeFetchHttpsRequestFactory,
  SafeFetchIncomingMessage,
  SafeFetchTransportRequest,
  SafeFetchTransportResponse,
} from './https-transport.port'

@Injectable()
export class NodeHttpsTransportService implements HttpsTransportPort {
  constructor(
    @Inject(SAFE_FETCH_HTTPS_REQUEST)
    private readonly requestFactory: SafeFetchHttpsRequestFactory,
  ) {}

  async request(
    input: SafeFetchTransportRequest,
  ): Promise<SafeFetchTransportResponse> {
    if (input.signal.aborted) throw timeoutError()

    const lookup: LookupFunction = (_hostname, options, callback): void => {
      if (options.all === true) {
        callback(null, [input.pinnedAddress])
        return
      }
      callback(
        null,
        input.pinnedAddress.address,
        input.pinnedAddress.family,
      )
    }

    return await new Promise<SafeFetchTransportResponse>((resolve, reject) => {
      let settled = false
      let response: SafeFetchIncomingMessage | undefined
      let request: SafeFetchClientRequest | undefined

      const cleanup = (): void => {
        input.signal.removeEventListener('abort', onAbort)
      }
      const resolveOnce = (value: SafeFetchTransportResponse): void => {
        if (settled) return
        settled = true
        cleanup()
        resolve(value)
      }
      const rejectOnce = (error: Error): void => {
        if (settled) return
        settled = true
        cleanup()
        reject(error)
      }
      const onAbort = (): void => {
        response?.destroy()
        request?.destroy()
        rejectOnce(timeoutError())
      }

      try {
        request = this.requestFactory(
          {
            protocol: 'https:',
            hostname: input.url.hostname,
            port: 443,
            path: `${input.url.pathname}${input.url.search}`,
            method: 'GET',
            servername: input.url.hostname,
            rejectUnauthorized: true,
            lookup,
            signal: input.signal,
            headers: {
              Host: input.url.hostname,
              'User-Agent': input.userAgent,
              Accept: input.expectedContentTypes.join(', '),
              'Accept-Encoding': 'identity',
              Connection: 'close',
            },
          },
          (incoming): void => {
            response = incoming
            this.handleResponse(incoming, input, request, resolveOnce, rejectOnce)
          },
        )
      } catch (error) {
        rejectOnce(toError(error))
        return
      }

      request.once('error', (error): void => {
        rejectOnce(input.signal.aborted ? timeoutError() : error)
      })
      input.signal.addEventListener('abort', onAbort, { once: true })
      request.end()
    })
  }

  private handleResponse(
    response: SafeFetchIncomingMessage,
    input: SafeFetchTransportRequest,
    request: SafeFetchClientRequest | undefined,
    resolve: (value: SafeFetchTransportResponse) => void,
    reject: (error: Error) => void,
  ): void {
    const statusCode = response.statusCode
    if (statusCode === undefined || statusCode < 100 || statusCode > 599) {
      response.destroy()
      request?.destroy()
      reject(
        safeFetchError(
          'SAFE_FETCH_NETWORK_ERROR',
          'Source returned an invalid HTTP response',
          { retryable: true, sourceStatus: 'degraded' },
        ),
      )
      return
    }

    const location = response.headers.location
    const retryAfter = singleHeader(response.headers['retry-after'])
    if (SAFE_FETCH_REDIRECT_STATUSES.has(statusCode) || statusCode < 200 || statusCode > 299) {
      response.destroy()
      resolve({
        statusCode,
        location,
        retryAfter,
        body: Buffer.alloc(0),
      })
      return
    }

    const rawContentType = singleHeader(response.headers['content-type'])
    const contentType = normalizeContentType(rawContentType)
    if (
      contentType === null ||
      !input.expectedContentTypes.includes(contentType)
    ) {
      response.destroy()
      request?.destroy()
      reject(
        safeFetchError(
          'SAFE_FETCH_CONTENT_TYPE_MISMATCH',
          'Source content type does not match the expected type',
        ),
      )
      return
    }

    const contentLength = parseContentLength(response.headers['content-length'])
    if (contentLength !== null && contentLength > input.maxBytes) {
      response.destroy()
      request?.destroy()
      reject(responseTooLarge())
      return
    }

    const chunks: Buffer[] = []
    let receivedBytes = 0
    response.on('data', (chunk: Buffer | string): void => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      receivedBytes += bytes.length
      if (receivedBytes > input.maxBytes) {
        response.destroy()
        request?.destroy()
        reject(responseTooLarge())
        return
      }
      chunks.push(bytes)
    })
    response.once('end', (): void => {
      resolve({
        statusCode,
        contentType,
        body: Buffer.concat(chunks, receivedBytes),
      })
    })
    response.once('error', (error): void => {
      reject(input.signal.aborted ? timeoutError() : error)
    })
    response.once('aborted', (): void => {
      request?.destroy()
      reject(
        safeFetchError(
          'SAFE_FETCH_NETWORK_ERROR',
          'Source response stream was interrupted',
          { retryable: true, sourceStatus: 'degraded' },
        ),
      )
    })
  }
}

export const nodeHttpsRequestFactory: SafeFetchHttpsRequestFactory = (
  options,
  onResponse,
) => https.request(options, onResponse)

export function normalizeContentType(value: string | undefined): string | null {
  if (value === undefined) return null
  const mediaType = value.split(';', 1)[0]?.trim().toLowerCase()
  return mediaType && /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mediaType)
    ? mediaType
    : null
}

function singleHeader(
  value: string | readonly string[] | undefined,
): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function parseContentLength(
  value: string | readonly string[] | undefined,
): number | null {
  const header = singleHeader(value)
  if (header === undefined || !/^\d+$/.test(header)) return null
  const parsed = Number(header)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function responseTooLarge(): Error {
  return safeFetchError(
    'SAFE_FETCH_RESPONSE_TOO_LARGE',
    'Source response is too large',
  )
}

function timeoutError(): Error {
  return safeFetchError('SAFE_FETCH_TIMEOUT', 'Source request timed out', {
    retryable: true,
    sourceStatus: 'degraded',
  })
}

function toError(value: unknown): Error {
  return value instanceof Error
    ? value
    : new Error('Safe fetch transport failed')
}
