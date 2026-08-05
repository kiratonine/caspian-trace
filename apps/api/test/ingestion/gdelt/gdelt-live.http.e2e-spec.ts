import type { Server } from 'node:http'

import { BadRequestException, type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request, { type Test as SuperTestRequest } from 'supertest'

import { ApiErrorSchema, LiveStatusSchema } from '@caspian-trace/contracts'

import { AppModule } from '../../../src/app.module'
import { configureApplication } from '../../../src/config/application.setup'
import { GdeltIngestionService } from '../../../src/ingestion/gdelt/gdelt-ingestion.service'
import { LiveService } from '../../../src/live/live.service'
import { PrismaService } from '../../../src/prisma/prisma.service'
import type { GdeltIngestionResponse } from '../../../src/ingestion/ingestion.types'
import type { LiveStatus } from '@caspian-trace/contracts'
import type { RunGdeltIngestionDto } from '../../../src/ingestion/dto/run-gdelt-ingestion.dto'

describe('GDELT ingestion and live status HTTP API (e2e)', () => {
  const run = jest.fn()
  const getStatus = jest.fn()
  let app: INestApplication
  let server: Server
  let swagger: ReturnType<typeof configureApplication>

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({ checkReadiness: jest.fn() })
      .overrideProvider(GdeltIngestionService).useValue({ run })
      .overrideProvider(LiveService).useValue({ getStatus })
      .compile()
    app = module.createNestApplication({ bodyParser: false })
    swagger = configureApplication(app)
    await app.init()
    server = app.getHttpServer() as Server
  })

  afterAll(async () => app.close())

  beforeEach(() => {
    run.mockReset().mockResolvedValue(responseBody())
    getStatus.mockReset().mockResolvedValue(liveBody())
  })

  it.each([['missing', undefined], ['invalid', 'wrong-token']])(
    'rejects %s token before ingestion', async (_label, token) => {
      let pending = request(server).post('/api/admin/ingestion/gdelt').send(validBody())
      if (token) pending = pending.set('X-Ingestion-Token', token)
      const response = await pending.expect(401)
      expect(ApiErrorSchema.parse(response.body).code).toBe('INGESTION_UNAUTHORIZED')
      expect(run).not.toHaveBeenCalled()
      expect(JSON.stringify(response.body)).not.toContain(token ?? process.env.INGESTION_TOKEN)
    },
  )

  it('accepts a fixed-window request and returns explicit rate-limit status', async () => {
    run.mockResolvedValueOnce({ ...responseBody(), status: 'rate_limited', gdelt: { ...responseBody().gdelt, status: 'rate_limited', sourceStatus: 'rate_limited' } })
    const response = await authorized(validBody()).expect(200)
    expect((response.body as { status: unknown }).status).toBe('rate_limited')
    expect(response.headers['x-request-id']).toEqual(expect.any(String))
    expect(run).toHaveBeenCalledWith(validBody())
  })

  it.each([
    ['invalid datetime', { ...validBody(), from: '2025-09-01' }],
    ['invalid region', { ...validBody(), regions: ['west'] }],
    ['duplicate region', { ...validBody(), regions: ['atyrau', 'atyrau'] }],
    ['records over 25', { ...validBody(), maxRecords: 26 }],
    ['unknown query field', { ...validBody(), query: 'user supplied' }],
    ['arbitrary URL field', { ...validBody(), url: 'https://example.com' }],
  ])('rejects %s at DTO boundary', async (_label, body) => {
    const response = await authorized(body).expect(400)
    expect(ApiErrorSchema.parse(response.body).code).toBe('VALIDATION_ERROR')
    expect(run).not.toHaveBeenCalled()
  })

  it('normalizes service-level range validation', async () => {
    run.mockRejectedValueOnce(new BadRequestException({
      code: 'GDELT_REQUEST_INVALID', message: 'GDELT ingestion request is invalid',
    }))
    const response = await authorized({ ...validBody(), from: validBody().to }).expect(400)
    expect(ApiErrorSchema.parse(response.body).code).toBe('GDELT_REQUEST_INVALID')
  })

  it('serves three contract-valid sources publicly without internal fields', async () => {
    const response = await request(server).get('/api/live/status').expect(200)
    expect(LiveStatusSchema.parse(response.body).sources.map((source) => source.id)).toEqual([
      'kazhydromet-bulletins', 'gdelt', 'direct-sources',
    ])
    expect(JSON.stringify(response.body)).not.toMatch(/detail|lastHttpStatus|consecutiveErrors|metadata/)
    expect(getStatus).toHaveBeenCalledTimes(1)
  })

  it('documents protected ingestion and public live endpoints', () => {
    const ingestion = swagger.paths['/api/admin/ingestion/gdelt']?.post
    expect(ingestion?.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'X-Ingestion-Token', required: true }),
    ]))
    expect(ingestion?.requestBody).toBeDefined()
    expect(swagger.paths['/api/live/status']?.get).toBeDefined()
  })

  function authorized(body: object): SuperTestRequest {
    return request(server).post('/api/admin/ingestion/gdelt')
      .set('X-Ingestion-Token', process.env.INGESTION_TOKEN!).send(body)
  }
})

function validBody(): RunGdeltIngestionDto {
  return {
    from: '2025-09-01T00:00:00Z', to: '2025-09-30T23:59:59Z', regions: ['atyrau'],
    maxRecords: 25, maxArticles: 1, includeDirectFallback: true,
  }
}

function responseBody(): GdeltIngestionResponse {
  return {
    status: 'succeeded',
    gdelt: {
      runId: '11111111-1111-4111-8111-111111111111', status: 'succeeded', sourceStatus: 'healthy',
      cacheStatus: 'miss', discoveredCount: 1, allowedCandidateCount: 1, acceptedCount: 1, rejectedCount: 0,
    },
    directFallback: { used: false, runId: null, status: null, attemptedCount: 0, acceptedCount: 0, rejectedCount: 0 },
    documents: [],
  }
}

function liveBody(): LiveStatus {
  return {
    sources: [
      { id: 'kazhydromet-bulletins', name: 'Казгидромет: ежемесячные бюллетени', lastSuccessAt: null, cacheAvailable: false, status: 'never_run' },
      { id: 'gdelt', name: 'GDELT DOC 2.0', lastSuccessAt: null, cacheAvailable: false, status: 'never_run' },
      { id: 'direct-sources', name: 'Прямые публичные источники', lastSuccessAt: null, cacheAvailable: false, status: 'never_run' },
    ],
  }
}
