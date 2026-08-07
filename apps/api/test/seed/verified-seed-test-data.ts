import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { defaultVerifiedDirectory } from '../../prisma/seed/verified-data.loader'

export function copyVerifiedData(): string {
  const directory = mkdtempSync(join(tmpdir(), 'caspian-seed-fixtures-'))
  cpSync(defaultVerifiedDirectory(), directory, { recursive: true })
  return directory
}

export function removeVerifiedData(directory: string): void {
  rmSync(directory, { recursive: true, force: true })
}

export function readFixture<T>(directory: string, filename: string): T {
  return JSON.parse(readFileSync(join(directory, filename), 'utf8')) as T
}

export function writeFixture(
  directory: string,
  filename: string,
  value: unknown,
): void {
  writeFileSync(join(directory, filename), `${JSON.stringify(value, null, 2)}\n`)
}

export function mutateFixture<T>(
  directory: string,
  filename: string,
  mutate: (fixture: T) => void,
): void {
  const fixture = readFixture<T>(directory, filename)
  mutate(fixture)
  writeFixture(directory, filename, fixture)
}

export function completeHumanReview(directory: string): void {
  setHumanReview(directory, ['reviewer-alpha', 'reviewer-beta'])
}

export function setPendingHumanReview(
  directory: string,
): void {
  const manifest = readFixture<{
    reviewPolicy: {
      requiredHumanReviewers: number
      completedHumanReviewers: number
      status: string
    }
    fixtures: Array<{
      path: string
    }>
  }>(directory, 'manifest.json')

  for (const entry of manifest.fixtures) {
    mutateFixture<{
      measurements?: Array<{
        checkedBy: string[]
      }>
      relations?: Array<{
        checkedBy: string[]
      }>
    }>(
      directory,
      entry.path,
      (fixture) => {
        for (
          const item
          of fixture.measurements ??
          fixture.relations ??
          []
        ) {
          item.checkedBy = [
            'codex-automated-source-verification',
          ]
        }
      },
    )
  }

  manifest.reviewPolicy.requiredHumanReviewers = 2
  manifest.reviewPolicy.completedHumanReviewers = 0
  manifest.reviewPolicy.status = 'pending'

  writeFixture(
    directory,
    'manifest.json',
    manifest,
  )
}

export function setHumanReview(
  directory: string,
  reviewers: string[],
): void {
  const manifest = readFixture<{
    reviewPolicy: {
      requiredHumanReviewers: number
      completedHumanReviewers: number
      status: string
    }
    fixtures: Array<{ path: string }>
  }>(directory, 'manifest.json')
  for (const entry of manifest.fixtures) {
    mutateFixture<{
      measurements?: Array<{ checkedBy: string[] }>
      relations?: Array<{ checkedBy: string[] }>
    }>(directory, entry.path, (fixture) => {
      for (const item of fixture.measurements ?? fixture.relations ?? []) {
        item.checkedBy = reviewers
      }
    })
  }
  manifest.reviewPolicy.requiredHumanReviewers = reviewers.length
  manifest.reviewPolicy.completedHumanReviewers = reviewers.length
  manifest.reviewPolicy.status = 'complete'
  writeFixture(directory, 'manifest.json', manifest)
}

export function namespaceVerifiedData(
  directory: string,
  prefix = 'test-part03-',
): void {
  const manifest = readFixture<{ fixtures: Array<{ path: string }> }>(
    directory,
    'manifest.json',
  )
  for (const entry of manifest.fixtures) {
    mutateFixture<{
      document: { id: string }
      measurements?: Array<{ id: string; stationId: string }>
      relations?: Array<{
        id: string
        upstreamStationId: string
        downstreamStationId: string
      }>
    }>(directory, entry.path, (fixture) => {
      fixture.document.id = `${prefix}${fixture.document.id}`
      for (const measurement of fixture.measurements ?? []) {
        measurement.id = `${prefix}${measurement.id}`
        measurement.stationId = `${prefix}${measurement.stationId}`
      }
      for (const relation of fixture.relations ?? []) {
        relation.id = `${prefix}${relation.id}`
        relation.upstreamStationId = `${prefix}${relation.upstreamStationId}`
        relation.downstreamStationId = `${prefix}${relation.downstreamStationId}`
      }
    })
  }
}

export function reverseManifestFixtures(directory: string): void {
  mutateFixture<{ fixtures: unknown[] }>(
    directory,
    'manifest.json',
    (manifest) => manifest.fixtures.reverse(),
  )
}

export function addEarlierRelationEvidence(directory: string): void {
  mutateFixture<{
    relations: Array<{
      id: string
      upstreamStationId: string
      downstreamStationId: string
      basis: string
      sourceSha256: string
      sourcePage: number | null
      sourceExcerpt: string
      checkedBy: string[]
      checkedAt: string
    }>
  }>(directory, 'atyrau-2025-05-station-relations.json', (fixture) => {
    const existing = fixture.relations[0]
    if (!existing) throw new Error('Expected May station relation fixture')
    fixture.relations.push({
      ...existing,
      id: 'test-part03-a-earlier-relation-evidence',
      basis: 'official_monitoring_table_sequence_and_station_labels',
    })
  })
}

export function addRelationEvidenceFixture(
  directory: string,
  options: { filename: string; id: string; sourcePage: number | null },
): void {
  const source = readFixture<{
    document: {
      id: string
      url: string
      sha256: string
      sourcePage: number | null
      verificationStatus: string
    }
    relations: Array<{
      id: string
      upstreamStationId: string
      downstreamStationId: string
      basis: string
      sourceSha256: string
      sourcePage: number | null
      sourceExcerpt: string
      checkedBy: string[]
      checkedAt: string
    }>
  }>(directory, 'atyrau-2025-09-station-relations.json')
  const relation = source.relations.find(({ id }) => id.includes('asa-pair'))
  if (!relation) throw new Error('Expected September paired relation fixture')
  source.document.sourcePage = options.sourcePage
  source.relations = [
    { ...relation, id: options.id, sourcePage: options.sourcePage },
  ]
  writeFixture(directory, options.filename, source)

  mutateFixture<{
    fixtures: Array<{
      kind: string
      path: string
      documentSha256: string
      sourcePage: number | null
    }>
  }>(directory, 'manifest.json', (manifest) => {
    manifest.fixtures.push({
      kind: 'station_relations',
      path: options.filename,
      documentSha256: source.document.sha256,
      sourcePage: options.sourcePage,
    })
  })
}

export function replaceDocumentSha(
  directory: string,
  documentId: string,
  sha256: string,
): void {
  const manifest = readFixture<{
    fixtures: Array<{ path: string; documentSha256: string }>
  }>(directory, 'manifest.json')
  for (const entry of manifest.fixtures) {
    const fixture = readFixture<{
      document: { id: string; sha256: string }
      measurements?: Array<{ sourceSha256: string }>
      relations?: Array<{ sourceSha256: string }>
    }>(directory, entry.path)
    if (fixture.document.id !== documentId) continue
    entry.documentSha256 = sha256
    fixture.document.sha256 = sha256
    for (const item of fixture.measurements ?? fixture.relations ?? []) {
      item.sourceSha256 = sha256
    }
    writeFixture(directory, entry.path, fixture)
  }
  writeFixture(directory, 'manifest.json', manifest)
}

export function createOutsideSymlink(
  directory: string,
  name: string,
  target: string,
): boolean {
  try {
    symlinkSync(target, join(directory, name))
    return true
  } catch (error: unknown) {
    if (
      process.platform === 'win32' &&
      (error as NodeJS.ErrnoException).code === 'EPERM'
    ) {
      return false
    }
    throw error
  }
}
