import {
  ExtractionMode,
  Region,
  SourceDocumentStatus,
  StationRelationEvidenceBasis,
  StationRelationKind,
  VerificationStatus,
} from '../../src/generated/prisma/enums'
import { Prisma } from '../../src/generated/prisma/client'

import { relationVerificationStatus } from './verified-data.policy'
import { schemaError } from './verified-seed.errors'
import type { LoadedVerifiedData } from './verified-seed.types'

interface DocumentCatalogEntry {
  title: string
  publisher: string
  sourceType: string
  mediaType: string
}

const DOCUMENT_CATALOG: Readonly<Record<string, DocumentCatalogEntry>> = {
  'doc-kazhydromet-2025-09': {
    title: 'Бюллетень о состоянии окружающей среды Атырауской области, 2025-09',
    publisher: 'РГП «Казгидромет»',
    sourceType: 'kazhydromet_bulletin',
    mediaType: 'application/pdf',
  },
  'doc-kazhydromet-2025-05': {
    title: 'Бюллетень о состоянии окружающей среды Атырауской области, 2025-05',
    publisher: 'РГП «Казгидромет»',
    sourceType: 'kazhydromet_bulletin',
    mediaType: 'application/pdf',
  },
}

export interface MappedDocument {
  id: string
  originalUrl: string
  canonicalUrl: string
  publisher: string
  title: string
  sourceType: string
  mediaType: string
  publishedAt: null
  publishedPeriod: string
  fetchedAt: null
  sha256: string
  cachePath: null
  httpStatus: null
  status: typeof SourceDocumentStatus.UNVERIFIED
  extractionMetadata: Prisma.InputJsonObject
}

export interface MappedStation {
  id: string
  name: string
  waterBody: 'Жайык'
  region: typeof Region.ATYRAU
  locationText: null
  latitude: null
  longitude: null
  locationSourceDocumentId: null
  riverOrder: null
  metadata: Prisma.InputJsonObject
}

export interface MappedMeasurement {
  id: string
  stationId: string
  sourceDocumentId: string
  sourcePageId: null
  indicator: string
  value: Prisma.Decimal
  rawValueText: string
  unit: string
  matrix: 'water'
  sampledAt: Date | null
  sampledPeriod: string | null
  sourceExcerpt: string
  extractionMode: typeof ExtractionMode.VERIFIED_SEED
  verificationStatus:
  | typeof VerificationStatus.OFFICIAL
  | typeof VerificationStatus.UNVERIFIED
  metadata: Prisma.InputJsonObject
}

export interface MappedRelation {
  id: string
  fromStationId: string
  toStationId: string
  kind: typeof StationRelationKind.UPSTREAM_OF
  sourceDocumentId: null
  verificationStatus:
  | typeof VerificationStatus.OFFICIAL
  | typeof VerificationStatus.CORROBORATED
  | typeof VerificationStatus.UNVERIFIED
  notes: null
}

export interface MappedRelationEvidence {
  id: string
  stationRelationId: string
  sourceDocumentId: string
  sourcePage: number | null
  basis: StationRelationEvidenceBasis
  sourceExcerpt: string
  checkedBy: string[]
  checkedAt: string
  verificationStatus:
  | typeof VerificationStatus.OFFICIAL
  | typeof VerificationStatus.CORROBORATED
  | typeof VerificationStatus.UNVERIFIED
}

export interface MappedVerifiedData {
  documents: MappedDocument[]
  stations: MappedStation[]
  measurements: MappedMeasurement[]
  relations: MappedRelation[]
  relationEvidence: MappedRelationEvidence[]
}

export interface VerifiedDataMappingOptions {
  testOnlyIdPrefix?: 'test-part03-'
}

export function mapVerifiedData(
  data: LoadedVerifiedData,
  options: VerifiedDataMappingOptions = {},
): MappedVerifiedData {
  assertTestNamespace(data, options.testOnlyIdPrefix)
  const stationLabels = new Map(
    data.stations.map((station) => [station.id, station.label]),
  )
  const documents = data.documents.map((document): MappedDocument => {
    const catalogId = options.testOnlyIdPrefix
      ? document.id.slice(options.testOnlyIdPrefix.length)
      : document.id
    const catalog = DOCUMENT_CATALOG[catalogId]
    if (!catalog) throw schemaError(`Unknown seed document: ${document.id}`)
    return {
      id: document.id,
      originalUrl: document.url,
      canonicalUrl: document.url,
      ...catalog,
      publishedAt: null,
      publishedPeriod: document.period,
      fetchedAt: null,
      sha256: document.sha256,
      cachePath: null,
      httpStatus: null,
      status: SourceDocumentStatus.UNVERIFIED,
      extractionMetadata: {
        provenance: 'verified_manifest',
        sourcePage: document.sourcePage,
        humanReviewComplete: data.humanReview.complete,
        humanReviewers: data.humanReview.completed,
      },
    }
  })

  const stations = data.stations.map(
    (station): MappedStation => ({
      id: station.id,
      name: station.label,
      waterBody: 'Жайык',
      region: Region.ATYRAU,
      locationText: null,
      latitude: null,
      longitude: null,
      locationSourceDocumentId: null,
      riverOrder: null,
      metadata: { provenance: 'verified_manifest' },
    }),
  )

  const measurements = data.measurements.map(
    (measurement): MappedMeasurement => ({
      id: measurement.id,
      stationId: measurement.stationId,
      sourceDocumentId: measurement.documentId,
      sourcePageId: null,
      indicator: measurement.indicator,
      value: new Prisma.Decimal(measurement.normalizedValue),
      rawValueText: measurement.rawValueText,
      unit: measurement.unit,
      matrix: 'water',
      sampledAt:
        measurement.sampledAt === null
          ? null
          : new Date(`${measurement.sampledAt}T00:00:00.000Z`),
      sampledPeriod: measurement.sampledPeriod,
      sourceExcerpt: measurement.sourceExcerpt,
      extractionMode: ExtractionMode.VERIFIED_SEED,
      verificationStatus: data.humanReview.complete
        ? VerificationStatus.OFFICIAL
        : VerificationStatus.UNVERIFIED,
      metadata: {
        sourcePage: measurement.sourcePage,
        checkedBy: measurement.checkedBy,
        checkedAt: measurement.checkedAt,
      },
    }),
  )

  const groupedRelations = new Map<
    string,
    LoadedVerifiedData['relations']
  >()
  for (const relation of data.relations) {
    const edge = `${relation.upstreamStationId}:${relation.downstreamStationId}:${StationRelationKind.UPSTREAM_OF}`
    const evidence = groupedRelations.get(edge) ?? []
    evidence.push(relation)
    groupedRelations.set(edge, evidence)
  }

  const relations: MappedRelation[] = []
  const relationEvidence: MappedRelationEvidence[] = []
  for (const [edge, unsortedEvidence] of [...groupedRelations.entries()].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const evidence = [...unsortedEvidence].sort((left, right) =>
      left.id.localeCompare(right.id),
    )
    const primary = evidence[0]
    if (!primary) throw schemaError(`Station relation edge has no evidence: ${edge}`)
    const stationRelationId = `${options.testOnlyIdPrefix ?? ''}station-relation:${primary.upstreamStationId}:${primary.downstreamStationId}:upstream-of`
    const mappedEvidence = evidence.map(
      (item): MappedRelationEvidence => ({
        id: item.id,
        stationRelationId,
        sourceDocumentId: item.documentId,
        sourcePage: item.sourcePage,
        basis: mapRelationBasis(item.basis),
        sourceExcerpt: item.sourceExcerpt,
        checkedBy: item.checkedBy,
        checkedAt: item.checkedAt,
        verificationStatus: relationVerificationStatus(
          item,
          data.humanReview,
          stationLabels,
        ),
      }),
    )
    relationEvidence.push(...mappedEvidence)
    const verificationStatus =
      mappedEvidence.some(
        (item) =>
          item.verificationStatus ===
          VerificationStatus.OFFICIAL,
      )
        ? VerificationStatus.OFFICIAL
        : mappedEvidence.some(
          (item) =>
            item.verificationStatus ===
            VerificationStatus.CORROBORATED,
        )
          ? VerificationStatus.CORROBORATED
          : VerificationStatus.UNVERIFIED
    relations.push({
      id: stationRelationId,
      fromStationId: primary.upstreamStationId,
      toStationId: primary.downstreamStationId,
      kind: StationRelationKind.UPSTREAM_OF,
      sourceDocumentId: null,
      verificationStatus,
      notes: null,
    })
  }

  return { documents, stations, measurements, relations, relationEvidence }
}

export function knownDocumentIds(): string[] {
  return Object.keys(DOCUMENT_CATALOG).sort()
}

function mapRelationBasis(
  basis: LoadedVerifiedData['relations'][number]['basis'],
): StationRelationEvidenceBasis {
  return basis === 'official_paired_above_below_labels'
    ? StationRelationEvidenceBasis.OFFICIAL_PAIRED_ABOVE_BELOW_LABELS
    : StationRelationEvidenceBasis.OFFICIAL_MONITORING_TABLE_SEQUENCE_AND_STATION_LABELS
}

function assertTestNamespace(
  data: LoadedVerifiedData,
  testOnlyIdPrefix: VerifiedDataMappingOptions['testOnlyIdPrefix'],
): void {
  if (!testOnlyIdPrefix) return
  const ids = [
    ...data.documents.map(({ id }) => id),
    ...data.stations.map(({ id }) => id),
    ...data.measurements.flatMap(({ id, stationId, documentId }) => [
      id,
      stationId,
      documentId,
    ]),
    ...data.relations.flatMap(
      ({ id, upstreamStationId, downstreamStationId, documentId }) => [
        id,
        upstreamStationId,
        downstreamStationId,
        documentId,
      ],
    ),
  ]
  if (ids.some((id) => !id.startsWith(testOnlyIdPrefix))) {
    throw schemaError('Test seed IDs must all use the test-part03- prefix')
  }
}
