import type { Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import {
  ApiErrorSchema,
  DossierSchema,
  EvidenceGraphSchema,
  IncidentSummaryListSchema,
  LiveStatusSchema,
  ReplayScenarioSchema,
} from '@caspian-trace/contracts'

import { AppModule } from '../src/app.module'
import { configureApplication } from '../src/config/application.setup'
import { IncidentsService } from '../src/incidents/incidents.service'
import { FileInvestigationRepository } from '../src/investigations/file-investigation.repository'
import {
  INVESTIGATION_INPUT_READER,
  INVESTIGATION_RESULT_WRITER,
} from '../src/investigations/investigation.ports'
import { InvestigationsService } from '../src/investigations/investigations.service'
import { LiveService } from '../src/live/live.service'

describe('investigation features (e2e)', () => {
  const ingestionToken = 'test-ingestion-token-at-least-32-characters'
  let app: INestApplication
  let httpServer: Server
  let fixtures: FileInvestigationRepository
  let currentInvestigationId: string

  beforeAll(async () => {
    fixtures = new FileInvestigationRepository()
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(INVESTIGATION_INPUT_READER)
      .useValue(fixtures)
      .overrideProvider(INVESTIGATION_RESULT_WRITER)
      .useValue(fixtures)
      .overrideProvider(IncidentsService)
      .useValue({ list: () => Promise.resolve([]) })
      .overrideProvider(LiveService)
      .useValue({
        getStatus: () => Promise.resolve({
          sources: [
            { id: 'kazhydromet-bulletins', name: 'Казгидромет', lastSuccessAt: null, cacheAvailable: false, status: 'never_run' },
            { id: 'gdelt', name: 'GDELT', lastSuccessAt: null, cacheAvailable: false, status: 'never_run' },
            { id: 'direct-sources', name: 'Прямые источники', lastSuccessAt: null, cacheAvailable: false, status: 'never_run' },
          ],
        }),
      })
      .compile()
    app = module.createNestApplication({ bodyParser: false })
    configureApplication(app)
    await app.init()
    httpServer = app.getHttpServer() as Server
    currentInvestigationId = (
      await app.get(InvestigationsService).recompute('inv-atyrau-2025-09')
    ).id
  })

  afterAll(async () => {
    await app.close()
  })

  it('serves evidence, stable replay and both dossier formats', async () => {
    const saveVersioned = jest.spyOn(fixtures, 'saveVersioned')
    const evidence = await request(httpServer)
      .get(`/api/investigations/${currentInvestigationId}/evidence`)
      .expect(200)
    EvidenceGraphSchema.parse(evidence.body)
    expect(evidence.body).toEqual(readSample('evidence-september.json'))

    const firstReplay = await request(httpServer)
      .post(`/api/replays/${currentInvestigationId}/start`)
      .expect(201)
    const secondReplay = await request(httpServer)
      .post(`/api/replays/${currentInvestigationId}/start`)
      .expect(201)
    expect(ReplayScenarioSchema.parse(secondReplay.body)).toEqual(
      ReplayScenarioSchema.parse(firstReplay.body),
    )
    expect(secondReplay.body).toEqual(readSample('replay-september.json'))

    const json = await request(httpServer)
      .get(`/api/investigations/${currentInvestigationId}/export?format=json`)
      .expect('content-type', /application\/json/)
      .expect(200)
    DossierSchema.parse(json.body)
    expect({ ...json.body, generatedAt: null }).toEqual(
      readSample('dossier-september.json'),
    )

    const html = await request(httpServer)
      .get(`/api/investigations/${currentInvestigationId}/export?format=html`)
      .expect('content-security-policy', /default-src 'none'/)
      .expect('x-content-type-options', 'nosniff')
      .expect('content-disposition', /attachment/)
      .expect('content-type', /text\/html/)
      .expect(200)
    expect(html.text).not.toContain('<script')
    expect(html.text.trim()).toBe(readSampleText('dossier-september.html').trim())
    expect(saveVersioned).not.toHaveBeenCalled()
    saveVersioned.mockRestore()
  })

  it('protects recompute with the ingestion token', async () => {
    const missing = await request(httpServer)
      .post(`/api/admin/investigations/${currentInvestigationId}/recompute`)
      .expect(401)
    expect(ApiErrorSchema.parse(missing.body)).toEqual({
      code: 'INGESTION_UNAUTHORIZED',
      message: 'Invalid ingestion credentials',
      requestId: missing.headers['x-request-id'],
    })
    const invalid = await request(httpServer)
      .post(`/api/admin/investigations/${currentInvestigationId}/recompute`)
      .set('x-ingestion-token', 'invalid')
      .expect(401)
    expect(ApiErrorSchema.parse(invalid.body).code).toBe('INGESTION_UNAUTHORIZED')
    const first = await request(httpServer)
      .post(`/api/admin/investigations/${currentInvestigationId}/recompute`)
      .set('x-ingestion-token', ingestionToken)
      .expect(201)
    const second = await request(httpServer)
      .post(`/api/admin/investigations/${currentInvestigationId}/recompute`)
      .set('x-ingestion-token', ingestionToken)
      .expect(201)
    expect(second.body).toEqual(first.body)
  })

  it('returns 404 for an unknown investigation', async () => {
    const response = await request(httpServer)
      .get('/api/investigations/unknown/evidence')
      .expect(404)
    expect(ApiErrorSchema.parse(response.body).requestId).toBe(response.headers['x-request-id'])
  })

  it('keeps platform health, incidents, live status and Swagger paths wired', async () => {
    await request(httpServer).get('/api/health/live').expect(200)
    const incidents = await request(httpServer).get('/api/incidents').expect(200)
    expect(IncidentSummaryListSchema.parse(incidents.body)).toEqual([])
    const live = await request(httpServer).get('/api/live/status').expect(200)
    LiveStatusSchema.parse(live.body)
    const swagger = await request(httpServer).get('/api/docs-json').expect(200)
    const document: unknown = swagger.body
    if (!isRecord(document) || !isRecord(document.paths)) {
      throw new Error('Swagger document has no paths object')
    }
    for (const path of [
      '/api/investigations/{id}/evidence',
      '/api/admin/investigations/{id}/recompute',
      '/api/replays/{id}/start',
      '/api/investigations/{id}/export',
    ]) {
      expect(document.paths).toHaveProperty(path)
    }
  })

  it('normalizes an invalid export format', async () => {
    const response = await request(httpServer)
      .get(`/api/investigations/${currentInvestigationId}/export?format=pdf`)
      .expect(400)
    expect(ApiErrorSchema.parse(response.body)).toEqual({
      code: 'EXPORT_FORMAT_INVALID',
      message: 'format must be json or html',
      requestId: response.headers['x-request-id'],
    })
  })
})

function readSample(filename: string): unknown {
  return JSON.parse(readSampleText(filename)) as unknown
}

function readSampleText(filename: string): string {
  return readFileSync(
    resolve(
      __dirname,
      '..',
      '..',
      '..',
      'data',
      'fixtures',
      'investigation',
      'api',
      filename,
    ),
    'utf8',
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
