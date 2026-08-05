import { createHash } from 'node:crypto'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'

import { AppModule } from '../src/app.module'
import { IngestionRepository } from '../src/ingestion/ingestion.repository'
import { PrismaService } from '../src/prisma/prisma.service'
import { SourcesService } from '../src/sources/sources.service'
import { SOURCE_STORAGE } from '../src/sources/storage/storage.constants'
import type { SourceStoragePort } from '../src/sources/storage/storage.port'
import type { StoredSnapshot, UploadImmutableSnapshotInput } from '../src/sources/storage/storage.types'
import type { SourceDocumentIdentityInput } from '../src/ingestion/ingestion.types'
import type { PdfPage } from '../src/ingestion/kazhydromet/kazhydromet.types'

const databaseUrl = process.env.DATABASE_E2E_URL
const directUrl = process.env.DIRECT_E2E_URL
if (process.env.PRISMA_E2E_DATABASE_REQUIRED !== 'true') throw new Error('PRISMA_E2E_DATABASE_REQUIRED=true is required')
if (process.env.PRISMA_E2E_DATABASE_DISPOSABLE !== 'true') throw new Error('PRISMA_E2E_DATABASE_DISPOSABLE=true is required')
if (!databaseUrl || !directUrl) throw new Error('Disposable DB URLs are required')
assertNotSupabase(databaseUrl)
assertNotSupabase(directUrl)
process.env.DATABASE_URL = databaseUrl

class MemoryStorage implements SourceStoragePort {
  readonly objects = new Map<string, Buffer>()
  uploadImmutableSnapshot(input: UploadImmutableSnapshotInput): Promise<StoredSnapshot> {
    const existing = this.objects.get(input.path)
    if (!existing) this.objects.set(input.path, Buffer.from(input.bytes))
    else if (createHash('sha256').update(existing).digest('hex') !== input.sha256) throw new Error('immutable test storage conflict')
    return Promise.resolve({ path: input.path, sha256: input.sha256, created: !existing })
  }
  createSignedReadUrl(): Promise<string> { return Promise.resolve('https://storage.test.invalid/signed') }
  exists(path: string): Promise<boolean> { return Promise.resolve(this.objects.has(path)) }
  download(path: string): Promise<Buffer> {
    const value = this.objects.get(path)
    if (!value) return Promise.reject(new Error('missing test object'))
    return Promise.resolve(Buffer.from(value))
  }
}

describe('Kazhydromet ingestion persistence (disposable PostgreSQL e2e)', () => {
  const prefix = `test-part07-${process.pid}-${Date.now()}-`
  const ids = {
    run: `${prefix}run`, source: `${prefix}source`, parserFailure: `${prefix}parser-failure`,
    cachedAtyrau: `${prefix}cached-atyrau`, cachedMangystau: `${prefix}cached-mangystau`,
    cachedUnknown: `${prefix}cached-unknown`,
  }
  const bytes = Buffer.from('%PDF-1.4\nPart 07 immutable synthetic PDF')
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const storage = new MemoryStorage()
  let app: INestApplication
  let prisma: PrismaService
  let repository: IngestionRepository
  let sources: SourcesService

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SOURCE_STORAGE).useValue(storage).compile()
    app = module.createNestApplication({ bodyParser: false })
    await app.init()
    prisma = app.get(PrismaService)
    repository = app.get(IngestionRepository)
    sources = app.get(SourcesService)
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.ingestionRun.deleteMany({ where: { id: { startsWith: prefix } } })
      await prisma.sourceDocument.deleteMany({ where: { id: { startsWith: prefix } } })
    }
    if (app) await app.close()
  })

  it('creates and finalizes a run row and updates source health', async () => {
    const request = { from: '2025-09', to: '2025-09', regions: ['atyrau'] as ['atyrau'], maxDocuments: 1 }
    const finishedAt = new Date(Date.now() + 1_000)
    await repository.createRun(ids.run, request)
    await repository.markHealthAttempt(new Date())
    await repository.finalizeRun({
      id: ids.run, status: 'SUCCEEDED', fetchedCount: 1, acceptedCount: 1, rejectedCount: 0,
      errorCode: null, errorMessage: null, metadata: { testPart: 7 }, finishedAt,
    })
    await repository.finalizeHealth({
      at: finishedAt, status: 'HEALTHY', lastHttpStatus: 200,
      cacheAvailable: true, detail: null, actualError: false, success: true, metadata: { preserved: true },
    })
    await expect(prisma.ingestionRun.findUniqueOrThrow({ where: { id: ids.run }, select: { status: true, acceptedCount: true } }))
      .resolves.toEqual({ status: 'SUCCEEDED', acceptedCount: 1 })
    await expect(prisma.sourceHealth.findUniqueOrThrow({ where: { sourceId: 'kazhydromet' }, select: { status: true, cacheAvailable: true, metadata: true } }))
      .resolves.toMatchObject({ status: 'HEALTHY', cacheAvailable: true, metadata: { preserved: true } })
  })

  it('creates a source, attaches immutable snapshot, and persists pages', async () => {
    const source = await repository.ensureSourceDocument(identity(ids.source))
    expect(source.id).toBe(ids.source)
    const cached = await sources.cacheExistingSourceSnapshot({
      sourceDocumentId: ids.source, bytes, mediaType: 'application/pdf',
      fetchedAt: new Date('2026-08-05T10:00:00Z'), httpStatus: 200,
    })
    expect(cached).toMatchObject({ sha256, attached: true })
    await expect(repository.persistPages({
      sourceDocumentId: ids.source,
      pages: [page(1, 'Атырау Жайык\nНефтепродукты 0,234 мг/дм³'), page(2, 'Second immutable page')],
      kazhydrometMetadata: { parserVersion: 1, relevantPageNumbers: [1] },
    })).resolves.toEqual({ pageCount: 2, createdCount: 2 })
    await expect(prisma.sourcePage.count({ where: { sourceDocumentId: ids.source } })).resolves.toBe(2)
  })

  it('converges on repeat/concurrent identity and creates no duplicate pages', async () => {
    const [left, right] = await Promise.all([
      repository.ensureSourceDocument(identity(ids.source)),
      repository.ensureSourceDocument(identity(ids.source)),
    ])
    expect(left.id).toBe(right.id)
    await expect(sources.cacheExistingSourceSnapshot({
      sourceDocumentId: ids.source, bytes, mediaType: 'application/pdf',
      fetchedAt: new Date('2026-08-05T10:00:00Z'), httpStatus: 200,
    })).resolves.toMatchObject({ attached: false, created: false })
    await expect(repository.persistPages({
      sourceDocumentId: ids.source,
      pages: [page(1, 'Атырау Жайык\nНефтепродукты 0,234 мг/дм³'), page(2, 'Second immutable page')],
      kazhydrometMetadata: { parserVersion: 1, relevantPageNumbers: [1] },
    })).resolves.toEqual({ pageCount: 2, createdCount: 0 })
    await expect(prisma.sourceDocument.count({ where: { id: { startsWith: prefix } } })).resolves.toBe(1)
    await expect(prisma.sourcePage.count({ where: { sourceDocumentId: ids.source } })).resolves.toBe(2)
  })

  it('rolls back page transaction on immutable text conflict and preserves metadata', async () => {
    await prisma.sourceDocument.update({
      where: { id: ids.source }, data: { extractionMetadata: { externalKey: 'keep', kazhydromet: { parserVersion: 1 } } },
    })
    await expect(repository.persistPages({
      sourceDocumentId: ids.source,
      pages: [page(1, 'changed text'), page(3, 'must not persist')],
      kazhydrometMetadata: { parserVersion: 2 },
    })).rejects.toMatchObject({ code: 'KAZHYDROMET_PAGE_CONFLICT' })
    await expect(prisma.sourcePage.findFirst({ where: { sourceDocumentId: ids.source, pageNumber: 3 } })).resolves.toBeNull()
    await expect(prisma.sourceDocument.findUniqueOrThrow({ where: { id: ids.source }, select: { extractionMetadata: true } }))
      .resolves.toEqual({ extractionMetadata: { externalKey: 'keep', kazhydromet: { parserVersion: 1 } } })
  })

  it('keeps a cached snapshot when parsing has not produced pages and writes no measurements', async () => {
    await repository.ensureSourceDocument(identity(ids.parserFailure))
    await sources.cacheExistingSourceSnapshot({
      sourceDocumentId: ids.parserFailure, bytes, mediaType: 'application/pdf',
      fetchedAt: new Date('2026-08-05T11:00:00Z'), httpStatus: 200,
    })
    const stored = await prisma.sourceDocument.findUniqueOrThrow({
      where: { id: ids.parserFailure }, select: { cachePath: true, pages: { select: { id: true } } },
    })
    expect(stored.cachePath).toEqual(expect.any(String))
    expect(stored.pages).toEqual([])
    await expect(prisma.measurement.count({ where: { id: { startsWith: prefix } } })).resolves.toBe(0)
  })

  it('filters cached fallback by trusted region metadata and skips unknown regions', async () => {
    await Promise.all([
      createCachedSource(ids.cachedAtyrau, ['atyrau']),
      createCachedSource(ids.cachedMangystau, ['mangystau']),
      createCachedSource(ids.cachedUnknown, []),
    ])
    await expect(repository.findCachedSources({
      from: '2025-09', to: '2025-09', regions: ['mangystau'], maxDocuments: 10,
    })).resolves.toEqual([
      expect.objectContaining({ id: ids.cachedMangystau, regions: ['mangystau'] }),
    ])
    await expect(repository.findCachedSourceById(ids.cachedAtyrau, ['mangystau'])).resolves.toBeNull()
    await expect(repository.findCachedSourceById(ids.cachedUnknown, ['atyrau', 'mangystau'])).resolves.toBeNull()
    await expect(repository.hasCachedKazhydrometSnapshots()).resolves.toBe(true)
  })

  it('increments health errors for partial accepted runs with actual errors', async () => {
    const baseline = new Date('2026-08-06T10:00:00Z')
    await repository.finalizeHealth({
      at: baseline, status: 'HEALTHY', lastHttpStatus: 200, cacheAvailable: true,
      detail: null, actualError: false, success: true, metadata: { part07HealthRegression: true },
    })
    await repository.finalizeHealth({
      at: new Date(baseline.getTime() + 1_000), status: 'DEGRADED', lastHttpStatus: null,
      cacheAvailable: true, detail: 'KAZHYDROMET_ORIGIN_UNAVAILABLE: safe detail',
      actualError: true, success: true, metadata: { part07HealthRegression: true },
    })
    await expect(prisma.sourceHealth.findUniqueOrThrow({
      where: { sourceId: 'kazhydromet' },
      select: { status: true, consecutiveErrors: true, detail: true },
    })).resolves.toEqual({
      status: 'DEGRADED', consecutiveErrors: 1,
      detail: 'KAZHYDROMET_ORIGIN_UNAVAILABLE: safe detail',
    })
  })

  function identity(id: string): SourceDocumentIdentityInput {
    return {
      id, originalUrl: `https://www.kazhydromet.kz/${id}.pdf`, canonicalUrl: `https://www.kazhydromet.kz/${id}.pdf`,
      publisher: 'РГП «Казгидромет»', title: 'Part 07 disposable bulletin', sourceType: 'kazhydromet_bulletin',
      mediaType: 'application/pdf', publishedPeriod: '2025-09', sha256,
      extractionMetadata: { testPart: 7 },
    }
  }

  async function createCachedSource(id: string, regions: string[]): Promise<void> {
    await repository.ensureSourceDocument({
      ...identity(id),
      extractionMetadata: regions.length > 0
        ? { kazhydrometDiscovery: { regions } }
        : { testPart: 7 },
    })
    await sources.cacheExistingSourceSnapshot({
      sourceDocumentId: id, bytes, mediaType: 'application/pdf',
      fetchedAt: new Date('2026-08-06T09:00:00Z'), httpStatus: 200,
    })
  }
})

function page(pageNumber: number, text: string): PdfPage {
  return { pageNumber, text, textSha256: createHash('sha256').update(text).digest('hex') }
}

function assertNotSupabase(value: string): void {
  const hostname = new URL(value).hostname.toLowerCase()
  if (hostname === 'supabase.co' || hostname.endsWith('.supabase.co') || hostname === 'pooler.supabase.com' || hostname.endsWith('.pooler.supabase.com')) {
    throw new Error('Supabase targets are forbidden for Part 07 DB e2e')
  }
}
