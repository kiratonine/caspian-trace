import { createHash } from 'node:crypto'
import type { Server } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../src/app.module'
import { configureApplication } from '../src/config/application.setup'
import { SourceDocumentStatus } from '../src/generated/prisma/enums'
import { PrismaService } from '../src/prisma/prisma.service'
import { prepareSourceSnapshot } from '../src/sources/source-snapshot'
import { SourcesRepository } from '../src/sources/sources.repository'
import { SourcesService } from '../src/sources/sources.service'
import { SOURCE_STORAGE } from '../src/sources/storage/storage.constants'
import type { SourceStoragePort } from '../src/sources/storage/storage.port'
import type {
  StoredSnapshot,
  UploadImmutableSnapshotInput,
} from '../src/sources/storage/storage.types'

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

class InMemorySourceStorage implements SourceStoragePort {
  private readonly objects = new Map<string, Buffer>()

  uploadImmutableSnapshot(
    input: UploadImmutableSnapshotInput,
  ): Promise<StoredSnapshot> {
    const existing = this.objects.get(input.path)
    if (existing) {
      const existingSha = createHash('sha256').update(existing).digest('hex')
      if (existingSha !== input.sha256) {
        throw new Error('test storage immutability violation')
      }
      return Promise.resolve({
        path: input.path,
        sha256: input.sha256,
        created: false,
      })
    }
    this.objects.set(input.path, Buffer.from(input.bytes))
    return Promise.resolve({ path: input.path, sha256: input.sha256, created: true })
  }

  createSignedReadUrl(path: string, expiresInSeconds: number): Promise<string> {
    if (!this.objects.has(path)) throw new Error('test object not found')
    return Promise.resolve(
      `https://storage.test.invalid/${encodeURIComponent(path)}?ttl=${expiresInSeconds}`,
    )
  }

  exists(path: string): Promise<boolean> {
    return Promise.resolve(this.objects.has(path))
  }

  download(path: string): Promise<Buffer> {
    const bytes = this.objects.get(path)
    if (!bytes) throw new Error('test object not found')
    return Promise.resolve(Buffer.from(bytes))
  }
}

describe('Source cache (disposable PostgreSQL e2e)', () => {
  const prefix = `test-part05-${process.pid}-${Date.now()}-`
  const ids = {
    main: `${prefix}main`,
    hashConflict: `${prefix}hash-conflict`,
    pathConflict: `${prefix}path-conflict`,
    recovery: `${prefix}recovery`,
  }
  const bytes = Buffer.from('immutable Part 05 source')
  const recoveryBytes = Buffer.from('immutable Part 05 recovery source')
  const fetchedAt = new Date('2026-08-05T12:34:56.000Z')
  const expected = prepareSourceSnapshot({
    bytes,
    mediaType: 'text/plain',
    sourceType: 'direct_source',
    publishedPeriod: '2025-09',
    fetchedAt,
    maxBytes: 15_728_640,
  })
  const recoveryExpected = prepareSourceSnapshot({
    bytes: recoveryBytes,
    mediaType: 'text/plain',
    sourceType: 'direct_source',
    publishedPeriod: '2025-09',
    fetchedAt,
    maxBytes: 15_728_640,
  })
  const storage = new InMemorySourceStorage()
  let app: INestApplication
  let server: Server
  let prisma: PrismaService
  let sources: SourcesService
  let repository: SourcesRepository

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SOURCE_STORAGE)
      .useValue(storage)
      .compile()
    app = module.createNestApplication({ bodyParser: false })
    configureApplication(app)
    await app.init()
    server = app.getHttpServer() as Server
    prisma = app.get(PrismaService)
    sources = app.get(SourcesService)
    repository = app.get(SourcesRepository)

    await Promise.all([
      createSource(prisma, ids.main),
      createSource(prisma, ids.recovery),
      createSource(prisma, ids.hashConflict, {
        sha256: 'a'.repeat(64),
      }),
      createSource(prisma, ids.pathConflict, {
        sha256: expected.sha256,
        cachePath: `other/2025/09/${expected.sha256}.txt`,
      }),
    ])
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.sourceDocument.deleteMany({
        where: { id: { startsWith: prefix } },
      })
    }
    if (app) await app.close()
  })

  it('attaches SHA/path/fetch metadata after immutable upload without promotion', async () => {
    const result = await cache(sources, ids.main, bytes, fetchedAt)
    expect(result).toMatchObject({
      sourceDocumentId: ids.main,
      sha256: expected.sha256,
      cachePath: expected.cachePath,
      created: true,
      attached: true,
      status: SourceDocumentStatus.UNVERIFIED,
    })
    const stored = await prisma.sourceDocument.findUniqueOrThrow({
      where: { id: ids.main },
      select: {
        sha256: true,
        cachePath: true,
        fetchedAt: true,
        httpStatus: true,
        status: true,
      },
    })
    expect(stored).toEqual({
      sha256: expected.sha256,
      cachePath: expected.cachePath,
      fetchedAt,
      httpStatus: 200,
      status: SourceDocumentStatus.UNVERIFIED,
    })
  })

  it('is idempotent and does not duplicate the object or DB attachment', async () => {
    await expect(cache(sources, ids.main, bytes, fetchedAt)).resolves.toMatchObject({
      created: false,
      attached: false,
    })
  })

  it('rejects SHA conflict before any upload', async () => {
    const before = await storage.exists(expected.cachePath)
    await expect(
      cache(sources, ids.hashConflict, Buffer.from('different'), fetchedAt),
    ).rejects.toMatchObject({
      response: { code: 'SOURCE_SNAPSHOT_HASH_CONFLICT' },
    })
    expect(await storage.exists(expected.cachePath)).toBe(before)
  })

  it('rejects a conflicting persisted cache path', async () => {
    await expect(
      cache(sources, ids.pathConflict, bytes, fetchedAt),
    ).rejects.toMatchObject({
      response: { code: 'SOURCE_CACHE_PATH_CONFLICT' },
    })
  })

  it('leaves a safe orphan on DB failure and attaches it on retry', async () => {
    const attach = jest
      .spyOn(repository, 'attachSnapshot')
      .mockRejectedValueOnce(new Error('synthetic DB failure'))
    await expect(
      cache(sources, ids.recovery, recoveryBytes, fetchedAt),
    ).rejects.toThrow('synthetic DB failure')
    expect(await storage.exists(recoveryExpected.cachePath)).toBe(true)
    await expect(
      cache(sources, ids.recovery, recoveryBytes, fetchedAt),
    ).resolves.toMatchObject({ created: false, attached: true })
    attach.mockRestore()
  })

  it('opens the persisted cache through a 302 without exposing DB fields', async () => {
    const response = await request(server)
      .get(`/api/source-documents/${ids.main}/open`)
      .expect(302)
    expect(response.headers.location).toContain('storage.test.invalid')
    expect(response.headers.location).toContain('ttl=120')
    expect(response.headers['cache-control']).toBe('private, no-store')
  })

  it('returns a PDF page fragment from persisted cache metadata', async () => {
    const pdfId = `${prefix}pdf`
    const pdfBytes = Buffer.from('%PDF-1.7\npart05')
    await createSource(prisma, pdfId, {
      sourceType: 'kazhydromet_bulletin',
      mediaType: 'application/pdf',
    })
    await sources.cacheExistingSourceSnapshot({
      sourceDocumentId: pdfId,
      bytes: pdfBytes,
      mediaType: 'application/pdf; charset=binary',
      fetchedAt,
      httpStatus: 200,
    })
    const response = await request(server)
      .get(`/api/source-documents/${pdfId}/open?page=22`)
      .expect(302)
    expect(response.headers.location?.endsWith('#page=22')).toBe(true)
  })
})

async function createSource(
  prisma: PrismaService,
  id: string,
  overrides: {
    sourceType?: string
    mediaType?: string
    sha256?: string
    cachePath?: string
  } = {},
): Promise<void> {
  await prisma.sourceDocument.create({
    data: {
      id,
      originalUrl: `https://example.com/${id}`,
      canonicalUrl: `https://example.com/${id}`,
      publisher: 'Part 05 DB test',
      title: 'Disposable source cache test',
      sourceType: overrides.sourceType ?? 'direct_source',
      mediaType: overrides.mediaType ?? 'text/plain',
      publishedPeriod: '2025-09',
      sha256: overrides.sha256,
      cachePath: overrides.cachePath,
      status: SourceDocumentStatus.UNVERIFIED,
    },
  })
}

function cache(
  sources: SourcesService,
  sourceDocumentId: string,
  bytes: Buffer,
  fetchedAt: Date,
): ReturnType<SourcesService['cacheExistingSourceSnapshot']> {
  return sources.cacheExistingSourceSnapshot({
    sourceDocumentId,
    bytes,
    mediaType: 'text/plain',
    fetchedAt,
    httpStatus: 200,
  })
}

function assertNotSupabase(value: string): void {
  const hostname = new URL(value).hostname.toLowerCase()
  if (
    hostname === 'supabase.co' ||
    hostname.endsWith('.supabase.co') ||
    hostname === 'pooler.supabase.com' ||
    hostname.endsWith('.pooler.supabase.com')
  ) {
    throw new Error('Supabase targets are forbidden for Part 05 DB e2e')
  }
}
