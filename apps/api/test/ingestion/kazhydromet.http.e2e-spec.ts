import type { Server } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request, { type Test as SuperTestRequest } from 'supertest'

import { ApiErrorSchema } from '@caspian-trace/contracts'

import { AppModule } from '../../src/app.module'
import { configureApplication } from '../../src/config/application.setup'
import { KazhydrometIngestionService } from '../../src/ingestion/kazhydromet/kazhydromet-ingestion.service'
import { PrismaService } from '../../src/prisma/prisma.service'

describe('Kazhydromet admin ingestion HTTP API (e2e)', () => {
  const run = jest.fn()
  let app: INestApplication
  let server: Server
  let swagger: ReturnType<typeof configureApplication>

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ checkReadiness: jest.fn() })
      .overrideProvider(KazhydrometIngestionService)
      .useValue({ run })
      .compile()
    app = module.createNestApplication({ bodyParser: false })
    swagger = configureApplication(app)
    await app.init()
    server = app.getHttpServer() as Server
  })

  afterAll(async () => app.close())

  beforeEach(() => {
    run.mockReset().mockResolvedValue({
      runId: '11111111-1111-4111-8111-111111111111', status: 'succeeded',
      discoveredCount: 1, fetchedCount: 1, cachedCount: 1, pageCount: 1,
      validatedCandidateCount: 1, rejectedCandidateCount: 0,
      documents: [{
        sourceDocumentId: 'doc-kazhydromet-2025-09', period: '2025-09', regions: ['atyrau'],
        sha256: 'a'.repeat(64), cachePath: 'kazhydromet_bulletin/2025/09/a.pdf', pageCount: 1,
        relevantPageNumbers: [1], validatedCandidateCount: 1, parserStatus: 'succeeded',
      }],
    })
  })

  it.each([
    ['missing', undefined],
    ['invalid', 'wrong-token'],
  ])('rejects %s credentials without leaking token', async (_label, token) => {
    let pending = request(server).post('/api/admin/ingestion/kazhydromet').send(validBody())
    if (token) pending = pending.set('X-Ingestion-Token', token)
    const response = await pending.expect(401)
    expect(ApiErrorSchema.parse(response.body)).toEqual({
      code: 'INGESTION_UNAUTHORIZED', message: 'Invalid ingestion credentials',
      requestId: response.headers['x-request-id'],
    })
    expect(JSON.stringify(response.body)).not.toContain(token ?? process.env.INGESTION_TOKEN)
    expect(run).not.toHaveBeenCalled()
  })

  it('accepts the configured token and returns counts with request ID', async () => {
    const response = await authorized(validBody()).expect(200)
    expect(response.body).toMatchObject({
      runId: '11111111-1111-4111-8111-111111111111', status: 'succeeded', discoveredCount: 1,
      fetchedCount: 1, cachedCount: 1, pageCount: 1,
    })
    expect(response.headers['x-request-id']).toEqual(expect.any(String))
    expect(run).toHaveBeenCalledWith(validBody())
  })

  it.each([
    ['invalid month', { ...validBody(), from: '2025-13' }],
    ['invalid region', { ...validBody(), regions: ['evil'] }],
    ['duplicate region', { ...validBody(), regions: ['atyrau', 'atyrau'] }],
    ['unknown field', { ...validBody(), unexpected: true }],
  ])('rejects DTO %s', async (_label, body) => {
    const response = await authorized(body).expect(400)
    expect(ApiErrorSchema.parse(response.body).code).toBe('VALIDATION_ERROR')
    expect(run).not.toHaveBeenCalled()
  })

  it.each([
    ['reverse range', { ...validBody(), from: '2025-10', to: '2025-09' }],
    ['over 24 months', { ...validBody(), from: '2023-09', to: '2025-09' }],
    ['over configured maximum', { ...validBody(), maxDocuments: 4 }],
  ])('normalizes service-level %s', async (_label, body) => {
    run.mockImplementationOnce(async () => {
      const { BadRequestException } = await import('@nestjs/common')
      throw new BadRequestException({
        code: 'KAZHYDROMET_REQUEST_INVALID', message: 'Kazhydromet ingestion request is invalid',
      })
    })
    const response = await authorized(body).expect(400)
    expect(ApiErrorSchema.parse(response.body).code).toBe('KAZHYDROMET_REQUEST_INVALID')
  })

  it('documents the admin endpoint, required header, and body', () => {
    const operation = swagger.paths['/api/admin/ingestion/kazhydromet']?.post
    expect(operation).toBeDefined()
    expect(operation?.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'X-Ingestion-Token', required: true }),
    ]))
    expect(operation?.requestBody).toBeDefined()
  })

  function authorized(body: object): SuperTestRequest {
    return request(server)
      .post('/api/admin/ingestion/kazhydromet')
      .set('X-Ingestion-Token', process.env.INGESTION_TOKEN!)
      .send(body)
  }
})

function validBody(): { from: string; to: string; regions: string[]; maxDocuments: number } {
  return { from: '2025-09', to: '2025-09', regions: ['atyrau'], maxDocuments: 1 }
}
