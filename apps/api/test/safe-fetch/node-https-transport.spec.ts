import { EventEmitter } from 'node:events'
import type { RequestOptions } from 'node:https'
import { Readable } from 'node:stream'

import type {
  SafeFetchClientRequest,
  SafeFetchHttpsRequestFactory,
  SafeFetchIncomingMessage,
} from '../../src/common/http/safe-fetch/https-transport.port'
import { NodeHttpsTransportService } from '../../src/common/http/safe-fetch/node-https-transport.service'

const baseInput = {
  url: new URL('https://kazhydromet.kz/ecology?period=2025-09'),
  pinnedAddress: { address: '93.184.216.34', family: 4 as const },
  userAgent: 'caspian-trace-test/1.0',
  expectedContentTypes: ['text/plain'],
  maxBytes: 10,
}

describe('NodeHttpsTransportService integration boundary', () => {
  it('pins lookup while preserving original Host, SNI, and TLS verification', async () => {
    const harness = createHarness(
      new FakeResponse(200, { 'content-type': 'text/plain' }, ['ok']),
    )
    const controller = new AbortController()
    await harness.transport.request({ ...baseInput, signal: controller.signal })

    expect(harness.options).toMatchObject({
      hostname: 'kazhydromet.kz',
      servername: 'kazhydromet.kz',
      rejectUnauthorized: true,
      method: 'GET',
      path: '/ecology?period=2025-09',
      headers: {
        Host: 'kazhydromet.kz',
      },
    })
    expect(harness.options.headers).not.toHaveProperty('Authorization')
    expect(harness.options.headers).not.toHaveProperty('Cookie')
    expect(harness.options.headers).not.toHaveProperty('Proxy-Authorization')

    const callback = jest.fn()
    harness.options.lookup?.('untrusted-rebinding.example', {}, callback)
    expect(callback).toHaveBeenCalledWith(null, '93.184.216.34', 4)

    const allCallback = jest.fn()
    harness.options.lookup?.(
      'untrusted-rebinding.example',
      { all: true },
      allCallback,
    )
    expect(allCallback).toHaveBeenCalledWith(null, [
      { address: '93.184.216.34', family: 4 },
    ])
  })

  it('normalizes content-type parameters and streams a bounded body', async () => {
    const harness = createHarness(
      new FakeResponse(
        200,
        { 'content-type': 'text/plain; charset=utf-8', 'content-length': '4' },
        ['ab', 'cd'],
      ),
    )
    await expect(
      harness.transport.request({
        ...baseInput,
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({
      statusCode: 200,
      contentType: 'text/plain',
      body: Buffer.from('abcd'),
    })
  })

  it('rejects Content-Length before body accumulation', async () => {
    const response = new FakeResponse(
      200,
      { 'content-type': 'text/plain', 'content-length': '11' },
      ['not-read'],
    )
    const harness = createHarness(response)
    await expect(
      harness.transport.request({
        ...baseInput,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: 'SAFE_FETCH_RESPONSE_TOO_LARGE' })
    expect(response.destroyed).toBe(true)
    expect(harness.request.destroyCalled).toBe(true)
  })

  it('aborts a streamed body immediately after crossing the byte limit', async () => {
    const response = new FakeResponse(
      200,
      { 'content-type': 'text/plain' },
      ['12345', '678901'],
    )
    const harness = createHarness(response)
    await expect(
      harness.transport.request({
        ...baseInput,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: 'SAFE_FETCH_RESPONSE_TOO_LARGE' })
    expect(response.destroyed).toBe(true)
    expect(harness.request.destroyCalled).toBe(true)
  })

  it.each([
    [{}, ['text/plain'], 'missing content type'],
    [{ 'content-type': 'text/html' }, ['application/pdf'], 'HTML instead of PDF'],
  ])('rejects %s (%s)', async (headers, expectedContentTypes, caseName) => {
    expect(caseName).not.toHaveLength(0)
    const harness = createHarness(new FakeResponse(200, headers, ['body']))
    await expect(
      harness.transport.request({
        ...baseInput,
        expectedContentTypes,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: 'SAFE_FETCH_CONTENT_TYPE_MISMATCH' })
  })

  it('destroys redirect bodies and returns only safe redirect metadata', async () => {
    const response = new FakeResponse(
      302,
      { location: 'https://kazhydromet.kz/final' },
      ['ignored-body'],
    )
    const harness = createHarness(response)
    await expect(
      harness.transport.request({
        ...baseInput,
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({
      statusCode: 302,
      location: 'https://kazhydromet.kz/final',
      retryAfter: undefined,
      body: Buffer.alloc(0),
    })
    expect(response.destroyed).toBe(true)
  })

  it('destroys the request and response when the timeout signal aborts', async () => {
    const controller = new AbortController()
    const harness = createHarness(undefined)
    const promise = harness.transport.request({
      ...baseInput,
      signal: controller.signal,
    })
    controller.abort()

    await expect(promise).rejects.toMatchObject({ code: 'SAFE_FETCH_TIMEOUT' })
    expect(harness.request.destroyCalled).toBe(true)
  })

  it('rejects and destroys the request when the response stream is aborted', async () => {
    const response = new AbortedResponse()
    const harness = createHarness(response)

    await expect(
      harness.transport.request({
        ...baseInput,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: 'SAFE_FETCH_NETWORK_ERROR' })
    expect(harness.request.destroyCalled).toBe(true)
  })

  it('removes abort handling after success', async () => {
    const controller = new AbortController()
    const harness = createHarness(
      new FakeResponse(200, { 'content-type': 'text/plain' }, ['ok']),
    )
    await harness.transport.request({ ...baseInput, signal: controller.signal })
    controller.abort()
    expect(harness.request.destroyCalled).toBe(false)
  })
})

class FakeResponse extends Readable implements SafeFetchIncomingMessage {
  readonly statusCode: number
  readonly headers: SafeFetchIncomingMessage['headers']
  private readonly chunks: readonly (Buffer | string)[]

  constructor(
    statusCode: number,
    headers: SafeFetchIncomingMessage['headers'],
    chunks: readonly (Buffer | string)[],
  ) {
    super()
    this.statusCode = statusCode
    this.headers = headers
    this.chunks = chunks
  }

  override _read(): void {
    for (const chunk of this.chunks) this.push(chunk)
    this.push(null)
  }
}

class AbortedResponse extends FakeResponse {
  constructor() {
    super(200, { 'content-type': 'text/plain' }, [])
  }

  override _read(): void {
    this.push('partial')
    this.emit('aborted')
  }
}

class FakeRequest extends EventEmitter implements SafeFetchClientRequest {
  destroyCalled = false

  constructor(private readonly onEnd: () => void) {
    super()
  }

  destroy(): this {
    this.destroyCalled = true
    return this
  }

  end(): void {
    this.onEnd()
  }
}

function createHarness(response: FakeResponse | undefined): {
  transport: NodeHttpsTransportService
  request: FakeRequest
  options: RequestOptions
} {
  let capturedOptions: RequestOptions = {}
  let onResponse: ((incoming: SafeFetchIncomingMessage) => void) | undefined
  const request = new FakeRequest(() => {
    if (response !== undefined && onResponse !== undefined) onResponse(response)
  })
  const factory: SafeFetchHttpsRequestFactory = (options, callback) => {
    capturedOptions = options
    onResponse = callback
    return request
  }
  return {
    transport: new NodeHttpsTransportService(factory),
    request,
    get options(): RequestOptions {
      return capturedOptions
    },
  }
}
