import { createHash } from 'node:crypto'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'

import { AppModule } from '../src/app.module'
import { SafeFetchError } from '../src/common/http/safe-fetch/safe-fetch.errors'
import { SafeFetchService } from '../src/common/http/safe-fetch/safe-fetch.service'
import { GdeltIngestionService } from '../src/ingestion/gdelt/gdelt-ingestion.service'
import { LiveService } from '../src/live/live.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { SOURCE_STORAGE } from '../src/sources/storage/storage.constants'
import type { SourceStoragePort } from '../src/sources/storage/storage.port'
import type { StoredSnapshot, UploadImmutableSnapshotInput } from '../src/sources/storage/storage.types'
import type { GdeltIngestionResponse } from '../src/ingestion/ingestion.types'
import type { FetchJsonResult } from '../src/common/http/safe-fetch/safe-fetch.types'
import type { GdeltResponse } from '../src/ingestion/gdelt/gdelt.schemas'

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
    else if (createHash('sha256').update(existing).digest('hex') !== input.sha256) throw new Error('immutable conflict')
    return Promise.resolve({ path: input.path, sha256: input.sha256, created: !existing })
  }
  createSignedReadUrl(): Promise<string> { return Promise.resolve('https://storage.test.invalid/signed') }
  exists(path: string): Promise<boolean> { return Promise.resolve(this.objects.has(path)) }
  download(path: string): Promise<Buffer> {
    const value = this.objects.get(path)
    return value ? Promise.resolve(Buffer.from(value)) : Promise.reject(new Error('missing'))
  }
}

describe('GDELT/direct ingestion persistence (disposable PostgreSQL e2e)', () => {
  const trackedRuns = new Set<string>()
  const trackedDocuments = new Set<string>()
  const storage = new MemoryStorage()
  const fetchJson = jest.fn()
  const fetchBuffer = jest.fn()
  let html = articleHtml('version one')
  let app: INestApplication
  let prisma: PrismaService
  let service: GdeltIngestionService
  let live: LiveService

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SOURCE_STORAGE).useValue(storage)
      .overrideProvider(SafeFetchService).useValue({ fetchJson, fetchBuffer })
      .compile()
    app = module.createNestApplication({ bodyParser: false })
    await app.init()
    prisma = app.get(PrismaService)
    service = app.get(GdeltIngestionService)
    live = app.get(LiveService)
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.ingestionRun.deleteMany({ where: { id: { in: [...trackedRuns] } } })
      await prisma.sourceDocument.deleteMany({ where: { id: { in: [...trackedDocuments] } } })
      await prisma.sourceHealth.deleteMany({ where: { sourceId: { in: ['gdelt', 'direct-sources'] } } })
    }
    if (app) await app.close()
  })

  beforeEach(() => {
    fetchJson.mockReset().mockResolvedValue(gdeltResponse('healthy', 'miss'))
    fetchBuffer.mockReset().mockImplementation((url: URL) => Promise.resolve({
      body: Buffer.from(html),
      metadata: {
        requestedUrl: url.toString(), finalUrl: url.toString(), statusCode: 200,
        contentType: 'text/html', fetchedAt: '2026-08-06T00:00:00Z', redirects: 0,
        attempts: 1, cacheStatus: 'miss', sourceStatus: 'healthy',
      },
    }))
  })

  it('persists a GDELT run, health, immutable raw snapshot, and bounded metadata', async () => {
    html = articleHtml('version one')
    const result = await run({ includeDirectFallback: false })
    await expect(prisma.ingestionRun.findUniqueOrThrow({
      where: { id: result.gdelt.runId },
      select: { errorCode: true, errorMessage: true },
    })).resolves.toEqual({ errorCode: null, errorMessage: null })
    expect(result).toMatchObject({ status: 'succeeded', gdelt: { acceptedCount: 1 } })
    const document = await prisma.sourceDocument.findUniqueOrThrow({
      where: { id: result.documents[0]!.sourceDocumentId },
      select: { cachePath: true, sha256: true, publishedAt: true, extractionMetadata: true },
    })
    expect(typeof document.cachePath).toBe('string')
    expect(document.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(document.publishedAt).toEqual(new Date('2025-09-12T05:30:00Z'))
    expect(JSON.stringify(document.extractionMetadata)).not.toContain('version one')
    expect(JSON.stringify(document.extractionMetadata)).not.toContain('<html')
    expect(document.extractionMetadata).toMatchObject({
      publicArticle: { matchedRequestedRegions: ['atyrau'], relevant: true },
    })
    await expect(prisma.ingestionRun.findUniqueOrThrow({ where: { id: result.gdelt.runId }, select: { adapter: true, status: true } }))
      .resolves.toEqual({ adapter: 'GDELT', status: 'SUCCEEDED' })
    await expect(prisma.sourceHealth.findUniqueOrThrow({ where: { sourceId: 'gdelt' }, select: { status: true, cacheAvailable: true } }))
      .resolves.toEqual({ status: 'HEALTHY', cacheAvailable: true })
    expect(storage.objects.has(result.documents[0]!.cachePath)).toBe(true)
  })

  it('reuses the same URL/content and versions changed content without overwrite', async () => {
    html = articleHtml('version one')
    const first = await run({ includeDirectFallback: false })
    const repeat = await run({ includeDirectFallback: false })
    await expect(prisma.ingestionRun.findUniqueOrThrow({
      where: { id: repeat.gdelt.runId },
      select: { errorCode: true, errorMessage: true },
    })).resolves.toEqual({ errorCode: null, errorMessage: null })
    expect(repeat.documents[0]!.sourceDocumentId).toBe(first.documents[0]!.sourceDocumentId)
    html = articleHtml('version two changed')
    const changed = await run({ includeDirectFallback: false })
    expect(changed.documents[0]!.sourceDocumentId).not.toBe(first.documents[0]!.sourceDocumentId)
    await expect(prisma.sourceDocument.count({
      where: { canonicalUrl: 'https://azh.kz/test-part08/article' },
    })).resolves.toBe(2)
  })

  it('retains raw snapshot when parsing fails', async () => {
    html = '<html><body><nav>no article body</nav></body></html>'
    const result = await run({ includeDirectFallback: false })
    expect(result).toMatchObject({ status: 'partial', documents: [expect.objectContaining({ parserStatus: 'failed' })] })
    expect(storage.objects.has(result.documents[0]!.cachePath)).toBe(true)
  })

  it('keeps stale 429 explicit while processing cached articles', async () => {
    html = articleHtml('stale response')
    fetchJson.mockResolvedValueOnce(gdeltResponse('rate_limited', 'stale'))
    const result = await run({ includeDirectFallback: false })
    expect(result).toMatchObject({ status: 'partial', gdelt: { status: 'rate_limited', acceptedCount: 1 } })
    const health = await prisma.sourceHealth.findUniqueOrThrow({ where: { sourceId: 'gdelt' }, select: { status: true, consecutiveErrors: true } })
    expect(health.status).toBe('RATE_LIMITED')
    expect(health.consecutiveErrors).toBeGreaterThan(0)
  })

  it('creates separate direct run/health without hiding GDELT outage', async () => {
    html = articleHtml('direct fallback')
    fetchJson.mockRejectedValueOnce(new SafeFetchError({
      code: 'SAFE_FETCH_RATE_LIMITED', safeMessage: 'raw upstream', sourceStatus: 'rate_limited', retryable: true,
    }))
    const result = await run({ includeDirectFallback: true })
    expect(result).toMatchObject({
      status: 'partial', gdelt: { status: 'rate_limited' },
      directFallback: { used: true, status: 'succeeded', acceptedCount: 1 },
    })
    await expect(prisma.sourceHealth.findMany({
      where: { sourceId: { in: ['gdelt', 'direct-sources'] } },
      orderBy: { sourceId: 'asc' }, select: { sourceId: true, status: true },
    })).resolves.toEqual([
      { sourceId: 'direct-sources', status: 'HEALTHY' }, { sourceId: 'gdelt', status: 'RATE_LIMITED' },
    ])
  })

  it('retains direct temporal mismatch/unknown snapshots but accepts only the September article', async () => {
    fetchJson.mockRejectedValueOnce(new SafeFetchError({
      code: 'SAFE_FETCH_NETWORK_ERROR', safeMessage: 'upstream unavailable',
      sourceStatus: 'degraded', retryable: true,
    }))
    fetchBuffer.mockImplementation((url: URL) => {
      const publishedAt = url.hostname === 'www.zakon.kz'
        ? '2025-09-09T10:16:00+05:00'
        : url.hostname === 'www.inform.kz'
          ? '2025-10-08T21:10:00+05:00'
          : null
      return Promise.resolve({
        body: Buffer.from(articleHtmlWithPublishedAt(url.hostname, publishedAt)),
        metadata: {
          requestedUrl: url.toString(), finalUrl: url.toString(), statusCode: 200,
          contentType: 'text/html', fetchedAt: '2026-08-06T00:00:00Z', redirects: 0,
          attempts: 1, cacheStatus: 'miss', sourceStatus: 'healthy',
        },
      })
    })

    const result = await run({ includeDirectFallback: true, maxArticles: 3 })
    expect(result).toMatchObject({
      status: 'partial',
      directFallback: { used: true, status: 'partial', attemptedCount: 3, acceptedCount: 1, rejectedCount: 0 },
    })
    expect(result.documents).toHaveLength(1)
    expect(result.documents[0]!.canonicalUrl).toContain('zakon.kz')
    expect(result.documents[0]!.publishedAt).toBe('2025-09-09T05:16:00.000Z')

    const directRun = await prisma.ingestionRun.findUniqueOrThrow({
      where: { id: result.directFallback.runId! },
      select: { status: true, acceptedCount: true, rejectedCount: true, metadata: true },
    })
    expect(directRun).toMatchObject({
      status: 'PARTIAL', acceptedCount: 1, rejectedCount: 0,
      metadata: { temporalMismatchCount: 1, temporalUnknownCount: 1 },
    })
    await expect(prisma.sourceHealth.findUniqueOrThrow({
      where: { sourceId: 'direct-sources' },
      select: { status: true, consecutiveErrors: true },
    })).resolves.toEqual({ status: 'HEALTHY', consecutiveErrors: 0 })

    const stored = await prisma.sourceDocument.findMany({
      where: {
        extractionMetadata: {
          path: ['publicArticle', 'ingestionRunIds'],
          array_contains: [result.directFallback.runId!],
        },
      },
      select: { id: true, cachePath: true },
    })
    expect(stored).toHaveLength(3)
    for (const document of stored) {
      trackedDocuments.add(document.id)
      expect(document.cachePath).toEqual(expect.any(String))
      expect(storage.objects.has(document.cachePath!)).toBe(true)
    }
    await expect(prisma.incidentSignal.count({ where: { id: { startsWith: 'test-part08-' } } })).resolves.toBe(0)
    await expect(prisma.measurement.count({ where: { id: { startsWith: 'test-part08-' } } })).resolves.toBe(0)
    await expect(prisma.investigation.count({ where: { id: { startsWith: 'test-part08-' } } })).resolves.toBe(0)
  })

  it('preserves durable cacheAvailable after a later failed run and maps live contract', async () => {
    fetchJson.mockRejectedValueOnce(new SafeFetchError({
      code: 'SAFE_FETCH_NETWORK_ERROR', safeMessage: 'raw network detail', sourceStatus: 'degraded', retryable: true,
    }))
    const result = await run({ includeDirectFallback: false })
    expect(result.status).toBe('failed')
    await expect(prisma.sourceHealth.findUniqueOrThrow({ where: { sourceId: 'gdelt' }, select: { cacheAvailable: true } }))
      .resolves.toEqual({ cacheAvailable: true })
    const status = await live.getStatus()
    expect(status.sources.map((source) => source.id)).toEqual(['kazhydromet-bulletins', 'gdelt', 'direct-sources'])
    expect(status.sources[1]?.cacheAvailable).toBe(true)
    await expect(prisma.incidentSignal.count({ where: { id: { startsWith: 'test-part08-' } } })).resolves.toBe(0)
    await expect(prisma.measurement.count({ where: { id: { startsWith: 'test-part08-' } } })).resolves.toBe(0)
  })

  it('retains a Mangystau-only raw snapshot but does not accept it for Atyrau', async () => {
    const canonicalUrl = 'https://www.zakon.kz/test-part08-mangystau-only'
    html = `<html><article><p>${'Актау Мангистау: загрязнение и нефтепродукты. '.repeat(3)}</p></article></html>`
    fetchJson.mockResolvedValueOnce(gdeltResponse('healthy', 'miss', canonicalUrl))

    const result = await run({ includeDirectFallback: false })
    expect(result).toMatchObject({
      status: 'failed', documents: [], gdelt: { acceptedCount: 0 },
    })
    const stored = await prisma.sourceDocument.findFirstOrThrow({
      where: { canonicalUrl },
      select: { id: true, cachePath: true, extractionMetadata: true },
    })
    trackedDocuments.add(stored.id)
    expect(stored.cachePath).toEqual(expect.any(String))
    expect(stored.extractionMetadata).toMatchObject({
      publicArticle: { matchedRequestedRegions: [], relevant: false },
    })
    const runRow = await prisma.ingestionRun.findUniqueOrThrow({
      where: { id: result.gdelt.runId },
      select: { acceptedCount: true, metadata: true },
    })
    expect(runRow).toMatchObject({
      acceptedCount: 0,
      metadata: { regionMismatchCount: 1 },
    })
  })

  it('fails closed on an invalid GDELT top-level response without advancing lastSuccessAt', async () => {
    html = articleHtml('health baseline')
    await run({ includeDirectFallback: false })
    const before = await prisma.sourceHealth.findUniqueOrThrow({
      where: { sourceId: 'gdelt' },
      select: { lastSuccessAt: true },
    })
    expect(before.lastSuccessAt).not.toBeNull()
    fetchJson.mockRejectedValueOnce(new SafeFetchError({
      code: 'SAFE_FETCH_RESPONSE_SCHEMA_INVALID',
      safeMessage: 'raw Zod issues must not persist',
    }))

    const result = await run({ includeDirectFallback: false })
    expect(result).toMatchObject({ status: 'failed', gdelt: { acceptedCount: 0 } })
    await expect(prisma.ingestionRun.findUniqueOrThrow({
      where: { id: result.gdelt.runId },
      select: { status: true, errorCode: true, errorMessage: true },
    })).resolves.toEqual({
      status: 'FAILED',
      errorCode: 'GDELT_RESPONSE_INVALID',
      errorMessage: 'GDELT response does not match the expected schema',
    })
    const health = await prisma.sourceHealth.findUniqueOrThrow({
      where: { sourceId: 'gdelt' },
      select: { status: true, lastSuccessAt: true, consecutiveErrors: true, detail: true },
    })
    expect(health).toMatchObject({
      status: 'FAILED',
      lastSuccessAt: before.lastSuccessAt,
      detail: 'GDELT_RESPONSE_INVALID: GDELT response does not match the expected schema',
    })
    expect(health.consecutiveErrors).toBeGreaterThan(0)
    expect(JSON.stringify(health)).not.toContain('raw Zod issues')
  })

  async function run(overrides: { includeDirectFallback: boolean; maxArticles?: number }): Promise<GdeltIngestionResponse> {
    const result = await service.run({
      from: '2025-09-01T00:00:00Z', to: '2025-09-30T23:59:59Z', regions: ['atyrau'],
      maxRecords: 25, maxArticles: overrides.maxArticles ?? 1,
      includeDirectFallback: overrides.includeDirectFallback,
    })
    trackedRuns.add(result.gdelt.runId)
    if (result.directFallback.runId) trackedRuns.add(result.directFallback.runId)
    for (const document of result.documents) trackedDocuments.add(document.sourceDocumentId)
    return result
  }
})

function gdeltResponse(
  sourceStatus: 'healthy' | 'rate_limited',
  cacheStatus: 'miss' | 'stale',
  articleUrl = 'https://azh.kz/test-part08/article',
): FetchJsonResult<GdeltResponse> {
  return {
    data: { articles: [{ url: articleUrl, title: 'Test Part 08 article' }] },
    metadata: {
      requestedUrl: 'https://api.gdeltproject.org/api/v2/doc/doc', finalUrl: 'https://api.gdeltproject.org/api/v2/doc/doc',
      statusCode: 200, contentType: 'application/json', fetchedAt: '2026-08-06T00:00:00Z',
      redirects: 0, attempts: 1, cacheStatus, sourceStatus,
    },
  }
}

function articleHtml(version: string): string {
  return `<html><head><meta property="og:title" content="Атырау: загрязнение">
    <meta property="article:published_time" content="2025-09-12T10:30:00+05:00"></head>
    <article><p>Атырау и Жайык: обнаружены нефтепродукты и загрязнение.</p><p>${version}</p></article></html>`
}

function articleHtmlWithPublishedAt(version: string, publishedAt: string | null): string {
  const publication = publishedAt === null
    ? ''
    : `<meta property="article:published_time" content="${publishedAt}">`
  return `<html><head><meta property="og:title" content="Атырау: загрязнение">${publication}</head>
    <article><p>Атырау и Жайык: обнаружены нефтепродукты и загрязнение.</p><p>${version}</p></article></html>`
}

function assertNotSupabase(value: string): void {
  const hostname = new URL(value).hostname.toLowerCase()
  if (hostname === 'supabase.co' || hostname.endsWith('.supabase.co') || hostname === 'pooler.supabase.com' || hostname.endsWith('.pooler.supabase.com')) {
    throw new Error('Supabase targets are forbidden for Part 08 DB e2e')
  }
}
