import { Injectable } from '@nestjs/common'

import { Prisma } from '../generated/prisma/client'
import {
  IngestionAdapter,
  IngestionRunStatus,
  SourceDocumentStatus,
  SourceHealthStatus,
} from '../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'
import { kazhydrometError } from './ingestion.errors'
import type {
  CachedIngestionSourceDocument,
  IngestionSourceDocument,
  KazhydrometRegion,
  NormalizedKazhydrometRequest,
  PersistedPagesResult,
  SourceDocumentIdentityInput,
} from './ingestion.types'
import type { PdfPage } from './kazhydromet/kazhydromet.types'

const sourceSelect = {
  id: true,
  originalUrl: true,
  canonicalUrl: true,
  mediaType: true,
  publishedPeriod: true,
  sha256: true,
  cachePath: true,
  status: true,
} as const satisfies Prisma.SourceDocumentSelect

const cachedSourceSelect = {
  ...sourceSelect,
  extractionMetadata: true,
} as const satisfies Prisma.SourceDocumentSelect

@Injectable()
export class IngestionRepository {
  constructor(private readonly prisma: PrismaService) {}

  createRun(id: string, request: NormalizedKazhydrometRequest): Promise<unknown> {
    return this.prisma.ingestionRun.create({
      data: {
        id,
        adapter: IngestionAdapter.KAZHYDROMET,
        status: IngestionRunStatus.RUNNING,
        metadata: {
          request: {
            from: request.from,
            to: request.to,
            regions: request.regions,
            maxDocuments: request.maxDocuments,
          },
        },
      },
      select: { id: true },
    })
  }

  async finalizeRun(input: {
    id: string
    status: IngestionRunStatus
    fetchedCount: number
    acceptedCount: number
    rejectedCount: number
    errorCode: string | null
    errorMessage: string | null
    metadata: Prisma.InputJsonObject
    finishedAt: Date
  }): Promise<void> {
    await this.prisma.ingestionRun.update({
      where: { id: input.id },
      data: {
        status: input.status,
        fetchedCount: input.fetchedCount,
        acceptedCount: input.acceptedCount,
        rejectedCount: input.rejectedCount,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        metadata: input.metadata,
        finishedAt: input.finishedAt,
      },
      select: { id: true },
    })
  }

  async markHealthAttempt(at: Date): Promise<void> {
    await this.prisma.sourceHealth.upsert({
      where: { sourceId: 'kazhydromet' },
      create: {
        sourceId: 'kazhydromet',
        displayName: 'Казгидромет',
        status: SourceHealthStatus.NEVER_RUN,
        lastAttemptAt: at,
      },
      update: { lastAttemptAt: at },
      select: { sourceId: true },
    })
  }

  async finalizeHealth(input: {
    at: Date
    status: SourceHealthStatus
    lastHttpStatus: number | null
    cacheAvailable: boolean
    detail: string | null
    actualError: boolean
    success: boolean
    metadata: Prisma.InputJsonObject
  }): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.sourceHealth.findUnique({
        where: { sourceId: 'kazhydromet' },
        select: { metadata: true, consecutiveErrors: true },
      })
      const metadata = { ...jsonObject(current?.metadata), ...input.metadata }
      await transaction.sourceHealth.upsert({
        where: { sourceId: 'kazhydromet' },
        create: {
          sourceId: 'kazhydromet',
          displayName: 'Казгидромет',
          status: input.status,
          lastAttemptAt: input.at,
          lastSuccessAt: input.success ? input.at : null,
          lastHttpStatus: input.lastHttpStatus,
          cacheAvailable: input.cacheAvailable,
          consecutiveErrors: input.actualError ? 1 : 0,
          detail: input.detail,
          metadata,
        },
        update: {
          status: input.status,
          lastAttemptAt: input.at,
          ...(input.success ? { lastSuccessAt: input.at } : {}),
          lastHttpStatus: input.lastHttpStatus,
          cacheAvailable: input.cacheAvailable,
          consecutiveErrors: input.actualError
            ? (current?.consecutiveErrors ?? 0) + 1
            : input.success
              ? 0
              : current?.consecutiveErrors ?? 0,
          detail: input.detail,
          metadata,
        },
        select: { sourceId: true },
      })
    })
  }

  async ensureSourceDocument(
    input: SourceDocumentIdentityInput,
  ): Promise<IngestionSourceDocument> {
    const bySnapshot = await this.prisma.sourceDocument.findFirst({
      where: { canonicalUrl: input.canonicalUrl, sha256: input.sha256 },
      select: sourceSelect,
    })
    if (bySnapshot) return bySnapshot
    const byId = await this.prisma.sourceDocument.findUnique({
      where: { id: input.id },
      select: sourceSelect,
    })
    if (byId) return assertIdentity(byId, input)
    try {
      return await this.prisma.sourceDocument.create({
        data: {
          ...input,
          publishedAt: null,
          fetchedAt: null,
          cachePath: null,
          httpStatus: null,
          status: SourceDocumentStatus.UNVERIFIED,
        },
        select: sourceSelect,
      })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
      const converged = await this.prisma.sourceDocument.findFirst({
        where: { OR: [{ id: input.id }, { canonicalUrl: input.canonicalUrl, sha256: input.sha256 }] },
        select: sourceSelect,
      })
      if (!converged) throw error
      return assertIdentity(converged, input)
    }
  }

  async findCachedSourceById(
    id: string,
    requestedRegions: readonly KazhydrometRegion[],
  ): Promise<CachedIngestionSourceDocument | null> {
    const document = await this.prisma.sourceDocument.findUnique({
      where: { id },
      select: cachedSourceSelect,
    })
    return document ? cachedSourceForRegions(document, requestedRegions) : null
  }

  async findCachedSourceByCanonicalUrl(
    canonicalUrl: string,
    requestedRegions: readonly KazhydrometRegion[],
  ): Promise<CachedIngestionSourceDocument | null> {
    const documents = await this.prisma.sourceDocument.findMany({
      where: { canonicalUrl, cachePath: { not: null }, sha256: { not: null } },
      orderBy: { createdAt: 'asc' },
      select: cachedSourceSelect,
    })
    for (const document of documents) {
      const cached = cachedSourceForRegions(document, requestedRegions)
      if (cached) return cached
    }
    return null
  }

  async findCachedSources(
    request: NormalizedKazhydrometRequest,
  ): Promise<CachedIngestionSourceDocument[]> {
    const documents = await this.prisma.sourceDocument.findMany({
      where: {
        sourceType: 'kazhydromet_bulletin',
        publishedPeriod: { gte: request.from, lte: request.to },
        cachePath: { not: null },
        sha256: { not: null },
      },
      orderBy: [{ publishedPeriod: 'asc' }, { id: 'asc' }],
      select: cachedSourceSelect,
    })
    return documents
      .map((document) => cachedSourceForRegions(document, request.regions))
      .filter((document): document is CachedIngestionSourceDocument => document !== null)
      .slice(0, request.maxDocuments)
  }

  async hasCachedKazhydrometSnapshots(): Promise<boolean> {
    const source = await this.prisma.sourceDocument.findFirst({
      where: {
        sourceType: 'kazhydromet_bulletin',
        cachePath: { not: null },
        sha256: { not: null },
      },
      select: { id: true },
    })
    return source !== null
  }

  async persistPages(input: {
    sourceDocumentId: string
    pages: PdfPage[]
    kazhydrometMetadata: Prisma.InputJsonObject
  }): Promise<PersistedPagesResult> {
    return this.prisma.$transaction(async (transaction) => {
      const document = await transaction.sourceDocument.findUnique({
        where: { id: input.sourceDocumentId },
        select: { extractionMetadata: true },
      })
      if (!document) throw kazhydrometError('KAZHYDROMET_SOURCE_CONFLICT', 'Source document is unavailable')
      const existing = await transaction.sourcePage.findMany({
        where: { sourceDocumentId: input.sourceDocumentId },
        select: { pageNumber: true, extractedText: true, textSha256: true },
      })
      const byPage = new Map(existing.map((page) => [page.pageNumber, page]))
      const missing: PdfPage[] = []
      for (const page of input.pages) {
        const current = byPage.get(page.pageNumber)
        if (!current) missing.push(page)
        else if (current.textSha256 !== page.textSha256 || current.extractedText !== page.text) {
          throw kazhydrometError('KAZHYDROMET_PAGE_CONFLICT', 'Extracted source page conflicts with immutable text')
        }
      }
      if (missing.length > 0) {
        await transaction.sourcePage.createMany({
          data: missing.map((page) => ({
            id: `${input.sourceDocumentId}:page:${page.pageNumber}`,
            sourceDocumentId: input.sourceDocumentId,
            pageNumber: page.pageNumber,
            extractedText: page.text,
            textSha256: page.textSha256,
          })),
        })
      }
      const currentMetadata = jsonObject(document.extractionMetadata)
      await transaction.sourceDocument.update({
        where: { id: input.sourceDocumentId },
        data: { extractionMetadata: { ...currentMetadata, kazhydromet: input.kazhydrometMetadata } },
        select: { id: true },
      })
      return { pageCount: input.pages.length, createdCount: missing.length }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 20_000,
    })
  }
}

function cachedSourceForRegions(
  document: Prisma.SourceDocumentGetPayload<{ select: typeof cachedSourceSelect }>,
  requestedRegions: readonly KazhydrometRegion[],
): CachedIngestionSourceDocument | null {
  if (document.cachePath === null || document.sha256 === null) return null
  const regions = trustedKazhydrometRegions(document)
    .filter((region) => requestedRegions.includes(region))
  if (regions.length === 0) return null
  return {
    id: document.id,
    originalUrl: document.originalUrl,
    canonicalUrl: document.canonicalUrl,
    mediaType: document.mediaType,
    publishedPeriod: document.publishedPeriod,
    sha256: document.sha256,
    cachePath: document.cachePath,
    status: document.status,
    regions,
  }
}

function trustedKazhydrometRegions(
  document: Pick<
    Prisma.SourceDocumentGetPayload<{ select: typeof cachedSourceSelect }>,
    'id' | 'publishedPeriod' | 'extractionMetadata'
  >,
): KazhydrometRegion[] {
  const known = /^doc-kazhydromet-(\d{4}-(?:0[1-9]|1[0-2]))$/.exec(document.id)
  if (known?.[1] === document.publishedPeriod) return ['atyrau']

  const metadata = jsonRecord(document.extractionMetadata)
  const discovery = jsonRecord(metadata.kazhydrometDiscovery)
  if (!Array.isArray(discovery.regions)) return []
  const metadataRegions: unknown[] = discovery.regions
  const regions = new Set<KazhydrometRegion>()
  for (const region of metadataRegions) {
    if (region === 'atyrau' || region === 'mangystau') regions.add(region)
  }
  return [...regions]
}

function assertIdentity(
  document: IngestionSourceDocument,
  expected: SourceDocumentIdentityInput,
): IngestionSourceDocument {
  if (
    document.id !== expected.id ||
    document.originalUrl !== expected.originalUrl ||
    document.canonicalUrl !== expected.canonicalUrl ||
    document.sha256 !== expected.sha256 ||
    document.publishedPeriod !== expected.publishedPeriod ||
    document.mediaType !== expected.mediaType
  ) {
    throw kazhydrometError('KAZHYDROMET_SOURCE_CONFLICT', 'Source document identity conflicts with immutable provenance')
  }
  return document
}

function jsonObject(value: Prisma.JsonValue | undefined): Prisma.InputJsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const result: Record<string, Prisma.InputJsonValue> = {}
  for (const [key, item] of Object.entries(value)) {
    if (item !== null && item !== undefined) result[key] = item
  }
  return result
}

function jsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}
