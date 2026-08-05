import { HttpException } from '@nestjs/common'

import {
  assertPersistedCachePath,
  normalizeSourceMediaType,
  prepareSourceSnapshot,
} from '../../src/sources/source-snapshot'

const fetchedAt = new Date('2026-01-02T03:04:05.000Z')
const pdfBytes = Buffer.from('%PDF-1.7\nsource')

describe('source snapshot preparation', () => {
  it('builds a content-addressed path from the publication period', () => {
    const result = prepareSourceSnapshot({
      bytes: pdfBytes,
      mediaType: 'application/pdf; charset=binary',
      sourceType: 'kazhydromet_bulletin',
      publishedPeriod: '2025-09',
      fetchedAt,
      maxBytes: 1_000,
    })

    expect(result.mediaType).toBe('application/pdf')
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(result.cachePath).toBe(
      `kazhydromet_bulletin/2025/09/${result.sha256}.pdf`,
    )
  })

  it('uses UTC fetch year/month without inventing a publication period', () => {
    const result = prepareSourceSnapshot({
      bytes: Buffer.from('plain source'),
      mediaType: 'text/plain',
      sourceType: 'direct_source',
      publishedPeriod: null,
      fetchedAt,
      maxBytes: 1_000,
    })
    expect(result.cachePath).toBe(
      `direct_source/2026/01/${result.sha256}.txt`,
    )
  })

  it.each([
    ['text/html; charset=utf-8', 'text/html'],
    ['application/json', 'application/json'],
    ['text/plain', 'text/plain'],
  ])('normalizes supported media type %s', (input, expected) => {
    expect(normalizeSourceMediaType(input)).toBe(expected)
  })

  it.each([
    [
      (): unknown => normalizeSourceMediaType('image/png'),
      'SOURCE_MEDIA_TYPE_UNSUPPORTED',
    ],
    [
      (): unknown =>
        prepareSourceSnapshot({
          bytes: pdfBytes,
          mediaType: 'application/pdf',
          sourceType: '../escape',
          publishedPeriod: '2025-09',
          fetchedAt,
          maxBytes: 1_000,
        }),
      'SOURCE_TYPE_PATH_INVALID',
    ],
    [
      (): unknown =>
        prepareSourceSnapshot({
          bytes: Buffer.from('not pdf'),
          mediaType: 'application/pdf',
          sourceType: 'bulletin',
          publishedPeriod: '2025-09',
          fetchedAt,
          maxBytes: 1_000,
        }),
      'SOURCE_PDF_SIGNATURE_INVALID',
    ],
    [
      (): unknown =>
        prepareSourceSnapshot({
          bytes: Buffer.alloc(0),
          mediaType: 'text/plain',
          sourceType: 'direct_source',
          publishedPeriod: null,
          fetchedAt,
          maxBytes: 3,
        }),
      'SOURCE_DATA_INVALID',
    ],
    [
      (): unknown =>
        prepareSourceSnapshot({
          bytes: Buffer.from('1234'),
          mediaType: 'text/plain',
          sourceType: 'direct_source',
          publishedPeriod: null,
          fetchedAt,
          maxBytes: 3,
        }),
      'SOURCE_SNAPSHOT_TOO_LARGE',
    ],
  ])('rejects invalid snapshot input', (operation, code) => {
    expectHttpCode(operation, code)
  })

  it('validates persisted cache path hash and extension', () => {
    const prepared = prepareSourceSnapshot({
      bytes: pdfBytes,
      mediaType: 'application/pdf',
      sourceType: 'bulletin',
      publishedPeriod: '2025-09',
      fetchedAt,
      maxBytes: 1_000,
    })
    expect(
      assertPersistedCachePath({
        cachePath: prepared.cachePath,
        sha256: prepared.sha256,
        mediaType: prepared.mediaType,
      }),
    ).toBe('application/pdf')
    expectHttpCode(
      (): unknown =>
        assertPersistedCachePath({
          cachePath: prepared.cachePath.replace('.pdf', '.html'),
          sha256: prepared.sha256,
          mediaType: prepared.mediaType,
        }),
      'SOURCE_DATA_INVALID',
    )
  })
})

function expectHttpCode(operation: () => unknown, expected: string): void {
  try {
    operation()
    throw new Error('Expected operation to fail')
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException)
    expect((error as HttpException).getResponse()).toMatchObject({ code: expected })
  }
}
