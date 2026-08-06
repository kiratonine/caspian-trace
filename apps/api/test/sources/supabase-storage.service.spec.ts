import { createHash } from 'node:crypto'

import { ConfigService } from '@nestjs/config'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { PlatformEnvironment } from '../../src/config/environment'
import { SupabaseStorageService } from '../../src/sources/storage/supabase-storage.service'

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }))

const bytes = Buffer.from('immutable source bytes')
const sha256 = createHash('sha256').update(bytes).digest('hex')
const input = {
  path: `direct_source/2026/08/${sha256}.txt`,
  bytes,
  mediaType: 'text/plain' as const,
  sha256,
  sourceDocumentId: 'test-part05-document',
}

describe('SupabaseStorageService', () => {
  const upload = jest.fn()
  const download = jest.fn()
  const createSignedUrl = jest.fn()
  const from = jest.fn(() => ({ upload, download, createSignedUrl }))
  const client = { storage: { from } } as unknown as SupabaseClient
  let service: SupabaseStorageService

  beforeEach(() => {
    jest.clearAllMocks()
    jest
      .mocked(createClient)
      .mockReturnValue(client as unknown as ReturnType<typeof createClient>)
    service = new SupabaseStorageService(
      new ConfigService<PlatformEnvironment, true>({
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'private-service-role',
        SUPABASE_SOURCE_BUCKET: 'source-documents',
      } as PlatformEnvironment),
    )
  })

  it('creates one server client with disabled auth persistence', () => {
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(createClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'private-service-role',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    )
  })

  it('uploads immutable bytes with upsert false and safe metadata', async () => {
    upload.mockResolvedValue({ data: { path: input.path }, error: null })
    await expect(service.uploadImmutableSnapshot(input)).resolves.toEqual({
      path: input.path,
      sha256,
      created: true,
    })
    expect(from).toHaveBeenCalledWith('source-documents')
    expect(upload).toHaveBeenCalledWith(input.path, bytes, {
      contentType: 'text/plain',
      upsert: false,
      cacheControl: '31536000',
      metadata: { sha256, sourceDocumentId: input.sourceDocumentId },
    })
  })

  it('verifies a duplicate by downloading and hashing the object', async () => {
    upload.mockResolvedValue({ data: null, error: { statusCode: '409' } })
    download.mockResolvedValue({ data: new Blob([bytes]), error: null })
    await expect(service.uploadImmutableSnapshot(input)).resolves.toEqual({
      path: input.path,
      sha256,
      created: false,
    })
  })

  it.each([
    ['legacy Duplicate error', { statusCode: '400', error: 'Duplicate' }],
    [
      'modern ResourceAlreadyExists statusCode',
      { status: 409, statusCode: 'ResourceAlreadyExists' },
    ],
    ['KeyAlreadyExists code', { status: '400', code: 'KeyAlreadyExists' }],
    ['already_exists error', { status: '400', error: 'already_exists' }],
  ])('verifies duplicate bytes for %s', async (_caseName, error) => {
    upload.mockResolvedValue({ data: null, error })
    download.mockResolvedValue({ data: new Blob([bytes]), error: null })

    await expect(service.uploadImmutableSnapshot(input)).resolves.toEqual({
      path: input.path,
      sha256,
      created: false,
    })
  })

  it('does not classify an arbitrary HTTP 400 as a duplicate', async () => {
    upload.mockResolvedValue({
      data: null,
      error: { statusCode: '400', error: 'BadRequest' },
    })

    await expect(service.uploadImmutableSnapshot(input)).rejects.toMatchObject({
      response: {
        code: 'SOURCE_STORAGE_UNAVAILABLE',
        message: 'Source storage is unavailable',
      },
    })
    expect(download).not.toHaveBeenCalled()
  })

  it('rejects duplicate bytes that violate their content-addressed path', async () => {
    upload.mockResolvedValue({ data: null, error: { statusCode: '409' } })
    download.mockResolvedValue({
      data: new Blob([Buffer.from('different')]),
      error: null,
    })
    await expect(service.uploadImmutableSnapshot(input)).rejects.toMatchObject({
      response: { code: 'STORAGE_IMMUTABILITY_VIOLATION' },
    })
  })

  it('creates a signed URL through the configured private bucket', async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://project.supabase.co/storage/signed?token=test' },
      error: null,
    })
    await expect(service.createSignedReadUrl(input.path, 120)).resolves.toBe(
      'https://project.supabase.co/storage/signed?token=test',
    )
    expect(createSignedUrl).toHaveBeenCalledWith(input.path, 120)
  })

  it.each([
    ['numeric status', { status: 404 }],
    ['string statusCode', { statusCode: '404' }],
    ['legacy error', { statusCode: '400', error: 'not_found' }],
    ['modern statusCode', { status: '400', statusCode: 'ResourceNotFound' }],
    ['object code', { status: '400', code: 'NoSuchKey' }],
  ])('recognizes a not-found download from %s', async (_caseName, error) => {
    download.mockResolvedValue({ data: null, error })

    await expect(service.exists(input.path)).resolves.toBe(false)
  })

  it('does not classify an arbitrary HTTP 400 as not found', async () => {
    download.mockResolvedValue({
      data: null,
      error: { status: '400', error: 'BadRequest' },
    })

    await expect(service.exists(input.path)).rejects.toMatchObject({
      response: {
        code: 'SOURCE_STORAGE_UNAVAILABLE',
        message: 'Source storage is unavailable',
      },
    })
  })

  it('normalizes SDK errors without exposing secret values', async () => {
    upload.mockResolvedValue({
      data: null,
      error: { statusCode: '500', message: 'private-service-role' },
    })
    await expect(service.uploadImmutableSnapshot(input)).rejects.toMatchObject({
      response: {
        code: 'SOURCE_STORAGE_UNAVAILABLE',
        message: 'Source storage is unavailable',
      },
    })
  })
})
