import type { Server } from 'node:http'

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  type INestApplication,
} from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { IsString } from 'class-validator'
import request from 'supertest'

import { ApiErrorSchema, HealthLiveSchema } from '@caspian-trace/contracts'

import { AppModule } from '../src/app.module'
import { configureApplication } from '../src/config/application.setup'

class ValidationProbeDto {
  @IsString()
  value!: string
}

@Controller('__test/validation')
class ValidationProbeController {
  @Post()
  validate(@Body() body: ValidationProbeDto): ValidationProbeDto {
    return body
  }
}

@Controller('__test/errors')
class ErrorProbeController {
  @Get('bad-request')
  badRequest(): never {
    throw new BadRequestException({
      code: 'CUSTOM_BAD_REQUEST',
      message: 'Custom bad request',
    })
  }

  @Get('not-found')
  notFound(): never {
    throw new NotFoundException({
      code: 'CUSTOM_NOT_FOUND',
      message: 'Custom resource was not found',
    })
  }
}

describe('API foundation (e2e)', () => {
  let app: INestApplication
  let httpServer: Server
  let swaggerPaths: Record<string, unknown>

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ValidationProbeController, ErrorProbeController],
    }).compile()

    app = module.createNestApplication({ bodyParser: false })
    swaggerPaths = configureApplication(app).paths
    await app.init()
    const server: unknown = app.getHttpServer()
    if (!isHttpServer(server)) throw new Error('Nest did not create an HTTP server')
    httpServer = server
  })

  afterAll(async () => {
    await app.close()
  })

  it('boots and returns a contract-valid liveness response', async () => {
    const response = await request(httpServer)
      .get('/api/health/live')
      .expect(200)

    expect(HealthLiveSchema.parse(response.body)).toEqual({
      status: 'ok',
      service: 'caspian-trace-api',
    })
    expect(response.headers['x-request-id']).toEqual(expect.any(String))
  })

  it('returns a valid forwarded request id', async () => {
    const response = await request(httpServer)
      .get('/api/health/live')
      .set('x-request-id', 'part-01-forwarded')
      .expect(200)

    expect(response.headers['x-request-id']).toBe('part-01-forwarded')
  })

  it('normalizes unknown routes', async () => {
    const response = await request(httpServer)
      .get('/api/unknown-route')
      .expect(404)

    expect(ApiErrorSchema.parse(response.body)).toEqual({
      code: 'ROUTE_NOT_FOUND',
      message: 'Route not found',
      requestId: response.headers['x-request-id'],
    })
  })

  it('rejects non-whitelisted DTO fields with a normalized error', async () => {
    const response = await request(httpServer)
      .post('/api/__test/validation')
      .send({ value: 'accepted', extra: 'rejected' })
      .expect(400)

    expect(ApiErrorSchema.parse(response.body)).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      requestId: response.headers['x-request-id'],
    })
  })

  it.each([
    [
      '/api/__test/errors/bad-request',
      400,
      'CUSTOM_BAD_REQUEST',
      'Custom bad request',
    ],
    [
      '/api/__test/errors/not-found',
      404,
      'CUSTOM_NOT_FOUND',
      'Custom resource was not found',
    ],
  ])(
    'preserves a custom error from %s',
    async (path, status, code, message) => {
      const response = await request(httpServer).get(path).expect(status)

      expect(ApiErrorSchema.parse(response.body)).toEqual({
        code,
        message,
        requestId: response.headers['x-request-id'],
      })
    },
  )

  it('normalizes malformed JSON separately from DTO validation', async () => {
    const response = await request(httpServer)
      .post('/api/__test/validation')
      .set('content-type', 'application/json')
      .send('{"value":')
      .expect(400)

    expect(ApiErrorSchema.parse(response.body)).toEqual({
      code: 'MALFORMED_JSON',
      message: 'Malformed JSON body',
      requestId: response.headers['x-request-id'],
    })
  })

  it('normalizes requests that exceed the configured body limit', async () => {
    const response = await request(httpServer)
      .post('/api/__test/validation')
      .send({ value: 'x'.repeat(2_048) })
      .expect(413)

    expect(ApiErrorSchema.parse(response.body)).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body is too large',
      requestId: response.headers['x-request-id'],
    })
  })

  it('creates Swagger documentation with the health endpoint', () => {
    expect(swaggerPaths).toHaveProperty('/api/health/live')
  })
})

function isHttpServer(value: unknown): value is Server {
  return (
    typeof value === 'object' &&
    value !== null &&
    'listen' in value &&
    typeof value.listen === 'function'
  )
}
