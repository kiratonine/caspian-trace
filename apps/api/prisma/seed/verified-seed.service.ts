import type { Prisma } from '../../src/generated/prisma/client'
import {
  VerificationStatus,
} from '../../src/generated/prisma/enums'

import { assertHumanReviewComplete } from './verified-data.policy'
import {
  mapVerifiedData,
  type MappedDocument,
  type MappedMeasurement,
  type MappedRelation,
  type MappedRelationEvidence,
  type MappedStation,
  type VerifiedDataMappingOptions,
} from './verified-data.mapper'
import { VerifiedSeedError } from './verified-seed.errors'
import type {
  LoadedVerifiedData,
  SeedEntitySummary,
  VerifiedSeedSummary,
} from './verified-seed.types'

export async function seedVerifiedData(
  prisma: VerifiedSeedClient,
  data: LoadedVerifiedData,
  options: VerifiedDataMappingOptions = {},
): Promise<VerifiedSeedSummary> {
  assertHumanReviewComplete(data.humanReview)
  const mapped = mapVerifiedData(data, options)

  return prisma.$transaction(
    async (transaction) => {
      const documents = emptySummary()
      const stations = { created: 0, updated: 0, unchanged: 0 }
      const relations = {
        ...emptySummary(),
        evidenceCreated: 0,
        evidenceUnchanged: 0,
        evidencePromoted: 0,
        evidenceReviewUpdated: 0,
        verifiedEvidence: 0,
        pendingEvidence: 0,
        omitted: 0 as const,
      }
      const measurements = { ...emptySummary(), reviewUpdated: 0 }

      for (const document of mapped.documents) {
        await seedDocument(transaction, document, documents)
      }
      for (const station of mapped.stations) {
        await seedStation(transaction, station, stations)
      }
      for (const relation of mapped.relations) {
        await seedRelation(transaction, relation, relations)
      }
      for (const evidence of mapped.relationEvidence) {
        const outcome = await seedRelationEvidence(transaction, evidence)
        if (outcome.created) relations.evidenceCreated += 1
        if (outcome.unchanged) relations.evidenceUnchanged += 1
        if (outcome.promoted) relations.evidencePromoted += 1
        if (outcome.reviewUpdated) relations.evidenceReviewUpdated += 1
        if (
          evidence.verificationStatus ===
          VerificationStatus.UNVERIFIED
        ) {
          relations.pendingEvidence += 1
        } else {
          relations.verifiedEvidence += 1
        }
      }
      for (const measurement of mapped.measurements) {
        await seedMeasurement(transaction, measurement, measurements)
      }

      return {
        documents,
        stations,
        relations,
        measurements,
        humanReviewers: data.humanReview.completed,
      }
    },
    { maxWait: 10_000, timeout: 30_000 },
  )
}

export interface VerifiedSeedClient {
  $transaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
    options: { maxWait: number; timeout: number },
  ): Promise<T>
}

interface SeedReviewOutcome {
  created: boolean
  unchanged: boolean
  promoted: boolean
  reviewUpdated: boolean
}

export interface MonotonicReviewResult {
  checkedBy: string[]
  checkedAt: string
  updated: boolean
}

export function mergeMonotonicReview(
  existingCheckedBy: unknown,
  existingCheckedAt: string,
  expectedCheckedBy: readonly string[],
  expectedCheckedAt: string,
): MonotonicReviewResult {
  if (
    !Array.isArray(existingCheckedBy) ||
    existingCheckedBy.some((reviewer) => typeof reviewer !== 'string')
  ) {
    throw conflict('reviewer metadata')
  }
  if (expectedCheckedAt < existingCheckedAt) {
    throw conflict('review date')
  }

  const existingReviewers = existingCheckedBy as string[]
  const expectedByKey = new Map(
    expectedCheckedBy.map((reviewer) => [reviewer.toLowerCase(), reviewer]),
  )
  for (const reviewer of existingReviewers) {
    if (!expectedByKey.has(reviewer.toLowerCase())) {
      throw conflict('reviewers')
    }
  }

  const existingKeys = new Set(
    existingReviewers.map((reviewer) => reviewer.toLowerCase()),
  )
  const addedReviewers = expectedCheckedBy.filter(
    (reviewer) => !existingKeys.has(reviewer.toLowerCase()),
  )
  const checkedAtChanged = expectedCheckedAt > existingCheckedAt
  return {
    checkedBy: [...existingReviewers, ...addedReviewers],
    checkedAt: checkedAtChanged ? expectedCheckedAt : existingCheckedAt,
    updated: addedReviewers.length > 0 || checkedAtChanged,
  }
}

function emptySummary(): SeedEntitySummary {
  return { created: 0, unchanged: 0, promoted: 0 }
}

async function seedDocument(
  transaction: Prisma.TransactionClient,
  expected: MappedDocument,
  summary: SeedEntitySummary,
): Promise<void> {
  const existing = await transaction.sourceDocument.findUnique({
    where: { id: expected.id },
    select: {
      id: true,
      originalUrl: true,
      canonicalUrl: true,
      sha256: true,
      publishedPeriod: true,
    },
  })
  if (!existing) {
    await transaction.sourceDocument.create({ data: expected })
    summary.created += 1
    return
  }
  assertEqual(existing.originalUrl, expected.originalUrl, 'document original URL')
  assertEqual(existing.canonicalUrl, expected.canonicalUrl, 'document canonical URL')
  assertEqual(existing.sha256, expected.sha256, 'document SHA-256')
  assertEqual(
    existing.publishedPeriod,
    expected.publishedPeriod,
    'document published period',
  )
  summary.unchanged += 1
}

async function seedStation(
  transaction: Prisma.TransactionClient,
  expected: MappedStation,
  summary: { created: number; updated: number; unchanged: number },
): Promise<void> {
  const existing = await transaction.station.findUnique({
    where: { id: expected.id },
    select: {
      id: true,
      name: true,
      waterBody: true,
      region: true,
      riverOrder: true,
    },
  })
  if (!existing) {
    await transaction.station.create({ data: expected })
    summary.created += 1
    return
  }
  if (existing.name !== expected.name) {
    throw new VerifiedSeedError(
      'SEED_CONFLICT_STATION_LABEL',
      `Station ${expected.id} has a conflicting label`,
    )
  }
  assertEqual(existing.waterBody, expected.waterBody, 'station water body')
  assertEqual(existing.region, expected.region, 'station region')
  if (existing.riverOrder !== expected.riverOrder) {
    await transaction.station.update({
      where: { id: expected.id },
      data: { riverOrder: expected.riverOrder },
    })
    summary.updated += 1
    return
  }
  summary.unchanged += 1
}

async function seedRelation(
  transaction: Prisma.TransactionClient,
  expected: MappedRelation,
  summary: SeedEntitySummary,
): Promise<void> {
  const existing = await transaction.stationRelation.findUnique({
    where: { id: expected.id },
    select: {
      fromStationId: true,
      toStationId: true,
      kind: true,
      verificationStatus: true,
    },
  })
  if (!existing) {
    await transaction.stationRelation.create({ data: expected })
    summary.created += 1
    return
  }
  assertEqual(existing.fromStationId, expected.fromStationId, 'relation from station')
  assertEqual(existing.toStationId, expected.toStationId, 'relation to station')
  assertEqual(existing.kind, expected.kind, 'relation kind')
  if (existing.verificationStatus === expected.verificationStatus) {
    summary.unchanged += 1
    return
  }
  if (
    canPromoteVerificationStatus(
      existing.verificationStatus,
      expected.verificationStatus,
    )
  ) {
    await transaction.stationRelation.update({
      where: { id: expected.id },
      data: {
        verificationStatus:
          expected.verificationStatus,
      },
    })

    summary.promoted += 1
    return
  }
  throw conflict('relation verification status')
}

async function seedRelationEvidence(
  transaction: Prisma.TransactionClient,
  expected: MappedRelationEvidence,
): Promise<SeedReviewOutcome> {
  const existing = await transaction.stationRelationEvidence.findUnique({
    where: { id: expected.id },
    select: {
      stationRelationId: true,
      sourceDocumentId: true,
      sourcePage: true,
      basis: true,
      sourceExcerpt: true,
      checkedBy: true,
      checkedAt: true,
      verificationStatus: true,
    },
  })
  if (!existing) {
    await transaction.stationRelationEvidence.create({ data: expected })
    return { created: true, unchanged: false, promoted: false, reviewUpdated: false }
  }
  assertEqual(
    existing.stationRelationId,
    expected.stationRelationId,
    'relation evidence edge',
  )
  assertEqual(
    existing.sourceDocumentId,
    expected.sourceDocumentId,
    'relation evidence document',
  )
  assertEqual(existing.sourcePage, expected.sourcePage, 'relation evidence page')
  assertEqual(existing.basis, expected.basis, 'relation evidence basis')
  assertEqual(
    existing.sourceExcerpt,
    expected.sourceExcerpt,
    'relation evidence excerpt',
  )
  const review = mergeMonotonicReview(
    existing.checkedBy,
    existing.checkedAt,
    expected.checkedBy,
    expected.checkedAt,
  )
  if (existing.verificationStatus === expected.verificationStatus) {
    if (review.updated) {
      await transaction.stationRelationEvidence.update({
        where: { id: expected.id },
        data: { checkedBy: review.checkedBy, checkedAt: review.checkedAt },
      })
    }
    return {
      created: false,
      unchanged: !review.updated,
      promoted: false,
      reviewUpdated: review.updated,
    }
  }
  if (
    canPromoteVerificationStatus(
      existing.verificationStatus,
      expected.verificationStatus,
    )
  ) {
    await transaction.stationRelationEvidence.update({
      where: { id: expected.id },
      data: {
        checkedBy: review.checkedBy,
        checkedAt: review.checkedAt,
        verificationStatus:
          expected.verificationStatus,
      },
    })

    return {
      created: false,
      unchanged: false,
      promoted: true,
      reviewUpdated: review.updated,
    }
  }
  throw conflict('relation evidence verification status')
}

function canPromoteVerificationStatus(
  existing: string,
  expected: string,
): boolean {
  if (
    existing === VerificationStatus.CONFLICTING ||
    expected === VerificationStatus.CONFLICTING
  ) {
    return false
  }

  return (
    verificationStatusRank(expected) >
    verificationStatusRank(existing)
  )
}

function verificationStatusRank(
  status: string,
): number {
  switch (status) {
    case VerificationStatus.UNVERIFIED:
      return 0
    case VerificationStatus.CORROBORATED:
      return 1
    case VerificationStatus.OFFICIAL:
      return 2
    case VerificationStatus.CONFLICTING:
      return -1
    default:
      return -1
  }
}

async function seedMeasurement(
  transaction: Prisma.TransactionClient,
  expected: MappedMeasurement,
  summary: SeedEntitySummary & { reviewUpdated: number },
): Promise<void> {
  const existing = await transaction.measurement.findUnique({
    where: { id: expected.id },
    select: {
      stationId: true,
      sourceDocumentId: true,
      indicator: true,
      value: true,
      rawValueText: true,
      unit: true,
      matrix: true,
      sampledAt: true,
      sampledPeriod: true,
      sourceExcerpt: true,
      extractionMode: true,
      verificationStatus: true,
      metadata: true,
    },
  })
  if (!existing) {
    await transaction.measurement.create({ data: expected })
    summary.created += 1
    return
  }
  assertEqual(existing.stationId, expected.stationId, 'measurement station')
  assertEqual(
    existing.sourceDocumentId,
    expected.sourceDocumentId,
    'measurement source document',
  )
  assertEqual(existing.indicator, expected.indicator, 'measurement indicator')
  if (!existing.value.equals(expected.value)) throw conflict('measurement value')
  assertEqual(existing.rawValueText, expected.rawValueText, 'measurement raw value')
  assertEqual(existing.unit, expected.unit, 'measurement unit')
  assertEqual(existing.matrix, expected.matrix, 'measurement matrix')
  assertDateEqual(existing.sampledAt, expected.sampledAt, 'measurement sample date')
  assertEqual(
    existing.sampledPeriod,
    expected.sampledPeriod,
    'measurement sample period',
  )
  assertEqual(existing.sourceExcerpt, expected.sourceExcerpt, 'measurement excerpt')
  assertEqual(
    existing.extractionMode,
    expected.extractionMode,
    'measurement extraction mode',
  )
  assertEqual(
    metadataSourcePage(existing.metadata),
    metadataSourcePage(expected.metadata),
    'measurement source page',
  )
  const existingMetadata = metadataObject(existing.metadata)
  const existingReview = reviewFromMetadata(existingMetadata)
  const expectedReview = reviewFromMetadata(expected.metadata)
  const review = mergeMonotonicReview(
    existingReview.checkedBy,
    existingReview.checkedAt,
    expectedReview.checkedBy,
    expectedReview.checkedAt,
  )
  const nextMetadata: Prisma.InputJsonObject = {
    ...existingMetadata,
    sourcePage: metadataSourcePage(expected.metadata) ?? null,
    checkedBy: review.checkedBy,
    checkedAt: review.checkedAt,
  }
  if (existing.verificationStatus === expected.verificationStatus) {
    if (review.updated) {
      await transaction.measurement.update({
        where: { id: expected.id },
        data: { metadata: nextMetadata },
      })
      summary.reviewUpdated += 1
    } else {
      summary.unchanged += 1
    }
    return
  }
  if (
    expected.verificationStatus === VerificationStatus.OFFICIAL &&
    (existing.verificationStatus === VerificationStatus.UNVERIFIED ||
      existing.verificationStatus === VerificationStatus.CORROBORATED)
  ) {
    await transaction.measurement.update({
      where: { id: expected.id },
      data: {
        verificationStatus: expected.verificationStatus,
        metadata: nextMetadata,
      },
    })
    summary.promoted += 1
    if (review.updated) summary.reviewUpdated += 1
    return
  }
  throw conflict('measurement verification status')
}

function metadataSourcePage(value: unknown): number | null | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  const sourcePage = (value as { sourcePage?: unknown }).sourcePage
  return typeof sourcePage === 'number' || sourcePage === null
    ? sourcePage
    : undefined
}

function metadataObject(value: unknown): Prisma.InputJsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw conflict('measurement metadata')
  }
  return value
}

function reviewFromMetadata(value: unknown): {
  checkedBy: string[]
  checkedAt: string
} {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw conflict('measurement review metadata')
  }
  const metadata = value as {
    checkedBy?: unknown
    checkedAt?: unknown
  }
  if (
    !Array.isArray(metadata.checkedBy) ||
    metadata.checkedBy.some((reviewer) => typeof reviewer !== 'string') ||
    typeof metadata.checkedAt !== 'string'
  ) {
    throw conflict('measurement review metadata')
  }
  return {
    checkedBy: metadata.checkedBy as string[],
    checkedAt: metadata.checkedAt,
  }
}

function assertDateEqual(
  actual: Date | null,
  expected: Date | null,
  field: string,
): void {
  assertEqual(actual?.toISOString() ?? null, expected?.toISOString() ?? null, field)
}

function assertEqual(actual: unknown, expected: unknown, field: string): void {
  if (actual !== expected) throw conflict(field)
}

function conflict(field: string): VerifiedSeedError {
  return new VerifiedSeedError(
    'VERIFIED_SEED_CONFLICT',
    `Existing record conflicts with immutable ${field}`,
  )
}
