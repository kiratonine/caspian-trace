import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'

import {
  PDFJS_LOADER,
  PdfTextService,
  loadPdfJs,
  reconstructText,
  type PdfJsLoader,
} from '../../src/ingestion/kazhydromet/pdf-text.service'

describe('PdfTextService', () => {
  it('extracts a real synthetic PDF with one-based pages and deterministic hash', async () => {
    const service = await createService(loadPdfJs)
    const pages = await service.extractPages(buildPdf('Atyrau oil 0.234 mg/dm3'))
    expect(pages).toHaveLength(1)
    expect(pages[0]?.pageNumber).toBe(1)
    expect(pages[0]?.textSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(pages[0]?.text).toContain('Atyrau oil 0.234 mg/dm3')
    await expect(service.extractPages(buildPdf('Atyrau oil 0.234 mg/dm3'))).resolves.toEqual(pages)
  })

  it('requires the PDF signature before loading pdfjs', async () => {
    const loader: jest.MockedFunction<PdfJsLoader> = jest.fn()
    const service = await createService(loader)
    await expect(service.extractPages(Buffer.from('not pdf'))).rejects.toMatchObject({ code: 'KAZHYDROMET_PDF_INVALID' })
    expect(loader).not.toHaveBeenCalled()
  })

  it('reconstructs lines by coordinates deterministically', () => {
    expect(reconstructText([
      { str: 'second', transform: [1, 0, 0, 1, 20, 10] },
      { str: 'first', transform: [1, 0, 0, 1, 10, 20] },
      { str: 'line', transform: [1, 0, 0, 1, 10, 10] },
    ])).toBe('first\nline second')
  })

  it('enforces page, total text, and empty-text limits and destroys resources', async () => {
    const cases = [
      { pages: 2, maxPages: 1, maxChars: 100_000, text: 'text', code: 'KAZHYDROMET_PDF_TOO_MANY_PAGES' },
      { pages: 1, maxPages: 1, maxChars: 3, text: 'text', code: 'KAZHYDROMET_PDF_TEXT_TOO_LARGE' },
      { pages: 1, maxPages: 1, maxChars: 100_000, text: '   ', code: 'KAZHYDROMET_PDF_TEXT_EMPTY' },
    ]
    for (const testCase of cases) {
      const destroy = jest.fn().mockResolvedValue(undefined)
      const cleanup = jest.fn()
      const loader: PdfJsLoader = () => Promise.resolve({
        getDocument: () => ({
          promise: Promise.resolve({
            numPages: testCase.pages,
            getPage: () => Promise.resolve({
              getTextContent: () => Promise.resolve({ items: [{ str: testCase.text, transform: [1, 0, 0, 1, 0, 0] }] }),
              cleanup,
            }),
            destroy,
          }),
          destroy: jest.fn().mockResolvedValue(undefined),
        }),
      })
      const service = await createService(loader, testCase.maxPages, testCase.maxChars)
      await expect(service.extractPages(Buffer.from('%PDF-test'))).rejects.toMatchObject({ code: testCase.code })
      expect(destroy).toHaveBeenCalledTimes(1)
      if (testCase.pages <= testCase.maxPages) expect(cleanup).toHaveBeenCalled()
    }
  })
})

async function createService(loader: PdfJsLoader, maxPages = 300, maxChars = 5_000_000): Promise<PdfTextService> {
  const module = await Test.createTestingModule({
    providers: [
      PdfTextService,
      { provide: PDFJS_LOADER, useValue: loader },
      { provide: ConfigService, useValue: { getOrThrow: (key: string): number => key === 'KAZHYDROMET_PDF_MAX_PAGES' ? maxPages : maxChars } },
    ],
  }).compile()
  return module.get(PdfTextService)
}

function buildPdf(text: string): Buffer {
  const escaped = text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let output = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output))
    output += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(output)
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  output += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(output)
}
