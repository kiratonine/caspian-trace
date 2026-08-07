import type { Server } from 'node:http'

import { NotFoundException, type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import {
  ApiErrorSchema,
  IncidentDetailSchema,
  IncidentSummaryListSchema,
} from '@caspian-trace/contracts'

import { AppModule } from '../../src/app.module'
import { configureApplication } from '../../src/config/application.setup'
import {
  mapIncidentDetail,
  mapIncidentSummary,
} from '../../src/incidents/incidents.mapper'
import { IncidentsService } from '../../src/incidents/incidents.service'
import { PrismaService } from '../../src/prisma/prisma.service'
import { makeDetailRow, makeSummaryRow } from './incidents-row.fixture'

describe('Incidents HTTP API (e2e)', () => {
  const list = jest.fn()
  const getDetail = jest.fn()
  let app: INestApplication
  let server: Server
  let swaggerPaths: Record<string, unknown>

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ checkReadiness: jest.fn() })
      .overrideProvider(IncidentsService)
      .useValue({ list, getDetail })
      .compile()
    app = module.createNestApplication({ bodyParser: false })
    swaggerPaths = configureApplication(app).paths
    await app.init()
    server = app.getHttpServer() as Server
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    list.mockReset().mockResolvedValue([mapIncidentSummary(makeSummaryRow())])
    getDetail.mockReset().mockResolvedValue(mapIncidentDetail(makeDetailRow()))
  })

  it('returns a contract-valid list and passes normalized filters', async () => {
    const response = await request(server)
      .get(
        '/api/incidents?status=L2&region=atyrau&from=2025-01-01&to=2025-12-31&limit=12',
      )
      .expect(200)

    expect(IncidentSummaryListSchema.parse(response.body)).toEqual(response.body)
    expect(list).toHaveBeenCalledWith({
      status: 'L2',
      region: 'atyrau',
      generatedFrom: new Date('2025-01-01T00:00:00.000Z'),
      generatedBefore: new Date('2026-01-01T00:00:00.000Z'),
      limit: 12,
    })
  })

  it.each([
    '?limit=0',
    '?limit=101',
    '?status=L4',
    '?region=unknown',
    '?from=2025-02-30',
    '?from=2025-09-02&to=2025-09-01',
    '?unknown=value',
  ])('normalizes invalid query %s', async (query) => {
    const response = await request(server)
      .get(`/api/incidents${query}`)
      .expect(400)
    expect(ApiErrorSchema.parse(response.body)).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      requestId: response.headers['x-request-id'],
    })
  })

  it('returns contract-valid detail with a request ID', async () => {
    const response = await request(server)
      .get('/api/incidents/test-part04-investigation-september')
      .set('x-request-id', 'test-part04-forwarded')
      .expect(200)
    expect(IncidentDetailSchema.parse(response.body)).toEqual(response.body)
    expect(response.headers['x-request-id']).toBe('test-part04-forwarded')
    expect(getDetail).toHaveBeenCalledWith(
      'test-part04-investigation-september',
    )
  })

  it('returns normalized 404 for an unknown current investigation', async () => {
    getDetail.mockRejectedValueOnce(
      new NotFoundException({
        code: 'INVESTIGATION_NOT_FOUND',
        message: 'Investigation not found',
      }),
    )
    const response = await request(server)
      .get('/api/incidents/test-part04-missing')
      .expect(404)
    expect(ApiErrorSchema.parse(response.body)).toEqual({
      code: 'INVESTIGATION_NOT_FOUND',
      message: 'Investigation not found',
      requestId: response.headers['x-request-id'],
    })
  })

  it('documents both incident endpoints in Swagger', () => {
    expect(swaggerPaths).toHaveProperty('/api/incidents')
    expect(swaggerPaths).toHaveProperty('/api/incidents/{id}')
  })
})
