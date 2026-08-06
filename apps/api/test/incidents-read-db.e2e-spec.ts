import type { Server } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import {
  ApiErrorSchema,
  IncidentDetailSchema,
  IncidentSummaryListSchema,
} from '@caspian-trace/contracts'

import { AppModule } from '../src/app.module'
import { configureApplication } from '../src/config/application.setup'
import {
  CandidateDisposition,
  CorridorKind,
  EvidenceGeneratedBy,
  EvidenceKind,
  EvidenceLevel,
  ExtractionMode,
  Region,
  SourceDocumentStatus,
  VerificationStatus,
} from '../src/generated/prisma/enums'
import { PrismaService } from '../src/prisma/prisma.service'

const databaseUrl = process.env.DATABASE_E2E_URL
const directUrl = process.env.DIRECT_E2E_URL

if (process.env.PRISMA_E2E_DATABASE_REQUIRED !== 'true') {
  throw new Error('PRISMA_E2E_DATABASE_REQUIRED=true is required for DB e2e')
}
if (process.env.PRISMA_E2E_DATABASE_DISPOSABLE !== 'true') {
  throw new Error('PRISMA_E2E_DATABASE_DISPOSABLE=true is required for DB e2e')
}
if (!databaseUrl || !directUrl) {
  throw new Error('DATABASE_E2E_URL and DIRECT_E2E_URL are required for DB e2e')
}
assertNotSupabase(databaseUrl)
assertNotSupabase(directUrl)
process.env.DATABASE_URL = databaseUrl

describe('Incidents read API (disposable PostgreSQL e2e)', () => {
  const prefix = `test-part04-${process.pid}-${Date.now()}-`
  const ids = {
    incidentSeptember: `${prefix}incident-september`,
    incidentMay: `${prefix}incident-may`,
    incidentAktau: `${prefix}incident-aktau`,
    currentSeptember: `${prefix}investigation-september-current`,
    historicalSeptember: `${prefix}investigation-september-history`,
    currentMay: `${prefix}investigation-may-current`,
    currentAktau: `${prefix}investigation-aktau-current`,
    septemberMeasurementA: `${prefix}measurement-september-a`,
    septemberMeasurementB: `${prefix}measurement-september-b`,
    mayMeasurementA: `${prefix}measurement-may-a`,
    mayMeasurementB: `${prefix}measurement-may-b`,
    septemberSource: `${prefix}source-september`,
    maySource: `${prefix}source-may`,
    signalSource: `${prefix}source-signal`,
    septemberStationA: `${prefix}station-september-a`,
    septemberStationB: `${prefix}station-september-b`,
    mayStationA: `${prefix}station-may-a`,
    mayStationB: `${prefix}station-may-b`,
    aktauStation: `${prefix}station-aktau`,
    candidate: `${prefix}candidate`,
  }
  let app: INestApplication
  let prisma: PrismaService
  let server: Server

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication({ bodyParser: false })
    configureApplication(app)
    await app.init()
    prisma = app.get(PrismaService)
    server = app.getHttpServer() as Server
    await createFixture(prisma, prefix, ids)
  })

  afterAll(async () => {
    if (prisma) await cleanupFixture(prisma, prefix)
    if (app) await app.close()
  })

  it('lists only current investigation IDs in stable order', async () => {
    const response = await request(server).get('/api/incidents').expect(200)
    const body = IncidentSummaryListSchema.parse(response.body)
    expect(body.map(({ id }) => id)).toEqual([
      ids.currentSeptember,
      ids.currentMay,
      ids.currentAktau,
    ])
    expect(body.map(({ id }) => id)).not.toContain(ids.historicalSeptember)
  })

  it('applies status, region, inclusive date and limit filters', async () => {
    const status = IncidentSummaryListSchema.parse(
      (await request(server).get('/api/incidents?status=L3').expect(200)).body,
    )
    const region = IncidentSummaryListSchema.parse(
      (await request(server).get('/api/incidents?region=mangystau').expect(200))
        .body,
    )
    const date = IncidentSummaryListSchema.parse(
      (
        await request(server)
          .get('/api/incidents?from=2026-02-02&to=2026-02-02')
          .expect(200)
      ).body,
    )
    const limit = IncidentSummaryListSchema.parse(
      (await request(server).get('/api/incidents?limit=1').expect(200)).body,
    )
    expect(status.map(({ id }) => id)).toEqual([ids.currentMay])
    expect(region.map(({ id }) => id)).toEqual([ids.currentAktau])
    expect(date.map(({ id }) => id)).toEqual([ids.currentMay])
    expect(limit.map(({ id }) => id)).toEqual([ids.currentSeptember])
  })

  it('isolates September from May through InvestigationMeasurement links', async () => {
    const list = IncidentSummaryListSchema.parse(
      (await request(server).get('/api/incidents').expect(200)).body,
    )
    expect(list.find(({ id }) => id === ids.currentSeptember)?.period).toBe(
      '2025-09',
    )
    expect(list.find(({ id }) => id === ids.currentMay)?.period).toBe('2025-05')

    const detail = IncidentDetailSchema.parse(
      (
        await request(server)
          .get(`/api/incidents/${ids.currentSeptember}`)
          .expect(200)
      ).body,
    )
    expect(detail.measurements.map(({ id }) => id).sort()).toEqual(
      [ids.septemberMeasurementA, ids.septemberMeasurementB].sort(),
    )
    expect(detail.measurements.every(({ sampledPeriod }) => sampledPeriod === '2025-09')).toBe(
      true,
    )
  })

  it('maps Decimal/raw text/page and deduplicates detail provenance', async () => {
    const detail = IncidentDetailSchema.parse(
      (
        await request(server)
          .get(`/api/incidents/${ids.currentSeptember}`)
          .expect(200)
      ).body,
    )
    expect(detail.measurements[0]).toMatchObject({
      value: 0.234,
      rawValueText: '0,234',
      sourcePage: 22,
    })
    expect(detail.sourceDocuments.map(({ id }) => id)).toEqual([
      ids.septemberSource,
      ids.signalSource,
    ])
    expect(detail.candidateObjects[0]?.evidenceDocumentIds).toEqual([
      ids.septemberSource,
    ])
  })

  it('returns normalized 404 for unknown and historical investigation IDs', async () => {
    for (const id of [`${prefix}missing`, ids.historicalSeptember]) {
      const response = await request(server)
        .get(`/api/incidents/${id}`)
        .expect(404)
      expect(ApiErrorSchema.parse(response.body)).toEqual({
        code: 'INVESTIGATION_NOT_FOUND',
        message: 'Investigation not found',
        requestId: response.headers['x-request-id'],
      })
    }
  })

  it('maps a stored L0 investigation with a null corridor', async () => {
    const detail = IncidentDetailSchema.parse(
      (
        await request(server)
          .get(`/api/incidents/${ids.currentAktau}`)
          .expect(200)
      ).body,
    )
    expect(detail.investigation.evidenceLevel).toBe('L0')
    expect(detail.corridorBounds).toBeNull()
    expect(detail.measurements).toEqual([])
  })

  it('maps the stored open-upstream corridor without constructing geometry', async () => {
    const detail = IncidentDetailSchema.parse(
      (
        await request(server)
          .get(`/api/incidents/${ids.currentSeptember}`)
          .expect(200)
      ).body,
    )
    expect(detail.corridorBounds).toEqual({
      upstreamStationId: null,
      downstreamStationId: ids.septemberStationB,
    })
    expect(detail.investigation.corridor).toBeNull()
  })

  it('uses one bounded Prisma detail call instead of repository N+1 calls', async () => {
    const findFirst = jest.spyOn(prisma.investigation, 'findFirst')
    await request(server)
      .get(`/api/incidents/${ids.currentSeptember}`)
      .expect(200)
    expect(findFirst).toHaveBeenCalledTimes(1)
    findFirst.mockRestore()
  })
})

type FixtureIds = {
  incidentSeptember: string
  incidentMay: string
  incidentAktau: string
  currentSeptember: string
  historicalSeptember: string
  currentMay: string
  currentAktau: string
  septemberMeasurementA: string
  septemberMeasurementB: string
  mayMeasurementA: string
  mayMeasurementB: string
  septemberSource: string
  maySource: string
  signalSource: string
  septemberStationA: string
  septemberStationB: string
  mayStationA: string
  mayStationB: string
  aktauStation: string
  candidate: string
}

async function createFixture(
  prisma: PrismaService,
  prefix: string,
  ids: FixtureIds,
): Promise<void> {
  const sourceData = [
    [ids.septemberSource, 'application/pdf', 'a'],
    [ids.maySource, 'application/pdf', 'b'],
    [ids.signalSource, 'text/html', 'c'],
  ] as const
  for (const [id, mediaType, hashCharacter] of sourceData) {
    await prisma.sourceDocument.create({
      data: {
        id,
        originalUrl: `https://example.com/${id}`,
        canonicalUrl: `https://example.com/${id}`,
        publisher: 'Part 04 DB test',
        title: `Part 04 source ${id}`,
        sourceType: 'test',
        mediaType,
        fetchedAt: new Date('2026-01-01T00:00:00.000Z'),
        sha256: hashCharacter.repeat(64),
        status: SourceDocumentStatus.VERIFIED,
      },
    })
  }
  await prisma.sourcePage.createMany({
    data: [
      {
        id: `${prefix}page-september-22`,
        sourceDocumentId: ids.septemberSource,
        pageNumber: 22,
        extractedText: 'Test September page',
        textSha256: 'd'.repeat(64),
      },
      {
        id: `${prefix}page-may-24`,
        sourceDocumentId: ids.maySource,
        pageNumber: 24,
        extractedText: 'Test May page',
        textSha256: 'e'.repeat(64),
      },
    ],
  })
  await prisma.station.createMany({
    data: [
      station(ids.septemberStationA, 'September A', 1),
      station(ids.septemberStationB, 'September B', 2),
      station(ids.mayStationA, 'May A', 1),
      station(ids.mayStationB, 'May B', 2),
      station(ids.aktauStation, 'Aktau station', null, Region.MANGYSTAU),
    ],
  })
  await prisma.measurement.createMany({
    data: [
      measurement({
        id: ids.septemberMeasurementA,
        stationId: ids.septemberStationA,
        sourceDocumentId: ids.septemberSource,
        sourcePageId: `${prefix}page-september-22`,
        period: '2025-09',
        value: '0.234',
        raw: '0,234',
      }),
      measurement({
        id: ids.septemberMeasurementB,
        stationId: ids.septemberStationB,
        sourceDocumentId: ids.septemberSource,
        sourcePageId: `${prefix}page-september-22`,
        period: '2025-09',
        value: '0.058',
        raw: '0,058',
      }),
      measurement({
        id: ids.mayMeasurementA,
        stationId: ids.mayStationA,
        sourceDocumentId: ids.maySource,
        sourcePageId: `${prefix}page-may-24`,
        period: '2025-05',
        value: '0.114',
        raw: '0,114',
      }),
      measurement({
        id: ids.mayMeasurementB,
        stationId: ids.mayStationB,
        sourceDocumentId: ids.maySource,
        sourcePageId: `${prefix}page-may-24`,
        period: '2025-05',
        value: '0.193',
        raw: '0,193',
      }),
    ],
  })
  await prisma.incident.createMany({
    data: [
      {
        id: ids.incidentSeptember,
        title: 'Part 04 September incident',
        region: Region.ATYRAU,
        indicator: 'нефтепродукты',
      },
      {
        id: ids.incidentMay,
        title: 'Part 04 May incident',
        region: Region.ATYRAU,
        indicator: 'нефтепродукты',
      },
      {
        id: ids.incidentAktau,
        title: 'Part 04 Aktau insufficient-data incident',
        region: Region.MANGYSTAU,
        indicator: null,
      },
    ],
  })
  await prisma.incidentSignal.create({
    data: {
      id: `${prefix}signal-september`,
      title: 'Part 04 September signal',
      observedPeriod: '2025-09',
      reportedAt: new Date('2025-09-10T00:00:00.000Z'),
      locationText: 'Жайык test location',
      phenomenon: 'color_change',
      excerpt: 'Part 04 test-only signal excerpt',
      sourceDocumentId: ids.signalSource,
      extractionMode: ExtractionMode.RULE,
      verificationStatus: VerificationStatus.CORROBORATED,
      dedupKey: `${prefix}signal-dedup`,
    },
  })
  await prisma.incidentSignalLink.create({
    data: {
      incidentId: ids.incidentSeptember,
      signalId: `${prefix}signal-september`,
    },
  })
  await prisma.candidateObject.create({
    data: {
      id: ids.candidate,
      name: 'Part 04 object for checking',
      objectType: 'test outlet',
      basisText: 'Part 04 source-backed test object',
      verificationStatus: VerificationStatus.OFFICIAL,
      metadata: { waterBody: 'Жайык', riverOrder: 2 },
      sources: { create: { sourceDocumentId: ids.septemberSource } },
    },
  })
  await prisma.investigation.createMany({
    data: [
      {
        id: ids.historicalSeptember,
        incidentId: ids.incidentSeptember,
        evidenceLevel: EvidenceLevel.L1,
        conclusion: 'Part 04 historical stored conclusion.',
        generatedAt: new Date('2026-01-01T00:00:00.000Z'),
        isCurrent: false,
      },
      {
        id: ids.currentSeptember,
        incidentId: ids.incidentSeptember,
        evidenceLevel: EvidenceLevel.L2,
        conclusion: 'Part 04 stored September conclusion; source not established.',
        corridorKind: CorridorKind.OPEN_UPSTREAM,
        downstreamStationId: ids.septemberStationB,
        generatedAt: new Date('2026-02-03T12:00:00.000Z'),
        isCurrent: true,
      },
      {
        id: ids.currentMay,
        incidentId: ids.incidentMay,
        evidenceLevel: EvidenceLevel.L3,
        conclusion: 'Part 04 stored May conclusion; cause not established.',
        corridorKind: CorridorKind.BETWEEN_STATIONS,
        upstreamStationId: ids.mayStationA,
        downstreamStationId: ids.mayStationB,
        generatedAt: new Date('2026-02-02T12:00:00.000Z'),
        isCurrent: true,
      },
      {
        id: ids.currentAktau,
        incidentId: ids.incidentAktau,
        evidenceLevel: EvidenceLevel.L0,
        conclusion: 'Недостаточно данных.',
        generatedAt: new Date('2026-02-01T12:00:00.000Z'),
        isCurrent: true,
      },
    ],
  })
  await prisma.investigationMeasurement.createMany({
    data: [
      { investigationId: ids.currentSeptember, measurementId: ids.septemberMeasurementA },
      { investigationId: ids.currentSeptember, measurementId: ids.septemberMeasurementB },
      { investigationId: ids.currentMay, measurementId: ids.mayMeasurementA },
      { investigationId: ids.currentMay, measurementId: ids.mayMeasurementB },
      { investigationId: ids.historicalSeptember, measurementId: ids.mayMeasurementA },
    ],
  })
  await prisma.investigationCandidateObject.create({
    data: {
      investigationId: ids.currentSeptember,
      candidateObjectId: ids.candidate,
      disposition: CandidateDisposition.FOR_CHECK,
    },
  })
  await prisma.evidenceStatement.create({
    data: {
      id: `${prefix}statement-supports`,
      investigationId: ids.currentSeptember,
      kind: EvidenceKind.SUPPORTS,
      code: 'TEST_PART04_SUPPORTS',
      text: 'Part 04 stored supported fact.',
      generatedBy: EvidenceGeneratedBy.RULE_ENGINE,
      sortOrder: 0,
      measurements: { create: { measurementId: ids.septemberMeasurementA } },
      sources: { create: { sourceDocumentId: ids.septemberSource } },
    },
  })
  await prisma.investigationUnknown.create({
    data: {
      id: `${prefix}unknown`,
      investigationId: ids.currentSeptember,
      code: 'TEST_PART04_UNKNOWN',
      text: 'Part 04 stored unknown.',
      sortOrder: 0,
    },
  })
}

function station(
  id: string,
  name: string,
  riverOrder: number | null,
  region: Region = Region.ATYRAU,
): {
  id: string
  name: string
  waterBody: string
  region: Region
  riverOrder: number | null
} {
  return { id, name, waterBody: 'test water body', region, riverOrder }
}

function measurement(input: {
  id: string
  stationId: string
  sourceDocumentId: string
  sourcePageId: string
  period: string
  value: string
  raw: string
}): {
  id: string
  stationId: string
  sourceDocumentId: string
  sourcePageId: string
  indicator: string
  value: string
  rawValueText: string
  unit: string
  matrix: string
  sampledPeriod: string
  sourceExcerpt: string
  extractionMode: ExtractionMode
  verificationStatus: VerificationStatus
  metadata: { sourcePage: number }
} {
  return {
    id: input.id,
    stationId: input.stationId,
    sourceDocumentId: input.sourceDocumentId,
    sourcePageId: input.sourcePageId,
    indicator: 'нефтепродукты',
    value: input.value,
    rawValueText: input.raw,
    unit: 'mg/dm3',
    matrix: 'water',
    sampledPeriod: input.period,
    sourceExcerpt: `Part 04 test-only excerpt ${input.raw}`,
    extractionMode: ExtractionMode.RULE,
    verificationStatus: VerificationStatus.OFFICIAL,
    metadata: { sourcePage: Number(input.sourcePageId.endsWith('22') ? 22 : 24) },
  }
}

async function cleanupFixture(prisma: PrismaService, prefix: string): Promise<void> {
  await prisma.incident.deleteMany({ where: { id: { startsWith: prefix } } })
  await prisma.incidentSignal.deleteMany({ where: { id: { startsWith: prefix } } })
  await prisma.candidateObject.deleteMany({ where: { id: { startsWith: prefix } } })
  await prisma.measurement.deleteMany({ where: { id: { startsWith: prefix } } })
  await prisma.sourcePage.deleteMany({ where: { id: { startsWith: prefix } } })
  await prisma.station.deleteMany({ where: { id: { startsWith: prefix } } })
  await prisma.sourceDocument.deleteMany({ where: { id: { startsWith: prefix } } })
}

function assertNotSupabase(value: string): void {
  const hostname = new URL(value).hostname.toLowerCase()
  if (
    hostname === 'supabase.co' ||
    hostname === 'pooler.supabase.com' ||
    hostname.endsWith('.supabase.co') ||
    hostname.endsWith('.pooler.supabase.com')
  ) {
    throw new Error('Supabase targets are forbidden for incidents DB e2e')
  }
}
