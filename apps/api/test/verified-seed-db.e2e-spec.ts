import { PrismaPg } from '@prisma/adapter-pg'

import { loadVerifiedData } from '../prisma/seed/verified-data.loader'
import { seedVerifiedData } from '../prisma/seed/verified-seed.service'
import { PrismaClient } from '../src/generated/prisma/client'
import {
  SourceDocumentStatus,
  VerificationStatus,
} from '../src/generated/prisma/enums'
import { normalizePgConnectionString } from '../src/prisma/prisma-connection'
import {
  addEarlierRelationEvidence,
  addRelationEvidenceFixture,
  completeHumanReview,
  copyVerifiedData,
  mutateFixture,
  namespaceVerifiedData,
  removeVerifiedData,
  replaceDocumentSha,
  reverseManifestFixtures,
} from './seed/verified-seed-test-data'

const TEST_PREFIX = 'test-part03-'
const databaseUrl = process.env.DATABASE_E2E_URL
const directUrl = process.env.DIRECT_E2E_URL

if (
  process.env.PRISMA_E2E_DATABASE_REQUIRED !== 'true' ||
  process.env.PRISMA_E2E_DATABASE_DISPOSABLE !== 'true'
) {
  throw new Error(
    'Explicit required and disposable flags are required for seed DB e2e',
  )
}
if (!databaseUrl || !directUrl) {
  throw new Error('DATABASE_E2E_URL and DIRECT_E2E_URL are required for seed DB e2e')
}
assertNotSupabase(databaseUrl)
assertNotSupabase(directUrl)

interface MeasurementFixture {
  measurements: Array<{
    id: string
    stationId: string
    stationLabel: string
    indicator: string
    rawValueText: string
    normalizedValue: string
    unit: string
    sampledAt: string | null
    sampledPeriod: string | null
    sourceUrl: string
    sourceSha256: string
    sourcePage: number | null
    sourceExcerpt: string
    checkedBy: string[]
    checkedAt: string
  }>
}

interface RelationFixture {
  relations: Array<{
    id: string
    checkedBy: string[]
    checkedAt: string
  }>
}

describe('verified seed against disposable PostgreSQL', () => {
  const completedDirectory = createCompletedTestData()
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: normalizePgConnectionString(databaseUrl),
    }),
  })

  beforeAll(async () => {
    await expect(countTestRecords(prisma)).resolves.toEqual({
      documents: 0,
      stations: 0,
      relations: 0,
      relationEvidence: 0,
      measurements: 0,
    })
  })

  afterAll(async () => {
    await cleanupTestRecords(prisma)
    await prisma.$disconnect()
    removeVerifiedData(completedDirectory)
  })

  it('seeds only test-prefixed rows with all four relation evidence items', async () => {
    const summary = await seedVerifiedData(
      prisma,
      await loadVerifiedData(completedDirectory),
      { testOnlyIdPrefix: TEST_PREFIX },
    )
    expect(summary).toEqual({
      documents: { created: 2, unchanged: 0, promoted: 0 },
      stations: { created: 7, updated: 0, unchanged: 0 },
      relations: {
        created: 3,
        unchanged: 0,
        promoted: 0,
        evidenceCreated: 4,
        evidenceUnchanged: 0,
        evidencePromoted: 0,
        evidenceReviewUpdated: 0,
        verifiedEvidence: 2,
        pendingEvidence: 2,
        omitted: 0,
      },
      measurements: {
        created: 9,
        unchanged: 0,
        promoted: 0,
        reviewUpdated: 0,
      },
      humanReviewers: 2,
    })

    const measurement = await prisma.measurement.findUniqueOrThrow({
      where: { id: `${TEST_PREFIX}m-2025-09-1km-above-atyrau` },
      select: {
        value: true,
        rawValueText: true,
        sourceExcerpt: true,
        sourcePageId: true,
        verificationStatus: true,
        metadata: true,
      },
    })
    expect(measurement.value.toString()).toBe('0.234')
    expect(measurement.rawValueText).toBe('0,234')
    expect(measurement.sourceExcerpt).toContain('0,234')
    expect(measurement.sourcePageId).toBeNull()
    expect(measurement.verificationStatus).toBe(VerificationStatus.OFFICIAL)
    expect(measurement.metadata).toMatchObject({ sourcePage: 22 })

    const stations = await prisma.station.findMany({
      where: { id: { startsWith: TEST_PREFIX } },
      select: { id: true, latitude: true, longitude: true, riverOrder: true },
    })
    expect(stations).toHaveLength(7)
    expect(
      stations.every(
        ({ id, latitude, longitude }) =>
          id.startsWith(TEST_PREFIX) &&
          latitude === null &&
          longitude === null,
      ),
    ).toBe(true)
    expect(
      Object.fromEntries(
        stations.map(({ id, riverOrder }) => [
          id.slice(TEST_PREFIX.length),
          riverOrder,
        ]),
      ),
    ).toMatchObject({
      'st-zhaiyk-1km-above-atyrau': 0,
      'st-asa-0-5km-above': 1,
      'st-asa-0-5km-below': 2,
      'st-zhaiyk-1km-below-atyrau': 3,
    })

    const documents = await prisma.sourceDocument.findMany({
      where: { id: { startsWith: TEST_PREFIX } },
      select: { id: true, status: true, fetchedAt: true, cachePath: true },
    })
    expect(documents).toHaveLength(2)
    expect(
      documents.every(
        ({ id, status, fetchedAt, cachePath }) =>
          id.startsWith(TEST_PREFIX) &&
          status === SourceDocumentStatus.UNVERIFIED &&
          fetchedAt === null &&
          cachePath === null,
      ),
    ).toBe(true)
    await expect(prisma.sourcePage.count()).resolves.toBe(0)
    await expect(prisma.incident.count()).resolves.toBe(0)

    const evidence = await prisma.stationRelationEvidence.findMany({
      where: { id: { startsWith: TEST_PREFIX } },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        stationRelationId: true,
        sourceDocumentId: true,
        verificationStatus: true,
      },
    })
    expect(evidence).toHaveLength(4)
    expect(
      evidence.every(
        ({ id, stationRelationId, sourceDocumentId }) =>
          id.startsWith(TEST_PREFIX) &&
          stationRelationId.startsWith(TEST_PREFIX) &&
          sourceDocumentId.startsWith(TEST_PREFIX),
      ),
    ).toBe(true)
    expect(
      evidence.filter(
        ({ verificationStatus }) =>
          verificationStatus === VerificationStatus.OFFICIAL,
      ),
    ).toHaveLength(2)

    const pairedEvidence = evidence.filter(({ id }) => id.includes('asa-pair'))
    expect(pairedEvidence).toHaveLength(2)
    expect(new Set(pairedEvidence.map(({ stationRelationId }) => stationRelationId)).size).toBe(1)
    expect(new Set(pairedEvidence.map(({ sourceDocumentId }) => sourceDocumentId)).size).toBe(2)

    const semanticEdges = await prisma.stationRelation.findMany({
      where: { id: { startsWith: TEST_PREFIX } },
      select: { sourceDocumentId: true, notes: true },
    })
    expect(
      semanticEdges.every(
        ({ sourceDocumentId, notes }) =>
          sourceDocumentId === null && notes === null,
      ),
    ).toBe(true)
  })

  it('has RLS, FK, and unique constraints for normalized relation evidence', async () => {
    const catalog = await prisma.$queryRaw<
      Array<{ rls: boolean; constraint_count: bigint }>
    >`SELECT
        c.relrowsecurity AS rls,
        count(con.oid) AS constraint_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_constraint con ON con.conrelid = c.oid
      WHERE n.nspname = 'public'
        AND c.relname = 'station_relation_evidence'
      GROUP BY c.relrowsecurity`
    expect(catalog).toEqual([{ rls: true, constraint_count: 8n }])

    const firstEvidence = await prisma.stationRelationEvidence.findFirstOrThrow({
      where: { id: { startsWith: TEST_PREFIX } },
    })
    await expect(
      prisma.stationRelationEvidence.create({
        data: {
          id: `${TEST_PREFIX}duplicate-evidence`,
          stationRelationId: firstEvidence.stationRelationId,
          sourceDocumentId: firstEvidence.sourceDocumentId,
          sourcePage: firstEvidence.sourcePage,
          basis: firstEvidence.basis,
          sourceExcerpt: firstEvidence.sourceExcerpt,
          checkedBy: ['reviewer-alpha', 'reviewer-beta'],
          checkedAt: firstEvidence.checkedAt,
          verificationStatus: firstEvidence.verificationStatus,
        },
      }),
    ).rejects.toThrow()
  })

  it('accepts different evidence pages and deduplicates a null page', async () => {
    const directory = createCompletedTestData()
    const pageEvidenceId = `${TEST_PREFIX}rel-page-23`
    const nullEvidenceId = `${TEST_PREFIX}rel-page-null`
    addRelationEvidenceFixture(directory, {
      filename: 'test-relation-page-23.json',
      id: pageEvidenceId,
      sourcePage: 23,
    })
    addRelationEvidenceFixture(directory, {
      filename: 'test-relation-page-null.json',
      id: nullEvidenceId,
      sourcePage: null,
    })
    try {
      const summary = await seedVerifiedData(
        prisma,
        await loadVerifiedData(directory),
        { testOnlyIdPrefix: TEST_PREFIX },
      )
      expect(summary.relations).toMatchObject({
        created: 0,
        unchanged: 3,
        evidenceCreated: 2,
        evidenceUnchanged: 4,
        omitted: 0,
      })
      await expect(
        prisma.stationRelationEvidence.findMany({
          where: { id: { in: [pageEvidenceId, nullEvidenceId] } },
          orderBy: { id: 'asc' },
          select: { id: true, sourcePage: true },
        }),
      ).resolves.toEqual([
        { id: pageEvidenceId, sourcePage: 23 },
        { id: nullEvidenceId, sourcePage: null },
      ])

      const nullEvidence =
        await prisma.stationRelationEvidence.findUniqueOrThrow({
          where: { id: nullEvidenceId },
        })
      await expect(
        prisma.stationRelationEvidence.create({
          data: {
            id: `${TEST_PREFIX}duplicate-null-page`,
            stationRelationId: nullEvidence.stationRelationId,
            sourceDocumentId: nullEvidence.sourceDocumentId,
            sourcePage: null,
            basis: nullEvidence.basis,
            sourceExcerpt: nullEvidence.sourceExcerpt,
            checkedBy: ['reviewer-alpha', 'reviewer-beta'],
            checkedAt: nullEvidence.checkedAt,
            verificationStatus: nullEvidence.verificationStatus,
          },
        }),
      ).rejects.toThrow()
    } finally {
      await prisma.stationRelationEvidence.deleteMany({
        where: { id: { in: [pageEvidenceId, nullEvidenceId] } },
      })
      removeVerifiedData(directory)
    }
    await expect(countTestRecords(prisma)).resolves.toMatchObject({
      relations: 3,
      relationEvidence: 4,
    })
  })

  it('is idempotent and independent of manifest fixture order', async () => {
    const reversedDirectory = createCompletedTestData()
    reverseManifestFixtures(reversedDirectory)
    try {
      const before = await relationSnapshot(prisma)
      const summary = await seedVerifiedData(
        prisma,
        await loadVerifiedData(reversedDirectory),
        { testOnlyIdPrefix: TEST_PREFIX },
      )
      expect(summary.documents).toEqual({ created: 0, unchanged: 2, promoted: 0 })
      expect(summary.stations).toEqual({
        created: 0,
        updated: 0,
        unchanged: 7,
      })
      expect(summary.relations).toMatchObject({
        created: 0,
        unchanged: 3,
        evidenceCreated: 0,
        evidenceUnchanged: 4,
        evidenceReviewUpdated: 0,
        omitted: 0,
      })
      expect(summary.measurements).toEqual({
        created: 0,
        unchanged: 9,
        promoted: 0,
        reviewUpdated: 0,
      })
      await expect(relationSnapshot(prisma)).resolves.toEqual(before)
      await expect(countTestRecords(prisma)).resolves.toEqual({
        documents: 2,
        stations: 7,
        relations: 3,
        relationEvidence: 4,
        measurements: 9,
      })
    } finally {
      removeVerifiedData(reversedDirectory)
    }
  })

  it('updates only derived river order and preserves coordinate provenance', async () => {
    const stationId = `${TEST_PREFIX}st-zhaiyk-1km-above-atyrau`
    const locationSourceDocumentId = `${TEST_PREFIX}doc-kazhydromet-2025-09`
    await prisma.station.update({
      where: { id: stationId },
      data: {
        latitude: '47.123456',
        longitude: '51.987654',
        locationSourceDocumentId,
        riverOrder: 99,
        metadata: { provenance: 'external-coordinate-owner' },
      },
    })

    try {
      const summary = await seedVerifiedData(
        prisma,
        await loadVerifiedData(completedDirectory),
        { testOnlyIdPrefix: TEST_PREFIX },
      )
      expect(summary.stations).toEqual({
        created: 0,
        updated: 1,
        unchanged: 6,
      })
      const station = await prisma.station.findUniqueOrThrow({
        where: { id: stationId },
        select: {
          latitude: true,
          longitude: true,
          locationSourceDocumentId: true,
          riverOrder: true,
          metadata: true,
        },
      })
      expect(station).toMatchObject({
        locationSourceDocumentId,
        riverOrder: 0,
        metadata: { provenance: 'external-coordinate-owner' },
      })
      expect(station.latitude?.toString()).toBe('47.123456')
      expect(station.longitude?.toString()).toBe('51.987654')
    } finally {
      await prisma.station.update({
        where: { id: stationId },
        data: {
          latitude: null,
          longitude: null,
          locationSourceDocumentId: null,
          metadata: { provenance: 'verified_manifest' },
        },
      })
    }
  })

  it('rejects a reused document ID with another SHA and leaves DB unchanged', async () => {
    const directory = createCompletedTestData()
    replaceDocumentSha(
      directory,
      `${TEST_PREFIX}doc-kazhydromet-2025-05`,
      'c'.repeat(64),
    )
    try {
      await expect(
        seedVerifiedData(prisma, await loadVerifiedData(directory), {
          testOnlyIdPrefix: TEST_PREFIX,
        }),
      ).rejects.toMatchObject({ code: 'VERIFIED_SEED_CONFLICT' })
      const document = await prisma.sourceDocument.findUniqueOrThrow({
        where: { id: `${TEST_PREFIX}doc-kazhydromet-2025-05` },
        select: { sha256: true },
      })
      expect(document.sha256).toBe(
        '73fb21e06f529160bf8756b3612bc3eab6a9f3615a91530ff19292120c684bce',
      )
      await expect(countTestRecords(prisma)).resolves.toMatchObject({
        measurements: 9,
        relationEvidence: 4,
      })
    } finally {
      removeVerifiedData(directory)
    }
  })

  it('rolls back a test-prefixed insert when a measurement ID changes value', async () => {
    const directory = createCompletedTestData()
    mutateFixture<MeasurementFixture>(
      directory,
      'atyrau-2025-09.json',
      (fixture) => {
        const first = fixture.measurements[0]!
        fixture.measurements.unshift({
          ...first,
          id: `${TEST_PREFIX}new-measurement`,
          rawValueText: '0,235',
          normalizedValue: '0.235',
          sourceExcerpt: 'Test-only rollback record — 0,235 мг/дм3',
        })
        fixture.measurements[4]!.rawValueText = '0,168'
        fixture.measurements[4]!.normalizedValue = '0.168'
      },
    )
    try {
      await expect(
        seedVerifiedData(prisma, await loadVerifiedData(directory), {
          testOnlyIdPrefix: TEST_PREFIX,
        }),
      ).rejects.toMatchObject({ code: 'VERIFIED_SEED_CONFLICT' })
      await expect(
        prisma.measurement.findUnique({
          where: { id: `${TEST_PREFIX}new-measurement` },
        }),
      ).resolves.toBeNull()
      const original = await prisma.measurement.findUniqueOrThrow({
        where: { id: `${TEST_PREFIX}m-2025-09-1km-below-atyrau` },
        select: { value: true, rawValueText: true },
      })
      expect(original.value.toString()).toBe('0.167')
      expect(original.rawValueText).toBe('0,167')
      await expect(prisma.measurement.count({
        where: { id: { startsWith: TEST_PREFIX } },
      })).resolves.toBe(9)
    } finally {
      removeVerifiedData(directory)
    }
  })

  it('adds lexicographically earlier evidence without changing its parent edge or history result', async () => {
    const directory = createCompletedTestData()
    addEarlierRelationEvidence(directory)
    try {
      const parentsBefore = await parentRelationSnapshot(prisma)
      const incrementalSummary = await seedVerifiedData(
        prisma,
        await loadVerifiedData(directory),
        { testOnlyIdPrefix: TEST_PREFIX },
      )
      expect(incrementalSummary.relations).toMatchObject({
        created: 0,
        unchanged: 3,
        evidenceCreated: 1,
        evidenceUnchanged: 4,
        evidenceReviewUpdated: 0,
        verifiedEvidence: 2,
        pendingEvidence: 3,
        omitted: 0,
      })
      await expect(parentRelationSnapshot(prisma)).resolves.toEqual(parentsBefore)
      await expect(countTestRecords(prisma)).resolves.toMatchObject({
        relations: 3,
        relationEvidence: 5,
      })
      const incrementalSnapshot = await relationSnapshot(prisma)

      await cleanupTestRecords(prisma)
      const freshSummary = await seedVerifiedData(
        prisma,
        await loadVerifiedData(directory),
        { testOnlyIdPrefix: TEST_PREFIX },
      )
      expect(freshSummary.relations).toMatchObject({
        created: 3,
        evidenceCreated: 5,
        omitted: 0,
      })
      await expect(relationSnapshot(prisma)).resolves.toEqual(
        incrementalSnapshot,
      )

      const repeatedSummary = await seedVerifiedData(
        prisma,
        await loadVerifiedData(directory),
        { testOnlyIdPrefix: TEST_PREFIX },
      )
      expect(repeatedSummary.relations).toMatchObject({
        created: 0,
        unchanged: 3,
        evidenceCreated: 0,
        evidenceUnchanged: 5,
        evidenceReviewUpdated: 0,
        omitted: 0,
      })
      await expect(countTestRecords(prisma)).resolves.toEqual({
        documents: 2,
        stations: 7,
        relations: 3,
        relationEvidence: 5,
        measurements: 9,
      })
    } finally {
      removeVerifiedData(directory)
    }
  })

  it('applies reviewer additions and later checkedAt as explicit review updates', async () => {
    const directory = createCompletedTestData()
    await prisma.measurement.update({
      where: { id: `${TEST_PREFIX}m-2025-09-1km-above-atyrau` },
      data: {
        metadata: {
          sourcePage: 22,
          checkedBy: ['reviewer-alpha', 'reviewer-beta'],
          checkedAt: '2026-08-04',
          externalMetadataKey: { owner: 'outside-seed' },
        },
      },
    })
    setRelationReview(directory, [
      'reviewer-beta',
      'reviewer-gamma',
      'reviewer-alpha',
    ], '2026-08-05')
    setMeasurementReview(directory, [
      'reviewer-gamma',
      'reviewer-alpha',
      'reviewer-beta',
    ], '2026-08-05')
    try {
      const summary = await seedVerifiedData(
        prisma,
        await loadVerifiedData(directory),
        { testOnlyIdPrefix: TEST_PREFIX },
      )
      expect(summary.relations).toMatchObject({
        evidenceUnchanged: 3,
        evidenceReviewUpdated: 1,
      })
      expect(summary.measurements).toEqual({
        created: 0,
        unchanged: 8,
        promoted: 0,
        reviewUpdated: 1,
      })
      await expect(readStoredReviews(prisma)).resolves.toMatchObject({
        relation: {
          checkedBy: ['reviewer-alpha', 'reviewer-beta', 'reviewer-gamma'],
          checkedAt: '2026-08-05',
        },
        measurement: {
          checkedBy: ['reviewer-alpha', 'reviewer-beta', 'reviewer-gamma'],
          checkedAt: '2026-08-05',
          externalMetadataKey: { owner: 'outside-seed' },
        },
      })
    } finally {
      removeVerifiedData(directory)
    }
  })

  it('rejects reviewer removal from relation evidence', async () => {
    const directory = createCompletedTestData()
    setRelationReview(
      directory,
      ['reviewer-alpha', 'reviewer-beta'],
      '2026-08-05',
    )
    try {
      await expect(
        seedVerifiedData(prisma, await loadVerifiedData(directory), {
          testOnlyIdPrefix: TEST_PREFIX,
        }),
      ).rejects.toMatchObject({ code: 'VERIFIED_SEED_CONFLICT' })
      await expect(readStoredReviews(prisma)).resolves.toMatchObject({
        relation: { checkedAt: '2026-08-05' },
      })
    } finally {
      removeVerifiedData(directory)
    }
  })

  it('rejects reviewer replacement in measurement metadata', async () => {
    const directory = createCompletedTestData()
    setRelationReview(
      directory,
      ['reviewer-alpha', 'reviewer-beta', 'reviewer-gamma'],
      '2026-08-05',
    )
    setMeasurementReview(
      directory,
      ['reviewer-alpha', 'reviewer-beta', 'reviewer-delta'],
      '2026-08-05',
    )
    try {
      await expect(
        seedVerifiedData(prisma, await loadVerifiedData(directory), {
          testOnlyIdPrefix: TEST_PREFIX,
        }),
      ).rejects.toMatchObject({ code: 'VERIFIED_SEED_CONFLICT' })
      await expect(readStoredReviews(prisma)).resolves.toMatchObject({
        measurement: {
          checkedBy: ['reviewer-alpha', 'reviewer-beta', 'reviewer-gamma'],
        },
      })
    } finally {
      removeVerifiedData(directory)
    }
  })

  it('rejects a checkedAt backdate in measurement metadata', async () => {
    const directory = createCompletedTestData()
    setRelationReview(
      directory,
      ['reviewer-alpha', 'reviewer-beta', 'reviewer-gamma'],
      '2026-08-05',
    )
    setMeasurementReview(
      directory,
      ['reviewer-alpha', 'reviewer-beta', 'reviewer-gamma'],
      '2026-08-04',
    )
    try {
      await expect(
        seedVerifiedData(prisma, await loadVerifiedData(directory), {
          testOnlyIdPrefix: TEST_PREFIX,
        }),
      ).rejects.toMatchObject({ code: 'VERIFIED_SEED_CONFLICT' })
      await expect(readStoredReviews(prisma)).resolves.toMatchObject({
        measurement: { checkedAt: '2026-08-05' },
      })
    } finally {
      removeVerifiedData(directory)
    }
  })
})

function createCompletedTestData(): string {
  const directory = copyVerifiedData()
  namespaceVerifiedData(directory)
  completeHumanReview(directory)
  return directory
}

function setRelationReview(
  directory: string,
  checkedBy: string[],
  checkedAt: string,
): void {
  mutateFixture<RelationFixture>(
    directory,
    'atyrau-2025-09-station-relations.json',
    (fixture) => {
      const relation = fixture.relations.find(
        ({ id }) => id === `${TEST_PREFIX}rel-sep-asa-pair`,
      )
      if (!relation) throw new Error('Expected paired relation fixture')
      relation.checkedBy = checkedBy
      relation.checkedAt = checkedAt
    },
  )
}

function setMeasurementReview(
  directory: string,
  checkedBy: string[],
  checkedAt: string,
): void {
  mutateFixture<MeasurementFixture>(
    directory,
    'atyrau-2025-09.json',
    (fixture) => {
      const measurement = fixture.measurements.find(
        ({ id }) => id === `${TEST_PREFIX}m-2025-09-1km-above-atyrau`,
      )
      if (!measurement) throw new Error('Expected measurement fixture')
      measurement.checkedBy = checkedBy
      measurement.checkedAt = checkedAt
    },
  )
}

async function readStoredReviews(prisma: PrismaClient): Promise<{
  relation: { checkedBy: unknown; checkedAt: string }
  measurement: { checkedBy?: unknown; checkedAt?: unknown }
}> {
  const [relation, measurement] = await Promise.all([
    prisma.stationRelationEvidence.findUniqueOrThrow({
      where: { id: `${TEST_PREFIX}rel-sep-asa-pair` },
      select: { checkedBy: true, checkedAt: true },
    }),
    prisma.measurement.findUniqueOrThrow({
      where: { id: `${TEST_PREFIX}m-2025-09-1km-above-atyrau` },
      select: { metadata: true },
    }),
  ])
  if (
    typeof measurement.metadata !== 'object' ||
    measurement.metadata === null ||
    Array.isArray(measurement.metadata)
  ) {
    throw new Error('Expected measurement review metadata')
  }
  return {
    relation,
    measurement: measurement.metadata,
  }
}

async function cleanupTestRecords(prisma: PrismaClient): Promise<void> {
  await prisma.measurement.deleteMany({
    where: { id: { startsWith: TEST_PREFIX } },
  })
  await prisma.stationRelationEvidence.deleteMany({
    where: { id: { startsWith: TEST_PREFIX } },
  })
  await prisma.stationRelation.deleteMany({
    where: { id: { startsWith: TEST_PREFIX } },
  })
  await prisma.station.deleteMany({
    where: { id: { startsWith: TEST_PREFIX } },
  })
  await prisma.sourceDocument.deleteMany({
    where: { id: { startsWith: TEST_PREFIX } },
  })
}

async function countTestRecords(prisma: PrismaClient): Promise<{
  documents: number
  stations: number
  relations: number
  relationEvidence: number
  measurements: number
}> {
  const [documents, stations, relations, relationEvidence, measurements] =
    await Promise.all([
      prisma.sourceDocument.count({ where: { id: { startsWith: TEST_PREFIX } } }),
      prisma.station.count({ where: { id: { startsWith: TEST_PREFIX } } }),
      prisma.stationRelation.count({ where: { id: { startsWith: TEST_PREFIX } } }),
      prisma.stationRelationEvidence.count({
        where: { id: { startsWith: TEST_PREFIX } },
      }),
      prisma.measurement.count({ where: { id: { startsWith: TEST_PREFIX } } }),
    ])
  return { documents, stations, relations, relationEvidence, measurements }
}

async function relationSnapshot(prisma: PrismaClient): Promise<unknown> {
  return prisma.stationRelation.findMany({
    where: { id: { startsWith: TEST_PREFIX } },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      fromStationId: true,
      toStationId: true,
      sourceDocumentId: true,
      notes: true,
      verificationStatus: true,
      evidence: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          sourceDocumentId: true,
          sourcePage: true,
          basis: true,
          sourceExcerpt: true,
          verificationStatus: true,
        },
      },
    },
  })
}

async function parentRelationSnapshot(prisma: PrismaClient): Promise<unknown> {
  return prisma.stationRelation.findMany({
    where: { id: { startsWith: TEST_PREFIX } },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      fromStationId: true,
      toStationId: true,
      kind: true,
      sourceDocumentId: true,
      notes: true,
      verificationStatus: true,
    },
  })
}

function assertNotSupabase(value: string): void {
  const hostname = new URL(value).hostname.toLowerCase()
  if (
    hostname === 'supabase.co' ||
    hostname === 'pooler.supabase.com' ||
    hostname.endsWith('.supabase.co') ||
    hostname.endsWith('.pooler.supabase.com')
  ) {
    throw new Error('Supabase targets are forbidden for seed DB e2e')
  }
}
