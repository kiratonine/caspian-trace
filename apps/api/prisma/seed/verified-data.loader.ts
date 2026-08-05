import { readFile, realpath, stat } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

import { z } from 'zod'

import {
  measurementFixtureSchema,
  stationRelationFixtureSchema,
  verifiedManifestSchema,
  type ManifestFixture,
  type MeasurementFixture,
  type StationRelationFixture,
} from './verified-data.schemas'
import {
  VerifiedSeedError,
  schemaError,
} from './verified-seed.errors'
import type {
  LoadedDocument,
  LoadedStation,
  LoadedVerifiedData,
} from './verified-seed.types'
import {
  assertManifestReviewMatches,
  calculateHumanReview,
} from './verified-data.policy'

export function findRepositoryRoot(
  startDirectory = resolve(__dirname, '..', '..', '..', '..'),
): string {
  let current = resolve(startDirectory)
  while (true) {
    try {
      const packageJson = JSON.parse(
        readFileSync(resolve(current, 'package.json'), 'utf8'),
      ) as {
        workspaces?: unknown
      }
      if (Array.isArray(packageJson.workspaces)) return current
    } catch {
      // Continue towards the filesystem root.
    }
    const parent = resolve(current, '..')
    if (parent === current) {
      throw new VerifiedSeedError(
        'VERIFIED_DATA_PATH_INVALID',
        'Repository root containing data/verified was not found',
      )
    }
    current = parent
  }
}

export function defaultVerifiedDirectory(): string {
  return resolve(findRepositoryRoot(), 'data', 'verified')
}

export async function loadVerifiedData(
  verifiedDirectory = defaultVerifiedDirectory(),
): Promise<LoadedVerifiedData> {
  const directory = await realpath(verifiedDirectory).catch(() => {
    throw new VerifiedSeedError(
      'VERIFIED_DATA_PATH_INVALID',
      'Verified data directory is unavailable',
    )
  })
  const directoryStat = await stat(directory)
  if (!directoryStat.isDirectory()) {
    throw new VerifiedSeedError(
      'VERIFIED_DATA_PATH_INVALID',
      'Verified data path is not a directory',
    )
  }

  const manifestPath = await resolveFixturePath(directory, 'manifest.json')
  const manifest = parseSchema(
    verifiedManifestSchema,
    await readJson(manifestPath),
    'manifest.json',
  )
  const measurementFixtures: MeasurementFixture[] = []
  const relationFixtures: StationRelationFixture[] = []

  for (const entry of manifest.fixtures) {
    const fixturePath = await resolveFixturePath(directory, entry.path)
    const rawFixture = await readJson(fixturePath)
    if (entry.kind === 'measurements') {
      const fixture = parseSchema(
        measurementFixtureSchema,
        rawFixture,
        entry.path,
      )
      assertEntryDocument(entry, fixture.document, entry.path)
      measurementFixtures.push(fixture)
    } else {
      const fixture = parseSchema(
        stationRelationFixtureSchema,
        rawFixture,
        entry.path,
      )
      assertEntryDocument(entry, fixture.document, entry.path)
      relationFixtures.push(fixture)
    }
  }

  return validateLoadedData(manifest, measurementFixtures, relationFixtures)
}

async function resolveFixturePath(
  verifiedDirectory: string,
  manifestPath: string,
): Promise<string> {
  const normalized = manifestPath.replaceAll('\\', '/')
  if (
    isAbsolute(manifestPath) ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split('/').includes('..') ||
    normalized.startsWith('/') ||
    !normalized.endsWith('.json')
  ) {
    throw invalidPath()
  }

  const candidate = resolve(verifiedDirectory, normalized)
  const resolvedCandidate = await realpath(candidate).catch(() => {
    throw invalidPath()
  })
  const relativePath = relative(verifiedDirectory, resolvedCandidate)
  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw invalidPath()
  }
  const candidateStat = await stat(resolvedCandidate)
  if (!candidateStat.isFile()) throw invalidPath()
  return resolvedCandidate
}

function invalidPath(): VerifiedSeedError {
  return new VerifiedSeedError(
    'VERIFIED_DATA_PATH_INVALID',
    'Manifest fixture path must resolve to a JSON file inside data/verified',
  )
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown
  } catch (error) {
    if (error instanceof VerifiedSeedError) throw error
    throw schemaError('Verified fixture is not valid JSON')
  }
}

function parseSchema<T>(
  schema: z.ZodType<T>,
  value: unknown,
  filename: string,
): T {
  const parsed = schema.safeParse(value)
  if (parsed.success) return parsed.data
  const issue = parsed.error.issues[0]
  const issuePath = issue?.path.length ? ` at ${issue.path.join('.')}` : ''
  throw schemaError(
    `${filename}${issuePath}: ${issue?.message ?? 'schema validation failed'}`,
  )
}

function assertEntryDocument(
  entry: ManifestFixture,
  document: { sha256: string; sourcePage: number | null },
  filename: string,
): void {
  if (
    document.sha256 !== entry.documentSha256 ||
    document.sourcePage !== entry.sourcePage
  ) {
    throw schemaError(`${filename}: document provenance differs from manifest`)
  }
}

function validateLoadedData(
  manifest: LoadedVerifiedData['manifest'],
  measurementFixtures: MeasurementFixture[],
  relationFixtures: StationRelationFixture[],
): LoadedVerifiedData {
  const documents = new Map<string, LoadedDocument>()
  const stations = new Map<string, LoadedStation>()
  const measurementIds = new Set<string>()
  const relationIds = new Set<string>()
  const relationEdgesByDocument = new Set<string>()
  const measurements: LoadedVerifiedData['measurements'] = []
  const relations: LoadedVerifiedData['relations'] = []
  const checkedBy: string[][] = []

  for (const fixture of measurementFixtures) {
    addDocument(documents, {
      id: fixture.document.id,
      url: fixture.document.url,
      sha256: fixture.document.sha256,
      sourcePage: fixture.document.sourcePage,
      period: fixture.document.period,
    })
    for (const measurement of fixture.measurements) {
      if (measurementIds.has(measurement.id)) {
        throw schemaError(`Duplicate measurement ID: ${measurement.id}`)
      }
      measurementIds.add(measurement.id)
      assertItemProvenance(measurement, fixture.document)
      addStation(stations, measurement.stationId, measurement.stationLabel)
      checkedBy.push(measurement.checkedBy)
      measurements.push({ ...measurement, documentId: fixture.document.id })
    }
  }

  for (const fixture of relationFixtures) {
    const knownDocument = documents.get(fixture.document.id)
    if (!knownDocument) {
      throw schemaError(
        `Relation document has no measurement fixture: ${fixture.document.id}`,
      )
    }
    if (
      knownDocument.url !== fixture.document.url ||
      knownDocument.sha256 !== fixture.document.sha256
    ) {
      throw schemaError(`Conflicting document provenance: ${fixture.document.id}`)
    }
    for (const relation of fixture.relations) {
      if (relationIds.has(relation.id)) {
        throw schemaError(`Duplicate relation ID: ${relation.id}`)
      }
      relationIds.add(relation.id)
      const edge = JSON.stringify([
        fixture.document.id,
        relation.upstreamStationId,
        relation.downstreamStationId,
        relation.basis,
        relation.sourcePage,
      ])
      if (relationEdgesByDocument.has(edge)) {
        throw schemaError(`Duplicate relation edge in one document: ${edge}`)
      }
      relationEdgesByDocument.add(edge)
      if (
        !stations.has(relation.upstreamStationId) ||
        !stations.has(relation.downstreamStationId)
      ) {
        throw schemaError(`Relation references an unknown station: ${relation.id}`)
      }
      assertItemProvenance(relation, fixture.document)
      checkedBy.push(relation.checkedBy)
      relations.push({ ...relation, documentId: fixture.document.id })
    }
  }

  const humanReview = calculateHumanReview(
    checkedBy,
    manifest.reviewPolicy.requiredHumanReviewers,
  )
  assertManifestReviewMatches(manifest, humanReview)

  return {
    manifest,
    measurementFixtures,
    relationFixtures,
    documents: [...documents.values()],
    stations: [...stations.values()],
    measurements,
    relations,
    humanReview,
  }
}

function addDocument(
  documents: Map<string, LoadedDocument>,
  document: LoadedDocument,
): void {
  const existing = documents.get(document.id)
  if (!existing) {
    documents.set(document.id, document)
    return
  }
  if (JSON.stringify(existing) !== JSON.stringify(document)) {
    throw schemaError(`Conflicting document ID: ${document.id}`)
  }
}

function addStation(
  stations: Map<string, LoadedStation>,
  id: string,
  label: string,
): void {
  const existing = stations.get(id)
  if (existing && existing.label !== label) {
    throw new VerifiedSeedError(
      'SEED_CONFLICT_STATION_LABEL',
      `Station ${id} has conflicting labels`,
    )
  }
  stations.set(id, { id, label })
}

function assertItemProvenance(
  item: {
    sourceSha256: string
    sourcePage: number | null
    sourceUrl?: string
  },
  document: { sha256: string; sourcePage: number | null; url: string },
): void {
  if (
    item.sourceSha256 !== document.sha256 ||
    item.sourcePage !== document.sourcePage ||
    (item.sourceUrl !== undefined && item.sourceUrl !== document.url)
  ) {
    throw schemaError('Evidence item provenance differs from its document')
  }
}
