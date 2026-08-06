import { createHash } from 'node:crypto'

import {
  buildDocumentId,
  buildSourceDocumentIdentity,
} from '../../src/ingestion/kazhydromet/kazhydromet-document-identity'
import type { KazhydrometRawSnapshot, PdfCandidate } from '../../src/ingestion/kazhydromet/kazhydromet.types'

describe('Kazhydromet deterministic source identity', () => {
  it.each(['2025-05', '2025-09'])('keeps verified seed compatible Atyrau ID for %s', (period) => {
    expect(buildDocumentId(snapshot(period))).toBe(`doc-kazhydromet-${period}`)
  })

  it('builds a deterministic generic ID without event claims', () => {
    const value = snapshot('2025-09', { regions: ['mangystau'], language: 'unknown' })
    expect(buildDocumentId(value)).toBe(buildDocumentId(value))
    expect(buildDocumentId(value)).toMatch(/^doc-kazhydromet-mangystau-2025-09-[a-f0-9]{8}$/)
    expect(buildSourceDocumentIdentity(value)).toMatchObject({
      publisher: 'РГП «Казгидромет»',
      publishedPeriod: '2025-09',
      sha256: value.sha256,
    })
  })
})

function snapshot(period: string, overrides: Partial<PdfCandidate> = {}): KazhydrometRawSnapshot {
  const url = `https://www.kazhydromet.kz/uploads/atyrau-${period}-russ.pdf`
  const candidate: PdfCandidate = {
    url: new URL(url), canonicalUrl: url, listingUrl: 'https://www.kazhydromet.kz/bulletins',
    anchorText: '', contextText: '', publishedPeriod: period,
    regions: ['atyrau'], language: 'ru', discoveryMode: 'listing', confidence: 10,
    ...overrides,
  }
  const bytes = Buffer.from('%PDF-test')
  return {
    candidate, bytes, fetchedAt: new Date('2026-08-05T00:00:00Z'), httpStatus: 200,
    finalUrl: url, sha256: createHash('sha256').update(bytes).digest('hex'), sourceStatus: 'healthy',
  }
}
