import {
  mkdtempSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  ExtractionMode,
  SourceDocumentStatus,
  VerificationStatus,
} from '../../src/generated/prisma/enums'
import { loadVerifiedData } from '../../prisma/seed/verified-data.loader'
import {
  knownDocumentIds,
  mapVerifiedData,
} from '../../prisma/seed/verified-data.mapper'
import {
  assertHumanReviewComplete,
  isHumanReviewer,
} from '../../prisma/seed/verified-data.policy'
import {
  mergeMonotonicReview,
  seedVerifiedData,
  type VerifiedSeedClient,
} from '../../prisma/seed/verified-seed.service'
import type { Prisma } from '../../src/generated/prisma/client'
import {
  completeHumanReview,
  copyVerifiedData,
  createOutsideSymlink,
  addRelationEvidenceFixture,
  mutateFixture,
  removeVerifiedData,
  reverseManifestFixtures,
  setHumanReview,
} from './verified-seed-test-data'

interface Manifest {
  reviewPolicy: {
    requiredHumanReviewers: number
    completedHumanReviewers: number
    status: string
  }
  fixtures: Array<{
    path: string
    documentSha256: string
    sourcePage: number | null
  }>
}

interface MeasurementFixture {
  document: { id: string; sha256: string; sourcePage: number | null }
  measurements: Array<{
    id: string
    stationId: string
    stationLabel: string
    rawValueText: string
    normalizedValue: string
    sampledAt: string | null
    sampledPeriod: string | null
    sourceSha256: string
    sourcePage: number | null
    sourceExcerpt: string
    checkedBy: string[]
  }>
}

interface RelationFixture {
  document: { sha256: string; sourcePage: number | null }
  relations: Array<{
    id: string
    upstreamStationId: string
    downstreamStationId: string
    basis: string
    sourceSha256: string
    sourcePage: number | null
    checkedBy: string[]
  }>
}

const temporaryDirectories: string[] = []

function fixtureDirectory(): string {
  const directory = copyVerifiedData()
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    removeVerifiedData(directory)
  }
})

describe('verified data loader and schemas', () => {
  it('accepts the current structurally valid manifest', async () => {
    const data = await loadVerifiedData()
    expect(data.measurements).toHaveLength(9)
    expect(data.relations).toHaveLength(4)
    expect(data.documents).toHaveLength(2)
  })

  it.each(['../outside.json', '/tmp/outside.json', 'C:\\outside.json'])(
    'rejects an unsafe manifest path %s',
    async (path) => {
      const directory = fixtureDirectory()
      mutateFixture<Manifest>(directory, 'manifest.json', (manifest) => {
        manifest.fixtures[0]!.path = path
      })
      await expect(loadVerifiedData(directory)).rejects.toMatchObject({
        code: 'VERIFIED_DATA_PATH_INVALID',
      })
    },
  )

  it('rejects a symlink that resolves outside verified data', async () => {
    const directory = fixtureDirectory()
    const outside = mkdtempSync(join(tmpdir(), 'caspian-seed-outside-'))
    temporaryDirectories.push(outside)
    const target = join(outside, 'fixture.json')
    writeFileSync(target, '{}')
    createOutsideSymlink(directory, 'escape.json', target)
    mutateFixture<Manifest>(directory, 'manifest.json', (manifest) => {
      manifest.fixtures[0]!.path = 'escape.json'
    })
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_PATH_INVALID',
    })
  })

  it.each(['a'.repeat(63), 'A'.repeat(64)])(
    'rejects invalid SHA-256 %s',
    async (sha256) => {
      const directory = fixtureDirectory()
      mutateFixture<Manifest>(directory, 'manifest.json', (manifest) => {
        manifest.fixtures[0]!.documentSha256 = sha256
      })
      await expect(loadVerifiedData(directory)).rejects.toMatchObject({
        code: 'VERIFIED_DATA_SCHEMA_INVALID',
      })
    },
  )

  it('rejects page zero', async () => {
    const directory = fixtureDirectory()
    mutateFixture<Manifest>(directory, 'manifest.json', (manifest) => {
      manifest.fixtures[0]!.sourcePage = 0
    })
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it('rejects surrounding whitespace in a document ID', async () => {
    const directory = fixtureDirectory()
    mutateFixture<MeasurementFixture>(directory, 'atyrau-2025-09.json', (fixture) => {
      fixture.document.id = ` ${fixture.document.id}`
    })
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it('rejects surrounding whitespace in a measurement ID', async () => {
    const directory = fixtureDirectory()
    mutateFixture<MeasurementFixture>(directory, 'atyrau-2025-09.json', (fixture) => {
      fixture.measurements[0]!.id = `${fixture.measurements[0]!.id} `
    })
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it('rejects surrounding whitespace in a station ID', async () => {
    const directory = fixtureDirectory()
    mutateFixture<MeasurementFixture>(directory, 'atyrau-2025-09.json', (fixture) => {
      fixture.measurements[0]!.stationId = ` ${fixture.measurements[0]!.stationId}`
    })
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it('rejects surrounding whitespace in a relation ID', async () => {
    const directory = fixtureDirectory()
    mutateFixture<RelationFixture>(
      directory,
      'atyrau-2025-09-station-relations.json',
      (fixture) => {
        fixture.relations[0]!.id = ` ${fixture.relations[0]!.id}`
      },
    )
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it('rejects an invalid year-month', async () => {
    const directory = fixtureDirectory()
    mutateFixture<MeasurementFixture>(
      directory,
      'atyrau-2025-09.json',
      (fixture) => {
        fixture.measurements[0]!.sampledPeriod = '2025-13'
      },
    )
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it.each([
    { sampledAt: '2025-09-01', sampledPeriod: '2025-09' },
    { sampledAt: null, sampledPeriod: null },
  ])('requires sampledAt xor sampledPeriod', async (sampleTime) => {
    const directory = fixtureDirectory()
    mutateFixture<MeasurementFixture>(
      directory,
      'atyrau-2025-09.json',
      (fixture) => Object.assign(fixture.measurements[0]!, sampleTime),
    )
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it.each(['1e-3', '00.234', '0.230'])('rejects non-canonical decimal %s', async (value) => {
    const directory = fixtureDirectory()
    mutateFixture<MeasurementFixture>(
      directory,
      'atyrau-2025-09.json',
      (fixture) => {
        fixture.measurements[0]!.normalizedValue = value
      },
    )
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it('rejects raw and normalized values that represent different Decimals', async () => {
    const directory = fixtureDirectory()
    mutateFixture<MeasurementFixture>(
      directory,
      'atyrau-2025-09.json',
      (fixture) => {
        fixture.measurements[0]!.rawValueText = '0,235'
      },
    )
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it.each(['rawValueText', 'sourceExcerpt', 'stationLabel'] as const)(
    'rejects surrounding whitespace mutation in %s without trimming it',
    async (field) => {
      const directory = fixtureDirectory()
      mutateFixture<MeasurementFixture>(
        directory,
        'atyrau-2025-09.json',
        (fixture) => {
          const measurement = fixture.measurements[0]!
          measurement[field] = ` ${measurement[field]}`
        },
      )
      await expect(loadVerifiedData(directory)).rejects.toMatchObject({
        code: 'VERIFIED_DATA_SCHEMA_INVALID',
      })
    },
  )

  it('rejects duplicate measurement IDs across fixtures', async () => {
    const directory = fixtureDirectory()
    mutateFixture<MeasurementFixture>(directory, 'atyrau-2025-05.json', (fixture) => {
      fixture.measurements[0]!.id = 'm-2025-09-1km-above-atyrau'
    })
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it('rejects duplicate directed edges in one source document', async () => {
    const directory = fixtureDirectory()
    mutateFixture<RelationFixture>(
      directory,
      'atyrau-2025-09-station-relations.json',
      (fixture) => {
        fixture.relations[2]!.upstreamStationId =
          fixture.relations[0]!.upstreamStationId
        fixture.relations[2]!.downstreamStationId =
          fixture.relations[0]!.downstreamStationId
      },
    )
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it('accepts relation evidence for the same document, edge, and basis on another page', async () => {
    const directory = fixtureDirectory()
    addRelationEvidenceFixture(directory, {
      filename: 'test-relation-page-23.json',
      id: 'rel-test-page-23',
      sourcePage: 23,
    })
    const loaded = await loadVerifiedData(directory)
    expect(
      loaded.relations.find(({ id }) => id === 'rel-test-page-23'),
    ).toMatchObject({ sourcePage: 23 })
  })

  it('rejects relation evidence with the same document, edge, basis, and page', async () => {
    const directory = fixtureDirectory()
    addRelationEvidenceFixture(directory, {
      filename: 'test-relation-duplicate-page.json',
      id: 'rel-test-duplicate-page',
      sourcePage: 22,
    })
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it('treats null as one strict relation evidence page value', async () => {
    const directory = fixtureDirectory()
    addRelationEvidenceFixture(directory, {
      filename: 'test-relation-null-page-a.json',
      id: 'rel-test-null-page-a',
      sourcePage: null,
    })
    const loaded = await loadVerifiedData(directory)
    expect(
      loaded.relations.find(({ id }) => id === 'rel-test-null-page-a'),
    ).toMatchObject({ sourcePage: null })
    addRelationEvidenceFixture(directory, {
      filename: 'test-relation-null-page-b.json',
      id: 'rel-test-null-page-b',
      sourcePage: null,
    })
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it('rejects self relations', async () => {
    const directory = fixtureDirectory()
    mutateFixture<RelationFixture>(
      directory,
      'atyrau-2025-09-station-relations.json',
      (fixture) => {
        fixture.relations[0]!.downstreamStationId =
          fixture.relations[0]!.upstreamStationId
      },
    )
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it('rejects document SHA mismatch with manifest', async () => {
    const directory = fixtureDirectory()
    mutateFixture<MeasurementFixture>(
      directory,
      'atyrau-2025-09.json',
      (fixture) => {
        fixture.document.sha256 = 'b'.repeat(64)
      },
    )
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it('rejects item SHA mismatch with document', async () => {
    const directory = fixtureDirectory()
    mutateFixture<MeasurementFixture>(
      directory,
      'atyrau-2025-09.json',
      (fixture) => {
        fixture.measurements[0]!.sourceSha256 = 'b'.repeat(64)
      },
    )
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it('rejects item page mismatch with document', async () => {
    const directory = fixtureDirectory()
    mutateFixture<MeasurementFixture>(
      directory,
      'atyrau-2025-09.json',
      (fixture) => {
        fixture.measurements[0]!.sourcePage = 21
      },
    )
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it('rejects an unknown relation basis', async () => {
    const directory = fixtureDirectory()
    mutateFixture<RelationFixture>(
      directory,
      'atyrau-2025-09-station-relations.json',
      (fixture) => {
        fixture.relations[0]!.basis = 'table_order_guess'
      },
    )
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it('rejects one station ID with two labels', async () => {
    const directory = fixtureDirectory()
    mutateFixture<MeasurementFixture>(directory, 'atyrau-2025-05.json', (fixture) => {
      fixture.measurements[0]!.stationLabel = 'Changed label'
    })
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'SEED_CONFLICT_STATION_LABEL',
    })
  })
})

describe('human review gate', () => {
  it('does not count automated or bot placeholders as humans', () => {
    expect(isHumanReviewer('codex-automated-source-verification')).toBe(false)
    expect(isHumanReviewer('service')).toBe(false)
    expect(isHumanReviewer('dependabot[bot]')).toBe(false)
    expect(isHumanReviewer('agent-reviewer')).toBe(false)
    expect(isHumanReviewer('automated-reviewer')).toBe(false)
    expect(isHumanReviewer('system-reviewer')).toBe(false)
    expect(isHumanReviewer('test-reviewer')).toBe(false)
    expect(isHumanReviewer('reviewer-codex2')).toBe(false)
    expect(isHumanReviewer('reviewer-bot42')).toBe(false)
    expect(isHumanReviewer('reviewer-test-account')).toBe(false)
    expect(isHumanReviewer('reviewer_name')).toBe(false)
    expect(isHumanReviewer('real-reviewer')).toBe(true)
  })

  it('recalculates the current handoff as 0/2 pending', async () => {
    const data = await loadVerifiedData()
    expect(data.humanReview).toEqual({ required: 2, completed: 0, complete: false })
  })

  it.each([
    ['1/1', ['reviewer-alpha']],
    ['3/3', ['reviewer-alpha', 'reviewer-beta', 'reviewer-gamma']],
  ])('rejects a complete version 1 manifest with %s policy', async (_, reviewers) => {
    const directory = fixtureDirectory()
    setHumanReview(directory, reviewers)
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_SCHEMA_INVALID',
    })
  })

  it('rejects a manifest that lies about the completed count', async () => {
    const directory = fixtureDirectory()
    mutateFixture<Manifest>(directory, 'manifest.json', (manifest) => {
      manifest.reviewPolicy.completedHumanReviewers = 2
    })
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_HUMAN_REVIEW_INVALID',
    })
  })

  it('rejects complete status without enough reviewers', async () => {
    const directory = fixtureDirectory()
    mutateFixture<Manifest>(directory, 'manifest.json', (manifest) => {
      manifest.reviewPolicy.status = 'complete'
    })
    await expect(loadVerifiedData(directory)).rejects.toMatchObject({
      code: 'VERIFIED_DATA_HUMAN_REVIEW_INVALID',
    })
  })

  it('strict seed rejects pending review before transaction access', async () => {
    class NoTransactionClient implements VerifiedSeedClient {
      called = false

      $transaction<T>(
        operation: (transaction: Prisma.TransactionClient) => Promise<T>,
        options: { maxWait: number; timeout: number },
      ): Promise<T> {
        void operation
        void options
        this.called = true
        return Promise.reject(new Error('Database must not be reached'))
      }
    }
    const client = new NoTransactionClient()
    await expect(seedVerifiedData(client, await loadVerifiedData())).rejects.toMatchObject({
      code: 'VERIFIED_DATA_HUMAN_REVIEW_INCOMPLETE',
    })
    expect(client.called).toBe(false)
  })

  it('validate-only loader accepts structurally valid pending handoff', async () => {
    await expect(loadVerifiedData()).resolves.toMatchObject({
      humanReview: { complete: false },
    })
  })

  it('accepts the fixed version 1 policy with 2/2 reviewers', async () => {
    const directory = fixtureDirectory()
    completeHumanReview(directory)
    const data = await loadVerifiedData(directory)
    expect(() => assertHumanReviewComplete(data.humanReview)).not.toThrow()
  })
})

describe('monotonic review updates', () => {
  it('accepts order and case changes without mutating stored reviewers', () => {
    expect(
      mergeMonotonicReview(
        ['Reviewer-Alpha', 'reviewer-beta'],
        '2026-08-04',
        ['REVIEWER-BETA', 'reviewer-alpha'],
        '2026-08-04',
      ),
    ).toEqual({
      checkedBy: ['Reviewer-Alpha', 'reviewer-beta'],
      checkedAt: '2026-08-04',
      updated: false,
    })
  })

  it('adds a new reviewer and advances checkedAt', () => {
    expect(
      mergeMonotonicReview(
        ['reviewer-alpha', 'reviewer-beta'],
        '2026-08-04',
        ['reviewer-beta', 'reviewer-gamma', 'reviewer-alpha'],
        '2026-08-05',
      ),
    ).toEqual({
      checkedBy: ['reviewer-alpha', 'reviewer-beta', 'reviewer-gamma'],
      checkedAt: '2026-08-05',
      updated: true,
    })
  })

  it.each([
    {
      name: 'reviewer removal',
      reviewers: ['reviewer-alpha'],
      checkedAt: '2026-08-05',
    },
    {
      name: 'reviewer replacement',
      reviewers: ['reviewer-alpha', 'reviewer-gamma'],
      checkedAt: '2026-08-05',
    },
    {
      name: 'checkedAt backdate',
      reviewers: ['reviewer-alpha', 'reviewer-beta'],
      checkedAt: '2026-08-03',
    },
  ])('rejects $name', ({ reviewers, checkedAt }) => {
    expect(() =>
      mergeMonotonicReview(
        ['reviewer-alpha', 'reviewer-beta'],
        '2026-08-04',
        reviewers,
        checkedAt,
      ),
    ).toThrow('Existing record conflicts with immutable')
  })
})

describe('verified data mapping and relation trust policy', () => {
  it('constructs Decimal from normalized strings and preserves raw comma text', async () => {
    const directory = fixtureDirectory()
    completeHumanReview(directory)
    const mapped = mapVerifiedData(await loadVerifiedData(directory))
    const measurement = mapped.measurements.find(
      ({ id }) => id === 'm-2025-09-1km-above-atyrau',
    )
    expect(measurement?.value.toString()).toBe('0.234')
    expect(measurement?.rawValueText).toBe('0,234')
  })

  it('keeps unknown geography, river order, fetched time, cache, and source page row null', async () => {
    const directory = fixtureDirectory()
    completeHumanReview(directory)
    const mapped = mapVerifiedData(await loadVerifiedData(directory))
    expect(mapped.stations.every(({ latitude, longitude }) => latitude === null && longitude === null)).toBe(true)
    expect(mapped.stations.every(({ riverOrder }) => riverOrder === null)).toBe(true)
    expect(mapped.documents.every(({ fetchedAt, cachePath }) => fetchedAt === null && cachePath === null)).toBe(true)
    expect(mapped.measurements.every(({ sourcePageId }) => sourcePageId === null)).toBe(true)
  })

  it('keeps documents unverified without fetched snapshots', async () => {
    const directory = fixtureDirectory()
    completeHumanReview(directory)
    const mapped = mapVerifiedData(await loadVerifiedData(directory))
    expect(mapped.documents.every(({ status }) => status === SourceDocumentStatus.UNVERIFIED)).toBe(true)
  })

  it('maps explicit Prisma enums without exposing guessed values', async () => {
    const directory = fixtureDirectory()
    completeHumanReview(directory)
    const mapped = mapVerifiedData(await loadVerifiedData(directory))
    expect(mapped.measurements.every(({ extractionMode }) => extractionMode === ExtractionMode.VERIFIED_SEED)).toBe(true)
    expect(mapped.measurements.every(({ verificationStatus }) => verificationStatus === VerificationStatus.OFFICIAL)).toBe(true)
  })

  it('does not verify any pending measurement or relation', async () => {
    const mapped = mapVerifiedData(await loadVerifiedData())
    expect(mapped.measurements.every(({ verificationStatus }) => verificationStatus === VerificationStatus.UNVERIFIED)).toBe(true)
    expect(mapped.relations.every(({ verificationStatus }) => verificationStatus === VerificationStatus.UNVERIFIED)).toBe(true)
  })

  it('verifies paired labels only after complete review and keeps sequence edges pending', async () => {
    const directory = fixtureDirectory()
    completeHumanReview(directory)
    const mapped = mapVerifiedData(await loadVerifiedData(directory))
    const statuses = mapped.relationEvidence.map(({ id, verificationStatus }) => ({ id, verificationStatus }))
    expect(statuses).toContainEqual({
      id: 'rel-sep-asa-pair',
      verificationStatus: VerificationStatus.OFFICIAL,
    })
    expect(statuses).toContainEqual({
      id: 'rel-sep-city-to-asa-above',
      verificationStatus: VerificationStatus.UNVERIFIED,
    })
    expect(mapped.relations).toHaveLength(3)
    expect(
      mapped.relations.every(
        ({ sourceDocumentId, notes }) =>
          sourceDocumentId === null && notes === null,
      ),
    ).toBe(true)
    expect(mapped.relationEvidence).toHaveLength(4)
    expect(
      mapped.relationEvidence.filter(
        ({ verificationStatus }) =>
          verificationStatus === VerificationStatus.OFFICIAL,
      ),
    ).toHaveLength(2)
  })

  it('maps semantic relations and all evidence independently of manifest order', async () => {
    const firstDirectory = fixtureDirectory()
    const secondDirectory = fixtureDirectory()
    completeHumanReview(firstDirectory)
    completeHumanReview(secondDirectory)
    reverseManifestFixtures(secondDirectory)
    const first = mapVerifiedData(await loadVerifiedData(firstDirectory))
    const second = mapVerifiedData(await loadVerifiedData(secondDirectory))
    expect(second.relations).toEqual(first.relations)
    expect(second.relationEvidence).toEqual(first.relationEvidence)
  })

  it('has a catalog entry for every current source document', async () => {
    const currentIds = (await loadVerifiedData()).documents.map(({ id }) => id).sort()
    expect(knownDocumentIds()).toEqual(currentIds)
  })
})
