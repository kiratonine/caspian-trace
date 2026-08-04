import type { Server } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import {
  DossierSchema,
  EvidenceGraphSchema,
  ReplayScenarioSchema,
} from '@caspian-trace/contracts'

import { AppModule } from '../src/app.module'
import { configureApplication } from '../src/config/application.setup'
import { ExportModule } from '../src/export/export.module'
import { InvestigationsModule } from '../src/investigations/investigations.module'
import { ReplaysModule } from '../src/replays/replays.module'

describe('investigation features (e2e)', () => {
  let app: INestApplication
  let httpServer: Server

  beforeAll(async () => {
    process.env.INGESTION_TOKEN = 'test-ingestion-token'
    const module = await Test.createTestingModule({
      imports: [AppModule, InvestigationsModule, ReplaysModule, ExportModule],
    }).compile()
    app = module.createNestApplication({ bodyParser: false })
    configureApplication(app)
    await app.init()
    httpServer = app.getHttpServer() as Server
  })

  afterAll(async () => {
    await app.close()
    delete process.env.INGESTION_TOKEN
  })

  it('serves evidence, stable replay and both dossier formats', async () => {
    const evidence = await request(httpServer)
      .get('/api/investigations/inv-atyrau-2025-09/evidence')
      .expect(200)
    EvidenceGraphSchema.parse(evidence.body)

    const firstReplay = await request(httpServer)
      .post('/api/replays/inv-atyrau-2025-09/start')
      .expect(201)
    const secondReplay = await request(httpServer)
      .post('/api/replays/inv-atyrau-2025-09/start')
      .expect(201)
    expect(ReplayScenarioSchema.parse(secondReplay.body)).toEqual(
      ReplayScenarioSchema.parse(firstReplay.body),
    )

    const json = await request(httpServer)
      .get('/api/investigations/inv-atyrau-2025-09/export?format=json')
      .expect('content-type', /application\/json/)
      .expect(200)
    DossierSchema.parse(json.body)

    const html = await request(httpServer)
      .get('/api/investigations/inv-atyrau-2025-09/export?format=html')
      .expect('content-security-policy', /default-src 'none'/)
      .expect('content-type', /text\/html/)
      .expect(200)
    expect(html.text).not.toContain('<script')
  })

  it('protects recompute with the ingestion token', async () => {
    await request(httpServer)
      .post('/api/admin/investigations/inv-atyrau-2025-09/recompute')
      .expect(401)
    await request(httpServer)
      .post('/api/admin/investigations/inv-atyrau-2025-09/recompute')
      .set('x-ingestion-token', 'test-ingestion-token')
      .expect(201)
  })

  it('returns 404 for an unknown investigation', async () => {
    await request(httpServer)
      .get('/api/investigations/unknown/evidence')
      .expect(404)
  })
})
