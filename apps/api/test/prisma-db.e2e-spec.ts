import type { Server } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { HealthReadySchema } from '@caspian-trace/contracts'
import type {
  InvestigationInput,
  InvestigationResult,
} from '@caspian-trace/investigation-core'

import { AppModule } from '../src/app.module'
import { configureApplication } from '../src/config/application.setup'
import {
  ExtractionMode,
  Region,
  VerificationStatus,
} from '../src/generated/prisma/enums'
import { PrismaService } from '../src/prisma/prisma.service'
import { PrismaInvestigationRepository } from '../src/investigations/prisma-investigation.repository'

const databaseUrl = process.env.DATABASE_E2E_URL
const directUrl = process.env.DIRECT_E2E_URL

if (process.env.PRISMA_E2E_DATABASE_REQUIRED !== 'true') {
  throw new Error('PRISMA_E2E_DATABASE_REQUIRED=true is required for DB e2e')
}
if (!databaseUrl || !directUrl) {
  throw new Error('DATABASE_E2E_URL and DIRECT_E2E_URL are required for DB e2e')
}

process.env.DATABASE_URL = databaseUrl

describe('Prisma PostgreSQL foundation (DB e2e)', () => {
  const prefix = `part02-${process.pid}-${Date.now()}`
  let app: INestApplication
  let prisma: PrismaService
  let investigationRepository: PrismaInvestigationRepository
  let httpServer: Server

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication({ bodyParser: false })
    configureApplication(app)
    await app.init()
    prisma = app.get(PrismaService)
    investigationRepository = app.get(PrismaInvestigationRepository)
    httpServer = app.getHttpServer() as Server
  })

  afterAll(async () => {
    await prisma.incident.deleteMany({ where: { id: { startsWith: prefix } } })
    await prisma.candidateObjectSource.deleteMany({
      where: { candidateObjectId: { startsWith: prefix } },
    })
    await prisma.candidateObject.deleteMany({
      where: { id: { startsWith: prefix } },
    })
    await prisma.incidentSignal.deleteMany({
      where: { id: { startsWith: prefix } },
    })
    await prisma.measurement.deleteMany({
      where: { id: { startsWith: prefix } },
    })
    await prisma.sourcePage.deleteMany({
      where: { id: { startsWith: prefix } },
    })
    await prisma.station.deleteMany({ where: { id: { startsWith: prefix } } })
    await prisma.sourceDocument.deleteMany({
      where: { id: { startsWith: prefix } },
    })
    await app.close()
  })

  async function createSource(id: string): Promise<void> {
    await prisma.sourceDocument.create({
      data: {
        id,
        originalUrl: `https://example.com/${id}`,
        canonicalUrl: `https://example.com/${id}`,
        publisher: 'Part 02 DB test',
        title: 'Disposable PostgreSQL evidence',
        sourceType: 'test',
        mediaType: 'application/pdf',
      },
    })
  }

  async function createStation(id: string): Promise<void> {
    await prisma.station.create({
      data: {
        id,
        name: 'Disposable station',
        waterBody: 'Жайык',
        region: Region.ATYRAU,
      },
    })
  }

  it('serves real readiness through PostgreSQL', async () => {
    const response = await request(httpServer).get('/api/health/ready').expect(200)
    expect(HealthReadySchema.parse(response.body)).toEqual({
      status: 'ok',
      service: 'caspian-trace-api',
      database: 'ready',
    })
  })

  it('stores investigation versions atomically and idempotently', async () => {
    const input = createInvestigationInput(prefix)
    const firstResult = createInvestigationResult(prefix, 'a'.repeat(64))
    const [first, duplicate] = await Promise.all([
      investigationRepository.saveVersioned(
        input.incident.id,
        input,
        firstResult,
      ),
      investigationRepository.saveVersioned(
        input.incident.id,
        input,
        firstResult,
      ),
    ])
    expect(duplicate.id).toBe(first.id)

    const secondResult = createInvestigationResult(prefix, 'b'.repeat(64))
    const second = await investigationRepository.saveVersioned(
      input.incident.id,
      input,
      secondResult,
    )
    expect(second.id).not.toBe(first.id)
    await expect(
      investigationRepository.findCurrent(input.incident.id),
    ).resolves.toEqual(second)
    await expect(
      prisma.investigation.count({ where: { incidentId: input.incident.id } }),
    ).resolves.toBe(2)
    await expect(
      prisma.investigationCandidateObjectEvidence.count({
        where: { investigationId: second.id },
      }),
    ).resolves.toBe(1)
    const loaded = await investigationRepository.loadInput(input.incident.id)
    expect(loaded?.stations.map(({ id }) => id)).toEqual(
      input.stations.map(({ id }) => id),
    )
    expect(loaded?.measurements.map(({ id }) => id)).toEqual(
      input.measurements.map(({ id }) => id),
    )
    expect(loaded?.candidateObjects.map(({ id }) => id)).toEqual(
      input.candidateObjects.map(({ id }) => id),
    )

    const invalidResult: InvestigationResult = {
      ...secondResult,
      inputHash: 'c'.repeat(64),
      supportedFacts: [
        {
          id: `${prefix}-invalid-evidence`,
          code: 'NO_LOCAL_INCREASE_IN_PAIR',
          kind: 'supports',
          text: 'Rollback probe',
          measurementIds: [`${prefix}-missing-measurement`],
          sourceDocumentIds: [`${prefix}-source`],
          generatedBy: 'rule_engine',
          sortOrder: 0,
        },
      ],
    }
    await expect(
      investigationRepository.saveVersioned(
        input.incident.id,
        input,
        invalidResult,
      ),
    ).rejects.toThrow()
    await expect(
      investigationRepository.findCurrent(input.incident.id),
    ).resolves.toEqual(second)
  })

  it('enables RLS on every application table without public policies', async () => {
    const rls = await prisma.$queryRaw<
      Array<{ enabled_count: bigint; table_count: bigint }>
    >`SELECT
        count(*) FILTER (WHERE c.relrowsecurity) AS enabled_count,
        count(*) AS table_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname IN (
          'source_documents', 'source_pages', 'stations', 'station_relations',
          'measurements', 'incident_signals', 'incidents', 'incident_signal_links',
          'candidate_objects', 'candidate_object_sources', 'investigations',
          'investigation_measurements', 'investigation_candidate_objects',
          'investigation_candidate_object_evidence',
          'evidence_statements', 'evidence_statement_measurements',
          'evidence_statement_sources', 'investigation_unknowns', 'replay_scenarios',
          'replay_steps', 'ingestion_runs', 'source_health'
        )`
    const policies = await prisma.$queryRaw<Array<{ policy_count: bigint }>>`
      SELECT count(*) AS policy_count
      FROM pg_policies
      WHERE schemaname = 'public'
    `

    expect(rls).toEqual([{ enabled_count: 22n, table_count: 22n }])
    expect(policies).toEqual([{ policy_count: 0n }])
  })

  it('round-trips Decimal without a JavaScript float write', async () => {
    const sourceId = `${prefix}-decimal-source`
    const stationId = `${prefix}-decimal-station`
    const measurementId = `${prefix}-decimal-measurement`
    await createSource(sourceId)
    await createStation(stationId)

    await prisma.measurement.create({
      data: {
        id: measurementId,
        stationId,
        sourceDocumentId: sourceId,
        indicator: 'нефтепродукты',
        value: '0.234000',
        rawValueText: '0,234',
        unit: 'мг/дм³',
        matrix: 'вода',
        sampledPeriod: '2025-09',
        extractionMode: ExtractionMode.RULE,
        verificationStatus: VerificationStatus.UNVERIFIED,
      },
    })

    const stored = await prisma.measurement.findUniqueOrThrow({
      where: { id: measurementId },
      select: { value: true, rawValueText: true },
    })
    expect(stored.value.toFixed(6)).toBe('0.234000')
    expect(stored.rawValueText).toBe('0,234')
  })

  it('enforces unique source page numbers', async () => {
    const sourceId = `${prefix}-unique-source`
    await createSource(sourceId)
    const textSha256 = 'a'.repeat(64)
    await prisma.sourcePage.create({
      data: {
        id: `${prefix}-unique-page-1`,
        sourceDocumentId: sourceId,
        pageNumber: 1,
        extractedText: 'page',
        textSha256,
      },
    })
    await expect(
      prisma.sourcePage.create({
        data: {
          id: `${prefix}-unique-page-2`,
          sourceDocumentId: sourceId,
          pageNumber: 1,
          extractedText: 'duplicate',
          textSha256,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('enforces the canonical URL and SHA provenance key', async () => {
    const canonicalUrl = `https://example.com/${prefix}-provenance`
    const sha256 = 'd'.repeat(64)
    const data = {
      originalUrl: canonicalUrl,
      canonicalUrl,
      publisher: 'Part 02 DB test',
      title: 'Unique provenance',
      sourceType: 'test',
      mediaType: 'application/pdf',
      sha256,
    }
    await prisma.sourceDocument.create({
      data: { id: `${prefix}-provenance-1`, ...data },
    })
    await expect(
      prisma.sourceDocument.create({
        data: { id: `${prefix}-provenance-2`, ...data },
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('enforces foreign keys and immutable measurement provenance', async () => {
    const sourceId = `${prefix}-restrict-source`
    const stationId = `${prefix}-restrict-station`
    const pageId = `${prefix}-restrict-page`
    const measurementId = `${prefix}-restrict-measurement`
    await createSource(sourceId)
    await createStation(stationId)
    await prisma.sourcePage.create({
      data: {
        id: pageId,
        sourceDocumentId: sourceId,
        pageNumber: 1,
        extractedText: 'page',
        textSha256: 'b'.repeat(64),
      },
    })
    await expect(
      prisma.measurement.create({
        data: {
          id: `${prefix}-missing-fk`,
          stationId: `${prefix}-missing-station`,
          sourceDocumentId: sourceId,
          indicator: 'test',
          value: '1',
          rawValueText: '1',
          unit: 'unit',
          matrix: 'water',
          sampledPeriod: '2025-09',
          extractionMode: ExtractionMode.RULE,
        },
      }),
    ).rejects.toThrow()
    await prisma.measurement.create({
      data: {
        id: measurementId,
        stationId,
        sourceDocumentId: sourceId,
        sourcePageId: pageId,
        indicator: 'test',
        value: '1',
        rawValueText: '1',
        unit: 'unit',
        matrix: 'water',
        sampledPeriod: '2025-09',
        extractionMode: ExtractionMode.RULE,
      },
    })
    await expect(
      prisma.sourceDocument.delete({ where: { id: sourceId } }),
    ).rejects.toThrow()
    await expect(
      prisma.sourcePage.delete({ where: { id: pageId } }),
    ).rejects.toThrow()
    await expect(
      prisma.measurement.findUnique({ where: { id: measurementId } }),
    ).resolves.not.toBeNull()
    await expect(
      prisma.sourcePage.findUnique({ where: { id: pageId } }),
    ).resolves.not.toBeNull()
  })

  it('rejects a source page from another document', async () => {
    const sourceAId = `${prefix}-cross-source-a`
    const sourceBId = `${prefix}-cross-source-b`
    const stationId = `${prefix}-cross-station`
    const pageBId = `${prefix}-cross-page-b`
    await createSource(sourceAId)
    await createSource(sourceBId)
    await createStation(stationId)
    await prisma.sourcePage.create({
      data: {
        id: pageBId,
        sourceDocumentId: sourceBId,
        pageNumber: 1,
        extractedText: 'Document B page',
        textSha256: 'e'.repeat(64),
      },
    })

    await expect(
      prisma.measurement.create({
        data: {
          id: `${prefix}-cross-measurement`,
          stationId,
          sourceDocumentId: sourceAId,
          sourcePageId: pageBId,
          indicator: 'test',
          value: '1',
          rawValueText: '1',
          unit: 'unit',
          matrix: 'water',
          sampledPeriod: '2025-09',
          extractionMode: ExtractionMode.RULE,
        },
      }),
    ).rejects.toThrow()
  })

  it('restricts deletion of a document used by an incident signal', async () => {
    const sourceId = `${prefix}-signal-source`
    await createSource(sourceId)
    await prisma.incidentSignal.create({
      data: {
        id: `${prefix}-signal`,
        title: 'Test signal',
        observedPeriod: '2025-09',
        reportedAt: new Date('2025-09-30T00:00:00.000Z'),
        phenomenon: 'other',
        excerpt: 'Test excerpt',
        sourceDocumentId: sourceId,
        extractionMode: ExtractionMode.RULE,
        dedupKey: `${prefix}-signal-dedup`,
      },
    })

    await expect(
      prisma.sourceDocument.delete({ where: { id: sourceId } }),
    ).rejects.toThrow()
  })

  it('restricts deletion of candidate-object evidence documents', async () => {
    const sourceId = `${prefix}-candidate-source`
    const candidateObjectId = `${prefix}-candidate`
    await createSource(sourceId)
    await prisma.candidateObject.create({
      data: {
        id: candidateObjectId,
        name: 'Test candidate',
        objectType: 'test',
        basisText: 'Document-backed test candidate',
      },
    })
    await prisma.candidateObjectSource.create({
      data: { candidateObjectId, sourceDocumentId: sourceId },
    })

    await expect(
      prisma.sourceDocument.delete({ where: { id: sourceId } }),
    ).rejects.toThrow()
  })

  it('enforces page and unknown-coordinate CHECK constraints', async () => {
    const sourceId = `${prefix}-check-source`
    await createSource(sourceId)
    await expect(
      prisma.sourcePage.create({
        data: {
          id: `${prefix}-page-zero`,
          sourceDocumentId: sourceId,
          pageNumber: 0,
          extractedText: 'invalid',
          textSha256: 'c'.repeat(64),
        },
      }),
    ).rejects.toThrow()
    await expect(
      prisma.station.create({
        data: {
          id: `${prefix}-coordinate-zero`,
          name: 'Unknown sentinel',
          waterBody: 'unknown',
          region: Region.ATYRAU,
          latitude: '0',
          longitude: '0',
          locationSourceDocumentId: sourceId,
        },
      }),
    ).rejects.toThrow()
  })
})

function createInvestigationInput(prefix: string): InvestigationInput {
  return {
    incident: {
      id: `${prefix}-investigation-incident`,
      title: 'Disposable investigation',
      region: 'atyrau',
      indicator: 'oil_products',
    },
    signals: [],
    stations: [
      {
        id: `${prefix}-investigation-station`,
        name: 'Disposable investigation station',
        waterBody: 'Zhaiyk',
      },
    ],
    stationRelations: [],
    measurements: [
      {
        id: `${prefix}-investigation-measurement`,
        stationId: `${prefix}-investigation-station`,
        indicator: 'oil_products',
        matrix: 'water',
        value: '0.100',
        rawValueText: '0.100',
        unit: 'mg/dm3',
        sampledAt: null,
        sampledPeriod: '2025-09',
        sourceDocumentId: `${prefix}-source`,
        sourcePage: null,
        sourceExcerpt: 'Disposable verified measurement',
        verified: true,
      },
    ],
    candidateObjects: [
      {
        id: `${prefix}-investigation-candidate`,
        name: 'Disposable candidate',
        category: 'outfall',
        stationId: `${prefix}-investigation-station`,
        waterBody: 'Zhaiyk',
        evidenceDocumentIds: [`${prefix}-source`],
        completeness: 'confirmed',
      },
    ],
    sourceDocuments: [
      {
        id: `${prefix}-source`,
        title: 'Disposable investigation source',
        publisher: 'DB e2e',
        url: `https://example.com/${prefix}-source`,
        official: true,
        verified: true,
        publishedAt: null,
        fetchedAt: null,
        contentType: 'pdf',
        sha256: 'd'.repeat(64),
        cachePath: null,
        status: 'verified',
      },
    ],
  }
}

function createInvestigationResult(
  prefix: string,
  inputHash: string,
): InvestigationResult {
  return {
    evidenceLevel: 'L0',
    corridorBounds: null,
    supportedFacts: [
      {
        id: `${prefix}-evidence`,
        code: 'NO_LOCAL_INCREASE_IN_PAIR',
        kind: 'supports',
        text: 'Disposable evidence statement.',
        measurementIds: [`${prefix}-investigation-measurement`],
        sourceDocumentIds: [`${prefix}-source`],
        generatedBy: 'rule_engine',
        sortOrder: 0,
      },
    ],
    contradictedHypotheses: [],
    objectDispositions: [
      {
        objectId: `${prefix}-investigation-candidate`,
        disposition: 'unknown',
        evidenceStatementIds: [`${prefix}-evidence`],
      },
    ],
    unknowns: [
      {
        code: 'STATION_ORDER_UNVERIFIED',
        text: 'Station order is unavailable.',
      },
    ],
    conclusion: 'Insufficient verified data for a causal conclusion.',
    inputHash,
    rulesetVersion: 'investigation-rules-v1',
  }
}
