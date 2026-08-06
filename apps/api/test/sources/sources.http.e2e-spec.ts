import type { Server } from 'node:http'

import {
  BadRequestException,
  NotFoundException,
  type INestApplication,
} from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { ApiErrorSchema } from '@caspian-trace/contracts'

import { AppModule } from '../../src/app.module'
import { configureApplication } from '../../src/config/application.setup'
import { PrismaService } from '../../src/prisma/prisma.service'
import { SourcesService } from '../../src/sources/sources.service'

describe('Sources HTTP API (e2e)', () => {
  const openSource = jest.fn()
  let app: INestApplication
  let server: Server
  let swaggerPaths: Record<string, unknown>

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ checkReadiness: jest.fn() })
      .overrideProvider(SourcesService)
      .useValue({ openSource })
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
    openSource.mockReset().mockResolvedValue({
      location:
        'https://project.supabase.co/storage/v1/object/sign/source?token=test',
    })
  })

  it('redirects a cached source with private no-store headers', async () => {
    const response = await request(server)
      .get('/api/source-documents/test-part05-document/open')
      .expect(302)
    expect(response.headers.location).toContain('/storage/v1/object/sign/source')
    expect(response.headers['cache-control']).toBe('private, no-store')
    expect(response.headers['referrer-policy']).toBe('no-referrer')
    expect(response.headers['x-request-id']).toEqual(expect.any(String))
    expect(openSource).toHaveBeenCalledWith('test-part05-document', undefined)
  })

  it('preserves the PDF page fragment only in Location', async () => {
    openSource.mockResolvedValueOnce({
      location:
        'https://project.supabase.co/storage/v1/object/sign/source?token=test#page=22',
    })
    const response = await request(server)
      .get('/api/source-documents/test-part05-document/open?page=22')
      .expect(302)
    expect(response.headers.location?.endsWith('#page=22')).toBe(true)
    expect(openSource).toHaveBeenCalledWith('test-part05-document', 22)
  })

  it.each([
    [
      'missing document',
      new NotFoundException({
        code: 'SOURCE_DOCUMENT_NOT_FOUND',
        message: 'Source document not found',
      }),
      'SOURCE_DOCUMENT_NOT_FOUND',
    ],
    [
      'missing snapshot',
      new NotFoundException({
        code: 'SOURCE_SNAPSHOT_NOT_AVAILABLE',
        message: 'Source snapshot is not available',
      }),
      'SOURCE_SNAPSHOT_NOT_AVAILABLE',
    ],
    [
      'page on non-PDF',
      new BadRequestException({
        code: 'SOURCE_PAGE_NOT_SUPPORTED',
        message: 'Page is supported only for PDF snapshots',
      }),
      'SOURCE_PAGE_NOT_SUPPORTED',
    ],
  ])('normalizes %s', async (_label, error, code) => {
    openSource.mockRejectedValueOnce(error)
    const response = await request(server)
      .get('/api/source-documents/test-part05-document/open?page=1')
      .expect(error.getStatus())
    expect(ApiErrorSchema.parse(response.body)).toMatchObject({
      code,
      requestId: response.headers['x-request-id'],
    })
  })

  it.each(['0', '-1', '1.5', 'abc'])('rejects invalid page %s', async (page) => {
    const response = await request(server)
      .get(`/api/source-documents/test-part05-document/open?page=${page}`)
      .expect(400)
    expect(ApiErrorSchema.parse(response.body).code).toBe('VALIDATION_ERROR')
    expect(openSource).not.toHaveBeenCalled()
  })

  it('documents the source open endpoint in Swagger', () => {
    expect(swaggerPaths).toHaveProperty('/api/source-documents/{id}/open')
  })
})
