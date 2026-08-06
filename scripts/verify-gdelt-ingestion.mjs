import { createRequire } from 'node:module'

const requireFromScript = createRequire(import.meta.url)
const requireFromApi = createRequire(new URL('../apps/api/package.json', import.meta.url))
const { NestFactory } = requireFromApi('@nestjs/core')
const { LiveStatusSchema } = requireFromApi('@caspian-trace/contracts')
const { AppModule } = requireFromScript('../apps/api/dist/app.module.js')
const { GdeltIngestionService } = requireFromScript(
  '../apps/api/dist/ingestion/gdelt/gdelt-ingestion.service.js',
)
const { findDirectSource } = requireFromScript(
  '../apps/api/dist/ingestion/direct-sources/direct-source-registry.js',
)
const { LiveService } = requireFromScript('../apps/api/dist/live/live.service.js')
const { PrismaService } = requireFromScript('../apps/api/dist/prisma/prisma.service.js')
const { SourcesService } = requireFromScript('../apps/api/dist/sources/sources.service.js')

const trackingParameters = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid',
])

let app
try {
  app = await NestFactory.createApplicationContext(AppModule, { logger: false })
  const ingestion = app.get(GdeltIngestionService)
  const liveService = app.get(LiveService)
  const prisma = app.get(PrismaService)
  const sources = app.get(SourcesService)
  const before = await protectedRowCounts(prisma)
  const result = await ingestion.run({
    from: '2025-09-01T00:00:00Z',
    to: '2025-09-30T23:59:59Z',
    regions: ['atyrau'],
    maxRecords: 25,
    maxArticles: 3,
    includeDirectFallback: true,
  })

  const currentDocuments = result.documents
  const documents = currentDocuments.length > 0
    ? currentDocuments
    : await existingCachedArticles(prisma)
  if (documents.length === 0) {
    throw new Error('BLOCKED — GDELT unavailable and no direct/cached article available')
  }
  for (const document of documents) {
    assertAllowedArticle(document)
    const snapshot = await sources.readCachedSourceSnapshot(document.sourceDocumentId)
    if (snapshot.sha256 !== document.sha256 || snapshot.cachePath !== document.cachePath) {
      throw new Error('Article snapshot provenance does not match its SourceDocument')
    }
  }

  const health = await prisma.sourceHealth.findMany({
    where: { sourceId: { in: ['gdelt', 'direct-sources'] } },
    select: { sourceId: true },
  })
  if (!health.some((row) => row.sourceId === 'gdelt')) {
    throw new Error('GDELT SourceHealth was not persisted')
  }
  LiveStatusSchema.parse(await liveService.getStatus())
  const after = await protectedRowCounts(prisma)
  if (
    before.incidentSignals !== after.incidentSignals ||
    before.measurements !== after.measurements ||
    before.investigations !== after.investigations
  ) {
    throw new Error('Part 08 smoke changed IncidentSignal, Measurement, or Investigation rows')
  }

  const mode = smokeMode(result, currentDocuments.length > 0)
  console.log(`PASS — ${mode} (${documents.length} immutable raw article snapshot(s))`)
  console.log(`GDELT status remains explicit: ${result.gdelt.status}`)
  console.log('Articles are raw discovery material, not verified incidents')
} finally {
  if (app) await app.close()
}

async function protectedRowCounts(prisma) {
  const [incidentSignals, measurements, investigations] = await Promise.all([
    prisma.incidentSignal.count(),
    prisma.measurement.count(),
    prisma.investigation.count(),
  ])
  return { incidentSignals, measurements, investigations }
}

async function existingCachedArticles(prisma) {
  const rows = await prisma.sourceDocument.findMany({
    where: {
      sourceType: 'public_article',
      sha256: { not: null },
      cachePath: { not: null },
    },
    orderBy: [{ fetchedAt: 'desc' }, { id: 'asc' }],
    take: 3,
    select: {
      id: true,
      canonicalUrl: true,
      sha256: true,
      cachePath: true,
    },
  })
  return rows.map((row) => ({
    sourceDocumentId: row.id,
    canonicalUrl: row.canonicalUrl,
    sha256: row.sha256,
    cachePath: row.cachePath,
  }))
}

function assertAllowedArticle(document) {
  if (typeof document.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(document.sha256)) {
    throw new Error('Article SHA-256 is invalid')
  }
  if (typeof document.cachePath !== 'string' || document.cachePath.length === 0) {
    throw new Error('Article has no private snapshot path')
  }
  const canonical = new URL(document.canonicalUrl)
  if (!findDirectSource(canonical.hostname)) throw new Error('Article host is outside the exact registry')
  for (const key of canonical.searchParams.keys()) {
    if (trackingParameters.has(key.toLowerCase())) {
      throw new Error('Canonical article URL contains a tracking parameter')
    }
  }
}

function smokeMode(result, hasCurrentDocuments) {
  if (!hasCurrentDocuments) return 'existing immutable article cache'
  if (result.gdelt.acceptedCount > 0 && result.gdelt.cacheStatus === 'stale') {
    return 'stale GDELT cache'
  }
  if (
    result.gdelt.acceptedCount > 0 && result.gdelt.sourceStatus === 'healthy' &&
    result.gdelt.cacheStatus === 'miss'
  ) return 'live GDELT'
  if (result.directFallback.acceptedCount > 0) return 'direct fallback'
  return 'cache-backed article ingestion'
}
