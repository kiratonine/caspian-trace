import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  calculateInputHash,
  type InvestigationInput,
  type InvestigationResult,
} from '@caspian-trace/investigation-core'

import { Prisma } from '../../src/generated/prisma/client'
import { PrismaInvestigationRepository } from '../../src/investigations/prisma-investigation.repository'
import { PrismaService } from '../../src/prisma/prisma.service'

interface HandoffManifest {
  cases: Array<{
    inputPath: string
    incident: { id: string }
    stationRelationIds: string[]
    expectedResult: { fixtureInputHash: string }
  }>
}

interface TestHarness {
  repository: PrismaInvestigationRepository
  evidenceFindMany: jest.Mock
  sourceFindMany: jest.Mock
  incidentRows: Array<{ id: string; metadata: Record<string, unknown> }>
  evidenceRows: Array<{ id: string; sourceDocumentId: string }>
  candidateRows: Array<{ sources: Array<{ sourceDocumentId: string }> }>
  sourceRows: Array<{ id: string }>
}

const repositoryRoot = resolve(__dirname, '..', '..', '..', '..')

describe('PrismaInvestigationRepository runtime bootstrap input', () => {
  let inputs: InvestigationInput[]
  let handoff: HandoffManifest

  beforeAll(async () => {
    handoff = await readJson<HandoffManifest>(
      'data/fixtures/investigation/runtime-bootstrap-handoff.json',
    )
    inputs = await Promise.all(
      handoff.cases.map(({ inputPath }) => readJson<InvestigationInput>(inputPath)),
    )
  })

  it('selects the incident-scoped evidence for the shared canonical ASA relation', async () => {
    const { repository, evidenceFindMany } = createHarness(inputs, handoff)

    const may = await repository.loadInput('inv-atyrau-2025-05')
    expect(may?.stationRelations).toEqual([
      expect.objectContaining({
        id: 'rel-may-asa-pair',
        sourceDocumentId: 'doc-kazhydromet-2025-05',
      }),
    ])
    expect(evidenceFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: { in: ['rel-may-asa-pair'] } },
      }),
    )

    const september = await repository.loadInput('inv-atyrau-2025-09')
    expect(
      september?.stationRelations.find(
        ({ upstreamStationId }) => upstreamStationId === 'st-asa-0-5km-above',
      ),
    ).toEqual(
      expect.objectContaining({
        id: 'rel-sep-asa-pair',
        sourceDocumentId: 'doc-kazhydromet-2025-09',
      }),
    )
    expect(evidenceFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: {
            in: [
              'rel-sep-city-to-asa-above',
              'rel-sep-asa-pair',
              'rel-sep-asa-below-to-city-below',
            ],
          },
        },
      }),
    )
  })

  it('limits a shared candidate and source documents to the current incident', async () => {
    const { repository, candidateRows, sourceFindMany } = createHarness(inputs, handoff)
    expect(candidateRows[0]?.sources).toEqual(
      expect.arrayContaining([
        { sourceDocumentId: 'doc-kazhydromet-2025-05' },
        { sourceDocumentId: 'doc-kazhydromet-2025-09' },
      ]),
    )

    const may = await repository.loadInput('inv-atyrau-2025-05')
    expect(may?.candidateObjects[0]?.evidenceDocumentIds).toEqual(['doc-kazhydromet-2025-05'])
    expect(may?.sourceDocuments.map(({ id }) => id)).toEqual(['doc-kazhydromet-2025-05'])
    expect(sourceFindMany).toHaveBeenLastCalledWith({
      where: { id: { in: ['doc-kazhydromet-2025-05'] } },
      orderBy: { id: 'asc' },
    })

    const september = await repository.loadInput('inv-atyrau-2025-09')
    expect(september?.candidateObjects[0]?.evidenceDocumentIds).toEqual(['doc-kazhydromet-2025-09'])
  })

  it('supports the explicit empty scopes of the Aktau case', async () => {
    const { repository, evidenceFindMany } = createHarness(inputs, handoff)

    await expect(repository.loadInput('inv-aktau-insufficient')).resolves.toMatchObject({
      signals: [],
      stations: [],
      stationRelations: [],
      measurements: [],
      candidateObjects: [],
      sourceDocuments: [],
    })
    expect(evidenceFindMany).not.toHaveBeenCalled()
  })

  it.each(['inv-atyrau-2025-09', 'inv-atyrau-2025-05', 'inv-aktau-insufficient'])(
    'reconstructs the manifest fixtureInputHash for %s',
    async (incidentId) => {
      const { repository } = createHarness(inputs, handoff)
      const loaded = await repository.loadInput(incidentId)
      const manifestCase = handoff.cases.find(({ incident }) => incident.id === incidentId)

      expect(loaded).not.toBeNull()
      expect(calculateInputHash(loaded!)).toBe(manifestCase?.expectedResult.fixtureInputHash)
    },
  )

  it('fails closed for malformed metadata and DB-to-metadata evidence conflicts', async () => {
    const malformed = createHarness(inputs, handoff)
    const mayIncident = malformed.incidentRows.find(({ id }) => id === 'inv-atyrau-2025-05')
    expect(mayIncident).toBeDefined()
    delete mayIncident!.metadata.runtimeBootstrap
    await expect(malformed.repository.loadInput('inv-atyrau-2025-05')).resolves.toBeNull()

    const conflicted = createHarness(inputs, handoff)
    const mayEvidence = conflicted.evidenceRows.find(({ id }) => id === 'rel-may-asa-pair')
    expect(mayEvidence).toBeDefined()
    mayEvidence!.sourceDocumentId = 'doc-kazhydromet-2025-09'
    await expect(conflicted.repository.loadInput('inv-atyrau-2025-05')).resolves.toBeNull()

    const missingSource = createHarness(inputs, handoff)
    missingSource.sourceRows.splice(
      missingSource.sourceRows.findIndex(({ id }) => id === 'doc-kazhydromet-2025-05'),
      1,
    )
    await expect(missingSource.repository.loadInput('inv-atyrau-2025-05')).resolves.toBeNull()
  })

  it('persists a runtime bootstrap relation through its canonical ID without creating a duplicate edge', async () => {
    const input = inputs.find(({ incident }) => incident.id === 'inv-atyrau-2025-05')
    expect(input).toBeDefined()
    const inputRelation = input!.stationRelations.find(({ id }) => id === 'rel-may-asa-pair')
    expect(inputRelation).toBeDefined()
    const result = await readJson<InvestigationResult>(
      'data/fixtures/investigation/may-golden.json',
    )
    const canonicalRelationIds = [
      'station-relation:st-asa-0-5km-above:st-asa-0-5km-below:upstream-of',
    ]
    const stationRelationFacts = [
      {
        relationId: canonicalRelationIds[0],
        evidenceId: 'rel-may-asa-pair',
        sourceDocumentId: 'doc-kazhydromet-2025-05',
        basis: inputRelation!.basis,
        comparisonPair: inputRelation!.comparisonPair,
        provenance: inputRelation!.provenance,
      },
    ]
    const candidateObjectFacts = [
      {
        candidateObjectId: 'obj-atyrau-su-arnasy',
        evidenceDocumentIds: ['doc-kazhydromet-2025-05'],
      },
    ]
    const runtimeBootstrap = {
      version: 1,
      fixtureInputHash: result.inputHash,
      stationRelationFacts,
      candidateObjectFacts,
    }
    const existingMetadata = {
      stationRelationIds: canonicalRelationIds,
      runtimeBootstrap,
    }
    const incidentUpsert = jest.fn((args: unknown) => Promise.resolve(args))
    const upsert = jest.fn(() => Promise.resolve({}))
    const canonicalRelation = {
      id: canonicalRelationIds[0],
      fromStationId: inputRelation!.upstreamStationId,
      toStationId: inputRelation!.downstreamStationId,
      kind: 'UPSTREAM_OF',
      metadata: { seededBy: 'verified-seed', comparisonPair: false },
    }
    const stationRelationFindUnique = jest.fn(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === canonicalRelation.id ? canonicalRelation : null),
    )
    const stationRelationUpsert = jest.fn(
      ({ create }: { create: { id: string } }) => {
        if (create.id === 'rel-may-asa-pair') {
          return Promise.reject(
            new Prisma.PrismaClientKnownRequestError('Duplicate station relation edge', {
              code: 'P2002',
              clientVersion: 'test',
              meta: {
                target: ['from_station_id', 'to_station_id', 'kind'],
              },
            }),
          )
        }
        return Promise.resolve({})
      },
    )
    const stationRelationUpdate = jest.fn(() => Promise.resolve(canonicalRelation))
    const transaction = {
      sourceDocument: { upsert },
      station: { upsert },
      incident: {
        findUnique: jest.fn(() => Promise.resolve({ metadata: existingMetadata })),
        upsert: incidentUpsert,
      },
      incidentSignal: { upsert },
      incidentSignalLink: { upsert },
      stationRelation: {
        findUnique: stationRelationFindUnique,
        upsert: stationRelationUpsert,
        update: stationRelationUpdate,
      },
      measurement: { upsert },
      candidateObject: { upsert },
      candidateObjectSource: { upsert },
      investigation: {
        findFirst: jest.fn(() => Promise.resolve(null)),
        updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
        create: jest.fn(() =>
          Promise.resolve({
            id: 'inv-atyrau-2025-05@1.2.1:test',
            generatedAt: new Date('2026-08-07T00:00:00.000Z'),
          }),
        ),
      },
      investigationMeasurement: { createMany: jest.fn() },
      investigationCandidateObject: { createMany: jest.fn() },
      evidenceStatement: { create: jest.fn() },
      investigationCandidateObjectEvidence: { createMany: jest.fn() },
      investigationUnknown: { createMany: jest.fn() },
    }
    const prisma = {
      investigation: {
        findFirst: jest.fn(() => Promise.resolve(null)),
      },
      $transaction: jest.fn((operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
      ),
    }
    const repository = new PrismaInvestigationRepository(prisma as unknown as PrismaService)

    await repository.saveVersioned(input!.incident.id, input!, result)

    expect(stationRelationFindUnique).toHaveBeenCalledWith({
      where: { id: canonicalRelation.id },
      select: {
        id: true,
        fromStationId: true,
        toStationId: true,
        kind: true,
        metadata: true,
      },
    })
    expect(stationRelationUpsert).not.toHaveBeenCalled()
    expect(stationRelationUpdate).toHaveBeenCalledWith({
      where: { id: canonicalRelation.id },
      data: {
        metadata: {
          seededBy: 'verified-seed',
          comparisonPair: true,
        },
      },
    })
    const upsertCall = incidentUpsert.mock.calls[0]?.[0] as
      | {
          update: { metadata: Record<string, unknown> }
        }
      | undefined
    expect(upsertCall).toBeDefined()
    const metadata = upsertCall!.update.metadata
    expect(metadata.stationRelationIds).toEqual(canonicalRelationIds)
    expect(metadata.runtimeBootstrap).toEqual(runtimeBootstrap)
    expect(metadata.stationRelationIds).not.toEqual(input!.stationRelations.map(({ id }) => id))
  })
})

function createHarness(inputs: InvestigationInput[], handoff: HandoffManifest): TestHarness {
  const stationRows = uniqueById(
    inputs.flatMap((input) =>
      input.stations.map((station) => ({
        ...station,
        region: input.incident.region.toUpperCase(),
      })),
    ),
  )
  const relationRows = uniqueById(
    inputs.flatMap((input) =>
      input.stationRelations.map((relation) => ({
        id: canonicalRelationId(relation),
        fromStationId: relation.upstreamStationId,
        toStationId: relation.downstreamStationId,
        kind: 'UPSTREAM_OF',
        sourceDocumentId: null,
        verificationStatus: relation.verified ? 'OFFICIAL' : 'UNVERIFIED',
        notes: null,
        metadata: { comparisonPair: relation.comparisonPair },
      })),
    ),
  )
  const evidenceRows = inputs.flatMap((input) =>
    input.stationRelations.map((relation) => ({
      id: relation.id,
      stationRelationId: canonicalRelationId(relation),
      sourceDocumentId: relation.sourceDocumentId,
      sourcePage: relation.provenance.sourcePage,
      basis: evidenceBasis(relation.basis),
      sourceExcerpt: relation.provenance.sourceExcerpt,
      verificationStatus: relation.verified ? 'OFFICIAL' : 'UNVERIFIED',
    })),
  )
  const measurementRows = inputs.flatMap((input) =>
    input.measurements.map((measurement) => ({
      ...measurement,
      value: { toString: (): string => measurement.value },
      sampledAt: isoDate(measurement.sampledAt),
      sourcePage: measurement.sourcePage === null ? null : { pageNumber: measurement.sourcePage },
      verificationStatus: measurement.verified ? 'OFFICIAL' : 'UNVERIFIED',
      metadata: {},
    })),
  )
  const candidateRows = uniqueById(
    inputs.flatMap((input) =>
      input.candidateObjects.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        objectType: candidate.category,
        metadata: {
          stationId: candidate.stationId,
          waterBody: candidate.waterBody,
          completeness: candidate.completeness,
        },
        sources: uniqueStrings(
          inputs.flatMap((other) =>
            other.candidateObjects
              .filter(({ id }) => id === candidate.id)
              .flatMap(({ evidenceDocumentIds }) => evidenceDocumentIds),
          ),
        ).map((sourceDocumentId) => ({ sourceDocumentId })),
      })),
    ),
  )
  const sourceRows = uniqueById(
    inputs.flatMap((input) =>
      input.sourceDocuments.map((source) => ({
        id: source.id,
        title: source.title,
        publisher: source.publisher,
        originalUrl: source.url,
        mediaType: source.contentType,
        publishedAt: isoDate(source.publishedAt),
        fetchedAt: isoDate(source.fetchedAt),
        sha256: source.sha256,
        cachePath: source.cachePath,
        status: source.status.toUpperCase(),
        extractionMetadata: {
          official: source.official,
          verified: source.verified,
        },
      })),
    ),
  )
  const incidentRows = inputs.map((input) => {
    const manifestCase = handoff.cases.find(({ incident }) => incident.id === input.incident.id)
    if (manifestCase === undefined) throw new Error(`Missing handoff ${input.incident.id}`)
    return {
      id: input.incident.id,
      title: input.incident.title,
      region: input.incident.region.toUpperCase(),
      indicator: input.incident.indicator,
      metadata: {
        unknowns: input.incident.unknowns ?? [],
        stationIds: input.stations.map(({ id }) => id),
        stationRelationIds: manifestCase.stationRelationIds,
        measurementIds: input.measurements.map(({ id }) => id),
        candidateObjectIds: input.candidateObjects.map(({ id }) => id),
        sourceDocumentIds: input.sourceDocuments.map(({ id }) => id),
        runtimeBootstrap: {
          stationRelationFacts: input.stationRelations.map((relation) => ({
            relationId: canonicalRelationId(relation),
            evidenceId: relation.id,
            sourceDocumentId: relation.sourceDocumentId,
            basis: relation.basis,
            comparisonPair: relation.comparisonPair,
            provenance: relation.provenance,
          })),
          candidateObjectFacts: input.candidateObjects.map((candidate) => ({
            candidateObjectId: candidate.id,
            evidenceDocumentIds: candidate.evidenceDocumentIds,
          })),
        },
      },
      signals: input.signals.map((signal) => ({
        signal: {
          ...signal,
          observedAt: isoDate(signal.observedAt),
          reportedAt: isoDate(signal.reportedAt),
          extractionMode: signal.extractionMode.toUpperCase(),
          verificationStatus: signal.verificationStatus.toUpperCase(),
        },
      })),
    }
  })

  const evidenceFindMany = jest.fn(({ where }: FindManyArgs) =>
    Promise.resolve(filterByIds(evidenceRows, where.id.in)),
  )
  const sourceFindMany = jest.fn(({ where }: FindManyArgs) =>
    Promise.resolve(filterByIds(sourceRows, where.id.in)),
  )
  const prisma = {
    investigation: {
      findUnique: jest.fn(() => Promise.resolve(null)),
    },
    incident: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(incidentRows.find(({ id }) => id === where.id) ?? null),
      ),
    },
    station: { findMany: scopedFindMany(stationRows) },
    stationRelation: { findMany: scopedFindMany(relationRows) },
    stationRelationEvidence: { findMany: evidenceFindMany },
    measurement: { findMany: scopedFindMany(measurementRows) },
    candidateObject: { findMany: scopedFindMany(candidateRows) },
    sourceDocument: { findMany: sourceFindMany },
  }
  const repository = new PrismaInvestigationRepository(prisma as unknown as PrismaService)
  return {
    repository,
    evidenceFindMany,
    sourceFindMany,
    incidentRows,
    evidenceRows,
    candidateRows,
    sourceRows,
  }
}

interface FindManyArgs {
  where: { id: { in: string[] } }
}

function scopedFindMany<T extends { id: string }>(
  rows: T[],
): jest.Mock<Promise<T[]>, [FindManyArgs]> {
  return jest.fn(({ where }: FindManyArgs) => Promise.resolve(filterByIds(rows, where.id.in)))
}

function filterByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const scope = new Set(ids)
  return rows
    .filter(({ id }) => scope.has(id))
    .sort((left, right) => left.id.localeCompare(right.id))
}

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()]
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)]
}

function canonicalRelationId(relation: {
  upstreamStationId: string
  downstreamStationId: string
}): string {
  return `station-relation:${relation.upstreamStationId}:${relation.downstreamStationId}:upstream-of`
}

function evidenceBasis(basis: string): string {
  return basis === 'Официальная парная маркировка выше/ниже одного сброса'
    ? 'OFFICIAL_PAIRED_ABOVE_BELOW_LABELS'
    : 'OFFICIAL_MONITORING_TABLE_SEQUENCE_AND_STATION_LABELS'
}

function isoDate(value: string | null): Date | null {
  return value === null ? null : ({ toISOString: () => value } as Date)
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(repositoryRoot, path), 'utf8')) as T
}
