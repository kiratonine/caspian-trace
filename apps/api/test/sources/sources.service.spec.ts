import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import type { PlatformEnvironment } from '../../src/config/environment'
import { SourceDocumentStatus } from '../../src/generated/prisma/enums'
import { prepareSourceSnapshot } from '../../src/sources/source-snapshot'
import { SourcesRepository } from '../../src/sources/sources.repository'
import { SourcesService } from '../../src/sources/sources.service'
import { SOURCE_STORAGE } from '../../src/sources/storage/storage.constants'
import type { SourceStoragePort } from '../../src/sources/storage/storage.port'
import type { SourceForCache } from '../../src/sources/sources.types'

const bytes = Buffer.from('%PDF-1.7\ntrusted source')
const fetchedAt = new Date('2026-08-05T10:00:00.000Z')
const prepared = prepareSourceSnapshot({
  bytes,
  mediaType: 'application/pdf',
  sourceType: 'kazhydromet_bulletin',
  publishedPeriod: '2025-09',
  fetchedAt,
  maxBytes: 15_728_640,
})

const document: SourceForCache = {
  id: 'test-part05-document',
  sourceType: 'kazhydromet_bulletin',
  mediaType: 'application/pdf',
  publishedPeriod: '2025-09',
  fetchedAt: null,
  sha256: null,
  cachePath: null,
  httpStatus: null,
  status: SourceDocumentStatus.UNVERIFIED,
}

describe('SourcesService', () => {
  const findForCache = jest.fn()
  const findForOpen = jest.fn()
  const attachSnapshot = jest.fn()
  const uploadImmutableSnapshot = jest.fn()
  const createSignedReadUrl = jest.fn()
  const download = jest.fn()
  let service: SourcesService

  beforeAll(async () => {
    const storage: jest.Mocked<SourceStoragePort> = {
      uploadImmutableSnapshot,
      createSignedReadUrl,
      exists: jest.fn(),
      download,
    }
    const module = await Test.createTestingModule({
      providers: [
        SourcesService,
        {
          provide: SourcesRepository,
          useValue: { findForCache, findForOpen, attachSnapshot },
        },
        { provide: SOURCE_STORAGE, useValue: storage },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: keyof PlatformEnvironment) =>
              key === 'HTTP_MAX_BYTES' ? 15_728_640 : 120,
            ),
          },
        },
      ],
    }).compile()
    service = module.get(SourcesService)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    findForCache.mockResolvedValue(document)
    uploadImmutableSnapshot.mockResolvedValue({
      path: prepared.cachePath,
      sha256: prepared.sha256,
      created: true,
    })
    attachSnapshot.mockResolvedValue({
      document: {
        ...document,
        sha256: prepared.sha256,
        cachePath: prepared.cachePath,
        fetchedAt,
        httpStatus: 200,
      },
      attached: true,
    })
    download.mockResolvedValue(Buffer.from(bytes))
  })

  it('rejects a missing document before upload', async () => {
    findForCache.mockResolvedValueOnce(null)
    await expect(cache(service)).rejects.toMatchObject({
      response: { code: 'SOURCE_DOCUMENT_NOT_FOUND' },
    })
    expect(uploadImmutableSnapshot).not.toHaveBeenCalled()
  })

  it('blocks a persisted SHA mismatch before upload', async () => {
    findForCache.mockResolvedValueOnce({ ...document, sha256: 'a'.repeat(64) })
    await expect(cache(service)).rejects.toMatchObject({
      response: { code: 'SOURCE_SNAPSHOT_HASH_CONFLICT' },
    })
    expect(uploadImmutableSnapshot).not.toHaveBeenCalled()
  })

  it('uploads first, then attaches only controlled fields without status promotion', async () => {
    await expect(cache(service)).resolves.toEqual({
      sourceDocumentId: document.id,
      sha256: prepared.sha256,
      cachePath: prepared.cachePath,
      created: true,
      attached: true,
      status: SourceDocumentStatus.UNVERIFIED,
    })
    expect(
      uploadImmutableSnapshot.mock.invocationCallOrder[0],
    ).toBeLessThan(attachSnapshot.mock.invocationCallOrder[0] ?? 0)
    expect(attachSnapshot).toHaveBeenCalledWith({
      sourceDocumentId: document.id,
      sha256: prepared.sha256,
      cachePath: prepared.cachePath,
      fetchedAt,
      httpStatus: 200,
    })
  })

  it('reports an identical retry as idempotent', async () => {
    uploadImmutableSnapshot.mockResolvedValueOnce({
      path: prepared.cachePath,
      sha256: prepared.sha256,
      created: false,
    })
    attachSnapshot.mockResolvedValueOnce({
      document: {
        ...document,
        sha256: prepared.sha256,
        cachePath: prepared.cachePath,
      },
      attached: false,
    })
    await expect(cache(service)).resolves.toMatchObject({
      created: false,
      attached: false,
    })
  })

  it('keeps a validated immutable path when publication metadata appears later', async () => {
    const fetchedPath = prepareSourceSnapshot({
      bytes,
      mediaType: 'application/pdf',
      sourceType: document.sourceType,
      publishedPeriod: null,
      fetchedAt,
      maxBytes: 15_728_640,
    }).cachePath
    findForCache.mockResolvedValueOnce({
      ...document,
      sha256: prepared.sha256,
      cachePath: fetchedPath,
    })
    uploadImmutableSnapshot.mockResolvedValueOnce({
      path: fetchedPath,
      sha256: prepared.sha256,
      created: false,
    })
    attachSnapshot.mockResolvedValueOnce({
      document: { ...document, sha256: prepared.sha256, cachePath: fetchedPath },
      attached: false,
    })

    await expect(cache(service)).resolves.toMatchObject({
      cachePath: fetchedPath,
      created: false,
      attached: false,
    })
    expect(uploadImmutableSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ path: fetchedPath, sha256: prepared.sha256 }),
    )
  })

  it('blocks a conflicting persisted cache path before upload', async () => {
    findForCache.mockResolvedValueOnce({
      ...document,
      sha256: prepared.sha256,
      cachePath: `other/2025/09/${prepared.sha256}.pdf`,
    })
    await expect(cache(service)).rejects.toMatchObject({
      response: { code: 'SOURCE_CACHE_PATH_CONFLICT' },
    })
    expect(uploadImmutableSnapshot).not.toHaveBeenCalled()
  })

  it('keeps an immutable orphan after DB failure so retry can attach it', async () => {
    attachSnapshot
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({
        document: {
          ...document,
          sha256: prepared.sha256,
          cachePath: prepared.cachePath,
        },
        attached: true,
      })
    uploadImmutableSnapshot
      .mockResolvedValueOnce({
        path: prepared.cachePath,
        sha256: prepared.sha256,
        created: true,
      })
      .mockResolvedValueOnce({
        path: prepared.cachePath,
        sha256: prepared.sha256,
        created: false,
      })

    await expect(cache(service)).rejects.toThrow('database unavailable')
    await expect(cache(service)).resolves.toMatchObject({
      created: false,
      attached: true,
    })
    expect(uploadImmutableSnapshot).toHaveBeenCalledTimes(2)
  })

  it('opens a cached PDF with the configured TTL and page fragment', async () => {
    findForOpen.mockResolvedValueOnce({
      id: document.id,
      mediaType: 'application/pdf',
      sha256: prepared.sha256,
      cachePath: prepared.cachePath,
      status: SourceDocumentStatus.UNVERIFIED,
    })
    createSignedReadUrl.mockResolvedValueOnce(
      'https://project.supabase.co/storage/object/sign/source?token=safe',
    )
    await expect(service.openSource(document.id, 22)).resolves.toEqual({
      location:
        'https://project.supabase.co/storage/object/sign/source?token=safe#page=22',
    })
    expect(createSignedReadUrl).toHaveBeenCalledWith(prepared.cachePath, 120)
  })

  it('rejects missing cache and page on a non-PDF snapshot', async () => {
    findForOpen.mockResolvedValueOnce({ ...document, sourceType: undefined })
    await expect(service.openSource(document.id)).rejects.toMatchObject({
      response: { code: 'SOURCE_SNAPSHOT_NOT_AVAILABLE' },
    })

    const textPrepared = prepareSourceSnapshot({
      bytes: Buffer.from('text'),
      mediaType: 'text/plain',
      sourceType: 'direct_source',
      publishedPeriod: null,
      fetchedAt,
      maxBytes: 100,
    })
    findForOpen.mockResolvedValueOnce({
      id: document.id,
      mediaType: 'text/plain',
      sha256: textPrepared.sha256,
      cachePath: textPrepared.cachePath,
      status: SourceDocumentStatus.UNVERIFIED,
    })
    await expect(service.openSource(document.id, 1)).rejects.toMatchObject({
      response: { code: 'SOURCE_PAGE_NOT_SUPPORTED' },
    })
  })

  it('reads a private cached snapshot only after path, size, and SHA verification', async () => {
    findForCache.mockResolvedValueOnce({
      ...document, sha256: prepared.sha256, cachePath: prepared.cachePath,
    })
    await expect(service.readCachedSourceSnapshot(document.id)).resolves.toEqual({
      bytes, mediaType: 'application/pdf', sha256: prepared.sha256, cachePath: prepared.cachePath,
    })
    expect(download).toHaveBeenCalledWith(prepared.cachePath)
  })

  it('rejects a mutated cached snapshot without returning bytes', async () => {
    findForCache.mockResolvedValueOnce({
      ...document, sha256: prepared.sha256, cachePath: prepared.cachePath,
    })
    download.mockResolvedValueOnce(Buffer.from('%PDF-mutated'))
    await expect(service.readCachedSourceSnapshot(document.id)).rejects.toMatchObject({
      response: { code: 'STORAGE_IMMUTABILITY_VIOLATION' },
    })
  })
})

function cache(service: SourcesService): ReturnType<SourcesService['cacheExistingSourceSnapshot']> {
  return service.cacheExistingSourceSnapshot({
    sourceDocumentId: document.id,
    bytes,
    mediaType: 'application/pdf; charset=binary',
    fetchedAt,
    httpStatus: 200,
  })
}
