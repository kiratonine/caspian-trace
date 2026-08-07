import { Prisma } from '../../src/generated/prisma/client'
import {
  CorridorKind,
  EvidenceGeneratedBy,
  EvidenceKind,
  EvidenceLevel,
  ExtractionMode,
  Region,
  SourceDocumentStatus,
  VerificationStatus,
} from '../../src/generated/prisma/enums'
import type {
  IncidentDetailRow,
  IncidentSummaryRow,
} from '../../src/incidents/incidents.types'

const sourceDocument = {
  id: 'test-part04-source-september',
  title: 'Test September bulletin',
  publisher: 'Test publisher',
  originalUrl: 'https://example.com/test-part04-september.pdf',
  publishedAt: null,
  fetchedAt: new Date('2026-01-01T00:00:00.000Z'),
  mediaType: 'application/pdf',
  sha256: 'a'.repeat(64),
  cachePath: null,
  status: SourceDocumentStatus.VERIFIED,
}

const station = {
  id: 'test-part04-station-september',
  name: 'Test September station',
  waterBody: 'Жайык',
  latitude: null,
  longitude: null,
  riverOrder: 1,
  locationSourceDocumentId: null,
  locationSourceDocument: null,
}

export function makeSummaryRow(): IncidentSummaryRow {
  return {
    id: 'test-part04-investigation-september',
    evidenceLevel: EvidenceLevel.L2,
    generatedAt: new Date('2026-02-03T04:05:06.000Z'),
    incident: {
      title: 'Test September incident',
      region: Region.ATYRAU,
      indicator: null,
    },
    measurements: [
      {
        measurement: {
          sampledAt: null,
          sampledPeriod: '2025-09',
          indicator: 'нефтепродукты',
        },
      },
    ],
  }
}

export function makeDetailRow(): IncidentDetailRow {
  return {
    id: 'test-part04-investigation-september',
    evidenceLevel: EvidenceLevel.L2,
    conclusion: 'Test-only stored conclusion without causal attribution.',
    corridorKind: CorridorKind.OPEN_UPSTREAM,
    upstreamStationId: null,
    downstreamStationId: station.id,
    generatedAt: new Date('2026-02-03T04:05:06.000Z'),
    incident: {
      title: 'Test September incident',
      region: Region.ATYRAU,
      indicator: 'нефтепродукты',
      signals: [
        {
          signal: {
            id: 'test-part04-signal-september',
            title: 'Test signal',
            observedAt: null,
            observedPeriod: '2025-09',
            reportedAt: new Date('2025-09-10T00:00:00.000Z'),
            latitude: null,
            longitude: null,
            locationText: 'Test location',
            phenomenon: 'color_change',
            excerpt: 'Test-only public signal excerpt',
            sourceDocumentId: sourceDocument.id,
            extractionMode: ExtractionMode.VERIFIED_SEED,
            verificationStatus: VerificationStatus.CORROBORATED,
            sourceDocument,
          },
        },
      ],
    },
    measurements: [
      {
        measurement: {
          id: 'test-part04-measurement-september',
          stationId: station.id,
          sampledAt: null,
          sampledPeriod: '2025-09',
          indicator: 'нефтепродукты',
          value: new Prisma.Decimal('0.234'),
          rawValueText: '0,234',
          unit: 'mg/dm3',
          matrix: 'water',
          sourceDocumentId: sourceDocument.id,
          sourceExcerpt: 'Test-only measurement excerpt 0,234',
          verificationStatus: VerificationStatus.OFFICIAL,
          metadata: { sourcePage: 22 },
          sourcePage: { pageNumber: 22 },
          station,
          sourceDocument,
        },
      },
    ],
    candidateObjects: [
      {
        candidateObject: {
          id: 'test-part04-candidate',
          name: 'Test object for checking',
          objectType: 'test outlet',
          latitude: null,
          longitude: null,
          geometrySourceDocumentId: null,
          geometrySourceDocument: null,
          verificationStatus: VerificationStatus.OFFICIAL,
          metadata: { waterBody: 'Жайык', riverOrder: 2 },
          sources: [
            {
              sourceDocumentId: sourceDocument.id,
              sourceDocument,
            },
          ],
        },
      },
    ],
    evidenceStatements: [
      {
        id: 'test-part04-statement-supports',
        code: 'TEST_PART04_SUPPORTS',
        sortOrder: 0,
        kind: EvidenceKind.SUPPORTS,
        text: 'Test-only stored supported fact.',
        generatedBy: EvidenceGeneratedBy.RULE_ENGINE,
        measurements: [
          { measurementId: 'test-part04-measurement-september' },
        ],
        sources: [
          {
            sourceDocumentId: sourceDocument.id,
            sourceDocument,
          },
        ],
      },
      {
        id: 'test-part04-statement-contradicts',
        code: 'TEST_PART04_CONTRADICTS',
        sortOrder: 1,
        kind: EvidenceKind.CONTRADICTS,
        text: 'Test-only stored contradicted hypothesis.',
        generatedBy: EvidenceGeneratedBy.HUMAN_VERIFIED,
        measurements: [],
        sources: [
          {
            sourceDocumentId: sourceDocument.id,
            sourceDocument,
          },
        ],
      },
      {
        id: 'test-part04-statement-limits',
        code: 'TEST_PART04_LIMITS',
        sortOrder: 2,
        kind: EvidenceKind.LIMITS,
        text: 'Test-only stored limitation.',
        generatedBy: EvidenceGeneratedBy.HUMAN_VERIFIED,
        measurements: [],
        sources: [
          {
            sourceDocumentId: sourceDocument.id,
            sourceDocument,
          },
        ],
      },
      {
        id: 'test-part04-statement-unknown',
        code: 'TEST_PART04_UNKNOWN',
        sortOrder: 3,
        kind: EvidenceKind.UNKNOWN,
        text: 'Test-only stored unknown statement.',
        generatedBy: EvidenceGeneratedBy.HUMAN_VERIFIED,
        measurements: [],
        sources: [],
      },
    ],
    unknowns: [{ text: 'Test-only stored investigation unknown.' }],
    upstreamStation: null,
    downstreamStation: station,
  }
}
