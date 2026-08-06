import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'

import {
  canonicalizeInvestigationInput,
  runInvestigation,
  type InvestigationInput,
  type InvestigationResult,
} from '@caspian-trace/investigation-core'

import { AppModule } from '../../src/app.module'
import { FileInvestigationRepository } from '../../src/investigations/file-investigation.repository'
import { PrismaInvestigationRepository } from '../../src/investigations/prisma-investigation.repository'
import { InvestigationsService } from '../../src/investigations/investigations.service'
import { PrismaService } from '../../src/prisma/prisma.service'

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

describe('investigation persistence (disposable PostgreSQL e2e)', () => {
  const prefix = `test-integration01-${process.pid}-${Date.now()}-`
  let app: INestApplication
  let prisma: PrismaService
  let repository: PrismaInvestigationRepository
  let investigations: InvestigationsService
  let firstVersionId: string
  let input: InvestigationInput
  let result: InvestigationResult

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication()
    await app.init()
    prisma = app.get(PrismaService)
    repository = app.get(PrismaInvestigationRepository)
    investigations = app.get(InvestigationsService)
    const fixture = await new FileInvestigationRepository().loadInput('inv-atyrau-2025-09')
    if (fixture === null) throw new Error('Integration fixture is missing')
    input = prefixInput(canonicalizeInvestigationInput(fixture), prefix)
    result = withRepeatedEvidence(runInvestigation(input))
  })

  afterAll(async () => {
    if (prisma) await cleanup(prisma, prefix)
    if (app) await app.close()
  })

  it('does not bootstrap production facts from file fixtures', async () => {
    await expect(
      repository.loadInput('inv-atyrau-2025-09'),
    ).resolves.toBeNull()
  })

  it('fails closed when incident scope metadata is absent', async () => {
    const incidentId = `${prefix}unscoped-incident`
    await prisma.incident.create({
      data: {
        id: incidentId,
        title: 'Unscoped integration incident',
        region: 'ATYRAU',
        indicator: 'нефтепродукты',
        metadata: {},
      },
    })

    await expect(repository.loadInput(incidentId)).resolves.toBeNull()
  })

  it('fails closed when a scoped database record is missing', async () => {
    const incidentId = `${prefix}missing-scoped-record`

    await prisma.incident.create({
      data: {
        id: incidentId,
        title: 'Incident with a missing scoped station',
        region: 'ATYRAU',
        indicator: 'нефтепродукты',
        metadata: {
          stationIds: [`${prefix}station-that-does-not-exist`],
          stationRelationIds: [],
          measurementIds: [],
          candidateObjectIds: [],
        },
      },
    })

    await expect(repository.loadInput(incidentId)).resolves.toBeNull()
  })

  it('persists idempotent versions, repeated codes, sort order and candidate evidence', async () => {
    const first = await repository.saveVersioned(input.incident.id, input, result)
    firstVersionId = first.id
    const repeated = await repository.saveVersioned(input.incident.id, input, result)
    expect(repeated.id).toBe(first.id)
    await expect(repository.findCurrent(first.id)).resolves.toMatchObject({
      id: first.id,
    })
    await expect(repository.loadInput(first.id)).resolves.toMatchObject({
      incident: { id: input.incident.id },
    })
    await expect(investigations.recompute(first.id)).resolves.toMatchObject({
      id: first.id,
    })
    await expect(prisma.investigation.count({
      where: { incidentId: input.incident.id },
    })).resolves.toBe(1)

    const statements = await prisma.evidenceStatement.findMany({
      where: { investigationId: first.id },
      orderBy: { sortOrder: 'asc' },
    })
    expect(statements.map(({ code }) => code)).toEqual([
      'NO_LOCAL_INCREASE_IN_PAIR',
      'MAXIMUM_UPSTREAM_OF_OBJECT',
      'NO_LOCAL_INCREASE_IN_PAIR',
    ])
    expect(statements.map(({ sortOrder }) => sortOrder)).toEqual([0, 1, 2])
    await expect(prisma.investigationCandidateObjectEvidence.count({
      where: { investigationId: first.id },
    })).resolves.toBe(1)
    await expect(prisma.evidenceStatement.create({
      data: {
        id: `${prefix}duplicate-sort-order`,
        investigationId: first.id,
        kind: 'SUPPORTS',
        code: 'DUPLICATE_SORT_ORDER_CHECK',
        text: 'This row must be rejected by the database.',
        generatedBy: 'RULE_ENGINE',
        sortOrder: 0,
      },
    })).rejects.toMatchObject({ code: 'P2002' })
  })

  it('creates a changed ruleset version without mutating source or measurement metadata', async () => {
    const sourceId = input.sourceDocuments[0]!.id
    const measurementId = input.measurements[0]!.id
    await prisma.sourceDocument.update({
      where: { id: sourceId },
      data: { extractionMetadata: { externalOwner: 'retained' } },
    })
    await prisma.measurement.update({
      where: { id: measurementId },
      data: { metadata: { externalOwner: 'retained' } },
    })
    const changed = { ...result, rulesetVersion: `${result.rulesetVersion}-integration` }
    const second = await repository.saveVersioned(input.incident.id, input, changed)
    expect((await repository.findCurrent(input.incident.id))?.id).toBe(second.id)
    await expect(repository.findCurrent(firstVersionId)).resolves.toBeNull()
    await expect(repository.findCurrent(second.id)).resolves.toMatchObject({
      id: second.id,
    })
    await expect(prisma.investigation.count({
      where: { incidentId: input.incident.id },
    })).resolves.toBe(2)
    await expect(prisma.sourceDocument.findUniqueOrThrow({
      where: { id: sourceId },
      select: { extractionMetadata: true },
    })).resolves.toEqual({ extractionMetadata: { externalOwner: 'retained' } })
    await expect(prisma.measurement.findUniqueOrThrow({
      where: { id: measurementId },
      select: { metadata: true },
    })).resolves.toEqual({ metadata: { externalOwner: 'retained' } })
  })

  it('loads normalized provenance and exposes a contract-valid evidence graph snapshot', async () => {
    const loaded = await repository.loadInput(input.incident.id)
    expect(loaded?.stationRelations).toHaveLength(input.stationRelations.length)
    expect(loaded?.stationRelations.every(({ sourceDocumentId }) => sourceDocumentId.startsWith(prefix))).toBe(true)
    const stored = await repository.findCurrent(input.incident.id)
    expect(stored?.result.objectDispositions[0]?.evidenceStatementIds).toHaveLength(1)
  })
})

function prefixInput(input: InvestigationInput, prefix: string): InvestigationInput {
  const id = (value: string): string => `${prefix}${value}`
  return {
    incident: { ...input.incident, id: id(input.incident.id) },
    signals: input.signals.map((signal) => ({
      ...signal,
      id: id(signal.id),
      sourceDocumentId: id(signal.sourceDocumentId),
    })),
    stations: input.stations.map((station) => ({ ...station, id: id(station.id) })),
    stationRelations: input.stationRelations.map((relation) => ({
      ...relation,
      id: id(relation.id),
      upstreamStationId: id(relation.upstreamStationId),
      downstreamStationId: id(relation.downstreamStationId),
      sourceDocumentId: id(relation.sourceDocumentId),
    })),
    measurements: input.measurements.map((measurement) => ({
      ...measurement,
      id: id(measurement.id),
      stationId: id(measurement.stationId),
      sourceDocumentId: id(measurement.sourceDocumentId),
    })),
    candidateObjects: input.candidateObjects.map((candidate) => ({
      ...candidate,
      id: id(candidate.id),
      stationId: candidate.stationId === null ? null : id(candidate.stationId),
      evidenceDocumentIds: candidate.evidenceDocumentIds.map(id),
    })),
    sourceDocuments: input.sourceDocuments.map((source) => ({
      ...source,
      id: id(source.id),
      url: new URL(`/integration/${id(source.id)}`, source.url).toString(),
    })),
  }
}

function withRepeatedEvidence(result: InvestigationResult): InvestigationResult {
  const repeated = result.contradictedHypotheses[0]
  if (repeated === undefined) throw new Error('Fixture has no evidence to repeat')
  return {
    ...result,
    contradictedHypotheses: [
      ...result.contradictedHypotheses,
      { ...repeated, id: `${repeated.id}-repeat`, sortOrder: 2 },
    ],
  }
}

async function cleanup(prisma: PrismaService, prefix: string): Promise<void> {
  await prisma.incident.deleteMany({ where: { id: { startsWith: prefix } } })
  await prisma.incidentSignal.deleteMany({ where: { id: { startsWith: prefix } } })
  await prisma.measurement.deleteMany({ where: { id: { startsWith: prefix } } })
  await prisma.stationRelation.deleteMany({ where: { id: { startsWith: prefix } } })
  await prisma.candidateObject.deleteMany({ where: { id: { startsWith: prefix } } })
  await prisma.station.deleteMany({ where: { id: { startsWith: prefix } } })
  await prisma.sourceDocument.deleteMany({ where: { id: { startsWith: prefix } } })
}

function assertNotSupabase(value: string): void {
  const hostname = new URL(value).hostname.toLowerCase()
  if (hostname.endsWith('.supabase.co') || hostname.endsWith('.pooler.supabase.com')) {
    throw new Error('Supabase databases are forbidden for integration DB e2e')
  }
}
