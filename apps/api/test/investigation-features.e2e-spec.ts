import type { Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

describe('investigation features (e2e)', () => {
  let app: INestApplication
  let httpServer: Server

  beforeAll(async () => {
    process.env.INGESTION_TOKEN = 'test-ingestion-token-at-least-32-chars'
    const module = await Test.createTestingModule({
      imports: [AppModule],
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
    expect(evidence.body).toEqual(readSample('evidence-september.json'))

    const firstReplay = await request(httpServer)
      .post('/api/replays/inv-atyrau-2025-09/start')
      .expect(201)
    const secondReplay = await request(httpServer)
      .post('/api/replays/inv-atyrau-2025-09/start')
      .expect(201)
    expect(ReplayScenarioSchema.parse(secondReplay.body)).toEqual(
      ReplayScenarioSchema.parse(firstReplay.body),
    )
    expect(secondReplay.body).toEqual(readSample('replay-september.json'))

    const json = await request(httpServer)
      .get('/api/investigations/inv-atyrau-2025-09/export?format=json')
      .expect('content-type', /application\/json/)
      .expect(200)
    DossierSchema.parse(json.body)
    expect({ ...json.body, generatedAt: null }).toEqual(
      readSample('dossier-september.json'),
    )

    const html = await request(httpServer)
      .get('/api/investigations/inv-atyrau-2025-09/export?format=html')
      .expect('content-security-policy', /default-src 'none'/)
      .expect('content-type', /text\/html/)
      .expect(200)
    expect(html.text).not.toContain('<script')
    expect(html.text.trim()).toBe(readSampleText('dossier-september.html').trim())
  })

  it('protects recompute with the ingestion token', async () => {
    await request(httpServer)
      .post('/api/admin/investigations/inv-atyrau-2025-09/recompute')
      .expect(401)
    await request(httpServer)
      .post('/api/admin/investigations/inv-atyrau-2025-09/recompute')
      .set('x-ingestion-token', 'test-ingestion-token-at-least-32-chars')
      .expect(201)
  })

  it('returns 404 for an unknown investigation', async () => {
    await request(httpServer)
      .get('/api/investigations/unknown/evidence')
      .expect(404)
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
