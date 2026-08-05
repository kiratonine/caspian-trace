import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const requireFromScript = createRequire(import.meta.url)
const requireFromApi = createRequire(new URL('../apps/api/package.json', import.meta.url))
const { NestFactory } = requireFromApi('@nestjs/core')
const { AppModule } = requireFromScript('../apps/api/dist/app.module.js')
const { KazhydrometIngestionService } = requireFromScript(
  '../apps/api/dist/ingestion/kazhydromet/kazhydromet-ingestion.service.js',
)
const { PrismaService } = requireFromScript('../apps/api/dist/prisma/prisma.service.js')

const fixture = JSON.parse(
  readFileSync(new URL('../data/verified/atyrau-2025-09.json', import.meta.url), 'utf8'),
)
const manifest = JSON.parse(
  readFileSync(new URL('../data/verified/manifest.json', import.meta.url), 'utf8'),
)
if (manifest.reviewPolicy?.completedHumanReviewers !== 0 || manifest.reviewPolicy?.requiredHumanReviewers !== 2) {
  throw new Error('Part 07 smoke expects the current pending 0/2 human-review gate')
}

let app
try {
  app = await NestFactory.createApplicationContext(AppModule, { logger: false })
  const service = app.get(KazhydrometIngestionService)
  const prisma = app.get(PrismaService)
  const result = await service.run({
    from: '2025-09', to: '2025-09', regions: ['atyrau'], maxDocuments: 1,
  })
  const accepted = result.documents.find(
    (document) => document.sourceDocumentId === fixture.document.id && document.pageCount > 0,
  )
  if (!accepted || result.status === 'failed' || result.status === 'rate_limited') {
    throw new Error('Kazhydromet September smoke did not accept the expected cached document')
  }
  const stored = await prisma.sourceDocument.findUnique({
    where: { id: fixture.document.id },
    select: {
      originalUrl: true, canonicalUrl: true, sha256: true, cachePath: true,
      pages: { where: { pageNumber: fixture.document.sourcePage }, select: { pageNumber: true, extractedText: true } },
    },
  })
  if (!stored?.cachePath || stored.sha256 !== fixture.document.sha256) {
    throw new Error('Kazhydromet September smoke snapshot does not match the pending fixture SHA')
  }
  if (stored.originalUrl !== fixture.document.url || stored.canonicalUrl !== fixture.document.url) {
    throw new Error('Kazhydromet September smoke URL does not match the pending fixture')
  }
  const expectedPage = stored.pages.find((page) => page.pageNumber === fixture.document.sourcePage)
  if (!expectedPage || !accepted.relevantPageNumbers.includes(fixture.document.sourcePage)) {
    throw new Error('Kazhydromet September smoke did not detect the expected relevant page')
  }
  for (const measurement of fixture.measurements) {
    if (!expectedPage.extractedText.includes(measurement.rawValueText)) {
      throw new Error('Kazhydromet September smoke page is missing a pending fixture raw value')
    }
  }
  const cacheBacked = result.status === 'partial'
  console.log(
    `Kazhydromet September smoke passed (${cacheBacked ? 'degraded/cache-capable run' : 'live healthy run'}, ${accepted.pageCount} pages, ${accepted.validatedCandidateCount} candidate matches)`,
  )
  console.log('Automated match to pending verified fixture; human review remains 0/2')
} finally {
  if (app) await app.close()
}
