import type { Prisma } from '../../src/generated/prisma/client'
import {
  ExtractionMode,
  IncidentStatus,
  Region,
  SourceDocumentStatus,
  VerificationStatus,
} from '../../src/generated/prisma/enums'

import { RuntimeBootstrapError } from './runtime-bootstrap.errors'
import type {
  RuntimeBootstrapCandidatePlan,
  RuntimeBootstrapIncidentPlan,
  RuntimeBootstrapPlan,
  RuntimeBootstrapSignalPlan,
  RuntimeBootstrapSourcePlan,
} from './runtime-bootstrap.plan'
import {
  verifyRuntimeBootstrapPrerequisites,
  type RuntimeBootstrapPrerequisiteSummary,
} from './runtime-bootstrap.prerequisites'

export interface RuntimeBootstrapPersistenceSummary {
  prerequisites: RuntimeBootstrapPrerequisiteSummary
  sourceDocuments: number
  stationRelations: number
  incidents: number
  incidentSignals: number
  incidentSignalLinks: number
  candidateObjects: number
  candidateObjectSources: number
}

export interface RuntimeBootstrapPersistenceClient {
  $transaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
    options: { maxWait: number; timeout: number },
  ): Promise<T>
}

type PrerequisiteVerifier = (
  transaction: Prisma.TransactionClient,
  plan: RuntimeBootstrapPlan,
) => Promise<RuntimeBootstrapPrerequisiteSummary>

export interface RuntimeBootstrapPersistenceOptions {
  verifyPrerequisites?: PrerequisiteVerifier
}

export async function persistRuntimeBootstrapPlan(
  prisma: RuntimeBootstrapPersistenceClient,
  plan: RuntimeBootstrapPlan,
  options: RuntimeBootstrapPersistenceOptions = {},
): Promise<RuntimeBootstrapPersistenceSummary> {
  const verifyPrerequisites =
    options.verifyPrerequisites ?? verifyRuntimeBootstrapPrerequisites

  return prisma.$transaction(
    async (transaction) => {
      const prerequisites = await verifyPrerequisites(transaction, plan)

      for (const source of plan.sourceDocuments) {
        await persistSourceDocument(transaction, source)
      }

      for (const relation of plan.relations) {
        const existing = await transaction.stationRelation.findUnique({
          where: { id: relation.id },
          select: { id: true, metadata: true },
        })

        if (existing === null) {
          throw conflict(`Canonical station relation is missing: ${relation.id}`)
        }

        await transaction.stationRelation.update({
          where: { id: relation.id },
          data: {
            metadata: mergeMetadata(existing.metadata, {
              comparisonPair: relation.comparisonPair,
              runtimeBootstrap: {
                version: 1,
                evidenceIds: relation.evidenceIds,
                sourceDocumentIds: relation.sourceDocumentIds,
              },
            }),
          },
        })
      }

      for (const incident of plan.incidents) {
        await persistIncident(transaction, incident)
      }

      for (const signal of plan.signals) {
        await persistSignal(transaction, signal)
      }

      for (const link of plan.signalLinks) {
        await transaction.incidentSignalLink.upsert({
          where: {
            incidentId_signalId: {
              incidentId: link.incidentId,
              signalId: link.signalId,
            },
          },
          create: {
            incidentId: link.incidentId,
            signalId: link.signalId,
          },
          update: {},
        })
      }

      for (const candidate of plan.candidateObjects) {
        await persistCandidateObject(transaction, candidate)
      }

      for (const link of plan.candidateSources) {
        await transaction.candidateObjectSource.upsert({
          where: {
            candidateObjectId_sourceDocumentId: {
              candidateObjectId: link.candidateObjectId,
              sourceDocumentId: link.sourceDocumentId,
            },
          },
          create: {
            candidateObjectId: link.candidateObjectId,
            sourceDocumentId: link.sourceDocumentId,
          },
          update: {},
        })
      }

      return {
        prerequisites,
        sourceDocuments: plan.sourceDocuments.length,
        stationRelations: plan.relations.length,
        incidents: plan.incidents.length,
        incidentSignals: plan.signals.length,
        incidentSignalLinks: plan.signalLinks.length,
        candidateObjects: plan.candidateObjects.length,
        candidateObjectSources: plan.candidateSources.length,
      }
    },
    {
      maxWait: 10_000,
      timeout: 30_000,
    },
  )
}

async function persistSourceDocument(
  transaction: Prisma.TransactionClient,
  source: RuntimeBootstrapSourcePlan,
): Promise<void> {
  const existing = await transaction.sourceDocument.findUnique({
    where: { id: source.id },
    select: {
      id: true,
      originalUrl: true,
      canonicalUrl: true,
      publisher: true,
      title: true,
      sourceType: true,
      mediaType: true,
      publishedAt: true,
      fetchedAt: true,
      sha256: true,
      cachePath: true,
      status: true,
      extractionMetadata: true,
    },
  })

  const status = mapSourceStatus(source.status)
  const metadata = mergeMetadata(existing?.extractionMetadata, {
    official: source.official,
    verified: source.verified,
    runtimeBootstrap: {
      version: 1,
      inputPaths: source.inputPaths,
    },
  })

  if (existing === null) {
    if (source.official) {
      throw conflict(`Verified source document is missing: ${source.id}`)
    }

    await transaction.sourceDocument.create({
      data: {
        id: source.id,
        originalUrl: source.url,
        canonicalUrl: source.url,
        publisher: source.publisher,
        title: source.title,
        sourceType: 'media_article',
        mediaType: mapMediaType(source.contentType),
        publishedAt: toDate(source.publishedAt),
        publishedPeriod: null,
        fetchedAt: toDate(source.fetchedAt),
        sha256: source.sha256,
        cachePath: source.cachePath,
        httpStatus: null,
        status,
        extractionMetadata: metadata,
      },
    })
    return
  }

  assertEqual(existing.originalUrl, source.url, `${source.id} original URL`)
  assertEqual(existing.canonicalUrl, source.url, `${source.id} canonical URL`)
  assertEqual(existing.publisher, source.publisher, `${source.id} publisher`)
  assertExpectedNullable(
    existing.sha256,
    source.sha256,
    `${source.id} SHA-256`,
  )

  assertExpectedNullable(
    existing.cachePath,
    source.cachePath,
    `${source.id} cache path`,
  )

  assertExpectedDate(
    existing.publishedAt,
    source.publishedAt,
    `${source.id} publishedAt`,
  )

  assertExpectedDate(
    existing.fetchedAt,
    source.fetchedAt,
    `${source.id} fetchedAt`,
  )
  assertEqual(
    normalizeMediaType(existing.mediaType),
    source.contentType,
    `${source.id} media type`,
  )

  function assertExpectedNullable<T>(
    actual: T | null,
    expected: T | null,
    label: string,
  ): void {
    if (expected === null) {
      return
    }

    assertEqual(actual, expected, label)
  }

  function assertExpectedDate(
    actual: Date | null,
    expected: string | null,
    label: string,
  ): void {
    if (expected === null) {
      return
    }

    assertDate(actual, expected, label)
  }

  await transaction.sourceDocument.update({
    where: { id: source.id },
    data: {
      title: source.title,
      extractionMetadata: metadata,
    },
  })
}

async function persistIncident(
  transaction: Prisma.TransactionClient,
  incident: RuntimeBootstrapIncidentPlan,
): Promise<void> {
  const region = mapRegion(incident.region)
  const existing = await transaction.incident.findUnique({
    where: { id: incident.id },
    select: {
      id: true,
      region: true,
      indicator: true,
    },
  })

  if (existing !== null) {
    assertEqual(existing.region, region, `${incident.id} region`)
    assertEqual(existing.indicator, incident.indicator, `${incident.id} indicator`)
  }

  await transaction.incident.upsert({
    where: { id: incident.id },
    create: {
      id: incident.id,
      title: incident.title,
      region,
      indicator: incident.indicator,
      status: IncidentStatus.OPEN,
      metadata: jsonValue(incident.metadata),
    },
    update: {
      title: incident.title,
      status: IncidentStatus.OPEN,
      metadata: jsonValue(incident.metadata),
    },
  })
}

async function persistSignal(
  transaction: Prisma.TransactionClient,
  signal: RuntimeBootstrapSignalPlan,
): Promise<void> {
  const existing = await transaction.incidentSignal.findUnique({
    where: { id: signal.id },
    select: {
      id: true,
      sourceDocumentId: true,
      dedupKey: true,
    },
  })

  if (existing !== null) {
    assertEqual(
      existing.sourceDocumentId,
      signal.sourceDocumentId,
      `${signal.id} source document`,
    )
    assertEqual(existing.dedupKey, signal.id, `${signal.id} dedup key`)
  }

  const data = {
    title: signal.title,
    observedAt: toDate(signal.observedAt),
    observedPeriod: signal.observedPeriod,
    reportedAt: requiredDate(signal.reportedAt, `${signal.id} reportedAt`),
    latitude: null,
    longitude: null,
    locationText: signal.locationText,
    phenomenon: signal.phenomenon,
    excerpt: signal.excerpt,
    sourceDocumentId: signal.sourceDocumentId,
    extractionMode: mapExtractionMode(signal.extractionMode),
    verificationStatus: mapVerificationStatus(signal.verificationStatus),
    dedupKey: signal.id,
    metadata: jsonValue({
      runtimeBootstrap: {
        version: 1,
        checkedAt: signal.checkedAt,
        provenanceStatus: signal.provenanceStatus,
        inputPaths: signal.inputPaths,
      },
    }),
  }

  await transaction.incidentSignal.upsert({
    where: { id: signal.id },
    create: {
      id: signal.id,
      ...data,
    },
    update: data,
  })
}

async function persistCandidateObject(
  transaction: Prisma.TransactionClient,
  candidate: RuntimeBootstrapCandidatePlan,
): Promise<void> {
  const existing = await transaction.candidateObject.findUnique({
    where: { id: candidate.id },
    select: {
      id: true,
      name: true,
      objectType: true,
    },
  })

  if (existing !== null) {
    assertEqual(existing.name, candidate.name, `${candidate.id} name`)
    assertEqual(existing.objectType, candidate.category, `${candidate.id} category`)
  }

  const basisText = [
    `Объект упомянут в документах: ${candidate.evidenceDocumentIds.join(', ')}.`,
    'Причинная связь с загрязнением не установлена.',
  ].join(' ')

  const data = {
    name: candidate.name,
    objectType: candidate.category,
    activity: null,
    latitude: null,
    longitude: null,
    geometrySourceDocumentId: null,
    basisText,
    verificationStatus:
      candidate.completeness === 'confirmed'
        ? VerificationStatus.OFFICIAL
        : VerificationStatus.UNVERIFIED,
    metadata: jsonValue({
      stationId: candidate.stationId,
      waterBody: candidate.waterBody,
      completeness: candidate.completeness,
      incidentIds: candidate.incidentIds,
      runtimeBootstrap: {
        version: 1,
        evidenceDocumentIds: candidate.evidenceDocumentIds,
      },
    }),
  }

  await transaction.candidateObject.upsert({
    where: { id: candidate.id },
    create: {
      id: candidate.id,
      ...data,
    },
    update: data,
  })
}

function mapRegion(value: 'atyrau' | 'mangystau'): Region {
  return value === 'atyrau' ? Region.ATYRAU : Region.MANGYSTAU
}

function mapSourceStatus(
  value: RuntimeBootstrapSourcePlan['status'],
): SourceDocumentStatus {
  switch (value) {
    case 'unverified':
      return SourceDocumentStatus.UNVERIFIED
    case 'verified':
      return SourceDocumentStatus.VERIFIED
    case 'unavailable':
      return SourceDocumentStatus.UNAVAILABLE
  }
}

function mapExtractionMode(
  value: RuntimeBootstrapSignalPlan['extractionMode'],
): ExtractionMode {
  switch (value) {
    case 'llm_verified':
      return ExtractionMode.LLM_VERIFIED
    case 'rule':
      return ExtractionMode.RULE
    case 'verified_seed':
      return ExtractionMode.VERIFIED_SEED
  }
}

function mapVerificationStatus(
  value: RuntimeBootstrapSignalPlan['verificationStatus'],
): VerificationStatus {
  switch (value) {
    case 'unverified':
      return VerificationStatus.UNVERIFIED
    case 'corroborated':
      return VerificationStatus.CORROBORATED
    case 'official':
      return VerificationStatus.OFFICIAL
    case 'conflicting':
      return VerificationStatus.CONFLICTING
  }
}

function mapMediaType(value: RuntimeBootstrapSourcePlan['contentType']): string {
  return value === 'pdf' ? 'application/pdf' : 'text/html'
}

function normalizeMediaType(value: string): RuntimeBootstrapSourcePlan['contentType'] {
  if (value === 'pdf' || value === 'application/pdf') return 'pdf'
  if (value === 'html' || value === 'text/html') return 'html'
  throw conflict(`Unsupported source media type: ${value}`)
}

function requiredDate(value: string, label: string): Date {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw conflict(`Invalid datetime for ${label}`)
  }
  return parsed
}

function toDate(value: string | null): Date | null {
  return value === null ? null : requiredDate(value, 'runtime bootstrap value')
}

function assertDate(
  actual: Date | null,
  expected: string | null,
  label: string,
): void {
  const actualValue = actual?.toISOString() ?? null
  const expectedValue = expected === null
    ? null
    : requiredDate(expected, label).toISOString()

  assertEqual(actualValue, expectedValue, label)
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw conflict(`Conflicting ${label}`)
  }
}

function mergeMetadata(
  existing: unknown,
  patch: Record<string, unknown>,
): Prisma.InputJsonValue {
  return jsonValue({
    ...asRecord(existing),
    ...patch,
  })
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function conflict(message: string): RuntimeBootstrapError {
  return new RuntimeBootstrapError(
    'RUNTIME_BOOTSTRAP_PERSISTENCE_CONFLICT',
    message,
  )
}
