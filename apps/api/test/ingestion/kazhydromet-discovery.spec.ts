import {
  detectRegions,
  discoverPdfCandidates,
  parsePublishedPeriod,
} from '../../src/ingestion/kazhydromet/kazhydromet-discovery'
import { buildDocumentId } from '../../src/ingestion/kazhydromet/kazhydromet-document-identity'
import { PdfCandidateSchema, type PdfCandidate } from '../../src/ingestion/kazhydromet/kazhydromet.types'

const request = {
  from: '2025-05',
  to: '2025-09',
  regions: ['atyrau', 'mangystau'] as const,
  maxDocuments: 10,
}

describe('Kazhydromet PDF discovery', () => {
  it('resolves relative and accepts absolute exact-host PDF links', () => {
    const results = discover(`
      <ul>
        <li>Атырау сентябрь 2025 русский <a href="/uploads/atyrau-russ.pdf">PDF</a></li>
        <li>Мангистау май 2025 <a href="https://kazhydromet.kz/files/mangystau.pdf">PDF</a></li>
      </ul>`)
    expect(results.map((value) => value.canonicalUrl)).toEqual([
      'https://kazhydromet.kz/files/mangystau.pdf',
      'https://www.kazhydromet.kz/uploads/atyrau-russ.pdf',
    ])
  })

  it.each([
    ['external host', 'https://evil.example/atyrau-september-2025.pdf'],
    ['lookalike host', 'https://www.kazhydromet.kz.evil.example/atyrau-september-2025.pdf'],
    ['non-PDF link', 'https://www.kazhydromet.kz/atyrau-september-2025.html'],
  ])('rejects %s', (_label, href) => {
    expect(discover(`<p>Атырау сентябрь 2025 <a href="${href}">Bulletin</a></p>`)).toEqual([])
  })

  it('deduplicates URLs and prefers Russian deterministically before limit', () => {
    const results = discover(`
      <div>Атырау сентябрь 2025 қазақ <a href="/a-kaz.pdf">PDF</a></div>
      <div>Атырау сентябрь 2025 русский <a href="/z-russ.pdf">PDF</a></div>
      <div>Атырау сентябрь 2025 русский <a href="/z-russ.pdf">duplicate PDF</a></div>
    `, 1)
    expect(results).toHaveLength(1)
    expect(results[0]?.canonicalUrl).toContain('z-russ.pdf')
    expect(results[0]?.language).toBe('ru')
  })

  it.each([
    ['сентябрь 2025', '2025-09'],
    ['за май 2025', '2025-05'],
    ['09.2025', '2025-09'],
    ['2025-05', '2025-05'],
    ['may 2025', '2025-05'],
    ['atyrau-russ-byulleten-za-sentyabr-2025g.pdf', '2025-09'],
    ['2025', null],
  ])('parses unambiguous period %s', (value, expected) => {
    expect(parsePublishedPeriod(value)).toBe(expected)
  })

  it('requires an unambiguous period within the requested range', () => {
    expect(discover('<p>Атырау апрель 2025 <a href="/old.pdf">PDF</a></p>')).toEqual([])
    expect(discover('<p>Атырау 2025 <a href="/year.pdf">PDF</a></p>')).toEqual([])
  })

  it('detects exact regional markers without inventing a region', () => {
    expect(detectRegions('Жайык, Атырау')).toEqual(['atyrau'])
    expect(detectRegions('Каспий, Маңғыстау, Актау')).toEqual(['mangystau'])
    expect(detectRegions('Казахстан')).toEqual([])
  })

  it('keeps only requested regions for mixed-region HTML and preserves the Atyrau seed identity', () => {
    const [candidate] = discoverPdfCandidates({
      html: '<p>Атырау Мангистау сентябрь 2025 русский <a href="/mixed.pdf">PDF</a></p>',
      listingFinalUrl: 'https://www.kazhydromet.kz/bulletins',
      allowedHosts: ['kazhydromet.kz', 'www.kazhydromet.kz'],
      request: { ...request, regions: ['atyrau'], maxDocuments: 1 },
    })
    expect(candidate?.regions).toEqual(['atyrau'])
    expect(buildDocumentId({
      candidate: candidate!,
      bytes: Buffer.from('%PDF-test'),
      fetchedAt: new Date('2026-08-06T00:00:00Z'),
      httpStatus: 200,
      finalUrl: candidate!.canonicalUrl,
      sha256: 'a'.repeat(64),
      sourceStatus: 'healthy',
    })).toBe('doc-kazhydromet-2025-09')
  })

  it('rejects malformed candidates at the Zod boundary', () => {
    expect(PdfCandidateSchema.safeParse({ canonicalUrl: 'javascript:alert(1)' }).success).toBe(false)
  })
})

function discover(html: string, maxDocuments = 10): PdfCandidate[] {
  return discoverPdfCandidates({
    html,
    listingFinalUrl: 'https://www.kazhydromet.kz/bulletins',
    allowedHosts: ['kazhydromet.kz', 'www.kazhydromet.kz'],
    request: { ...request, regions: [...request.regions], maxDocuments },
  })
}
