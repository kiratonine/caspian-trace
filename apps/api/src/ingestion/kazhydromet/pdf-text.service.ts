import { createHash } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { PlatformEnvironment } from '../../config/environment'
import { kazhydrometError } from '../ingestion.errors'
import type { PdfPage } from './kazhydromet.types'

export const PDFJS_LOADER = Symbol('PDFJS_LOADER')

interface PdfTextItem {
  str: string
  transform: number[]
}

interface PdfDocumentLike {
  numPages: number
  getPage(pageNumber: number): Promise<{
    getTextContent(): Promise<{ items: unknown[] }>
    cleanup(): void
  }>
  destroy(): Promise<void>
}

interface PdfLoadingTaskLike {
  promise: Promise<PdfDocumentLike>
  destroy(): Promise<void>
}

export interface PdfJsModuleLike {
  getDocument(input: {
    data: Uint8Array
    isEvalSupported: false
    useWorkerFetch: false
  }): PdfLoadingTaskLike
}

export type PdfJsLoader = () => Promise<PdfJsModuleLike>

// Native import must survive the API's CommonJS compilation because pdfjs ships as ESM.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const importPdfJsModule = new Function(
  'return import("pdfjs-dist/legacy/build/pdf.mjs")',
) as PdfJsLoader

export const loadPdfJs: PdfJsLoader = () => importPdfJsModule()

@Injectable()
export class PdfTextService {
  private readonly maxPages: number
  private readonly maxTextChars: number

  constructor(
    config: ConfigService<PlatformEnvironment, true>,
    @Inject(PDFJS_LOADER) private readonly loader: PdfJsLoader,
  ) {
    this.maxPages = config.getOrThrow('KAZHYDROMET_PDF_MAX_PAGES')
    this.maxTextChars = config.getOrThrow('KAZHYDROMET_PDF_MAX_TEXT_CHARS')
  }

  async extractPages(buffer: Buffer): Promise<PdfPage[]> {
    if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw kazhydrometError('KAZHYDROMET_PDF_INVALID', 'Kazhydromet response is not a PDF')
    }
    const pdfjs = await this.loader()
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(Buffer.from(buffer)),
      isEvalSupported: false,
      useWorkerFetch: false,
    })
    let document: PdfDocumentLike | undefined
    try {
      document = await loadingTask.promise
      if (document.numPages > this.maxPages) {
        throw kazhydrometError('KAZHYDROMET_PDF_TOO_MANY_PAGES', 'Kazhydromet PDF has too many pages')
      }
      const pages: PdfPage[] = []
      let totalCharacters = 0
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber)
        try {
          const content = await page.getTextContent()
          const text = reconstructText(content.items)
          totalCharacters += text.length
          if (totalCharacters > this.maxTextChars) {
            throw kazhydrometError('KAZHYDROMET_PDF_TEXT_TOO_LARGE', 'Extracted Kazhydromet text is too large')
          }
          pages.push({
            pageNumber,
            text,
            textSha256: createHash('sha256').update(text).digest('hex'),
          })
        } finally {
          page.cleanup()
        }
      }
      if (!pages.some((page) => /\S/u.test(page.text))) {
        throw kazhydrometError('KAZHYDROMET_PDF_TEXT_EMPTY', 'Kazhydromet PDF contains no extractable text')
      }
      return pages
    } finally {
      if (document) await document.destroy()
      else await loadingTask.destroy()
    }
  }
}

export function reconstructText(items: unknown[]): string {
  const lines: Array<{ y: number; items: Array<{ x: number; str: string }> }> = []
  for (const item of items) {
    if (!isTextItem(item) || item.str.length === 0) continue
    const x = item.transform[4] ?? 0
    const y = item.transform[5] ?? 0
    let line = lines.find((candidate) => Math.abs(candidate.y - y) <= 2)
    if (!line) {
      line = { y, items: [] }
      lines.push(line)
    }
    line.items.push({ x, str: item.str })
  }
  return lines
    .sort((left, right) => right.y - left.y)
    .map((line) => line.items.sort((left, right) => left.x - right.x).map((item) => item.str).join(' '))
    .join('\n')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/[\s\uFEFF]+$/u, '')
}

function isTextItem(value: unknown): value is PdfTextItem {
  return typeof value === 'object' && value !== null &&
    'str' in value && typeof value.str === 'string' &&
    'transform' in value && Array.isArray(value.transform) &&
    value.transform.every((coordinate) => typeof coordinate === 'number')
}
