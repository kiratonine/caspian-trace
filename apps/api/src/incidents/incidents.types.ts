import type { EvidenceLevel, Region } from '@caspian-trace/contracts'

import { Prisma } from '../generated/prisma/client'

export type IncidentFilters = {
  status?: EvidenceLevel
  region?: Region
  generatedFrom?: Date
  generatedBefore?: Date
  limit: number
}

const summaryMeasurementSelect = {
  sampledAt: true,
  sampledPeriod: true,
  indicator: true,
} as const satisfies Prisma.MeasurementSelect

export const incidentSummarySelect = {
  id: true,
  evidenceLevel: true,
  generatedAt: true,
  incident: {
    select: {
      title: true,
      region: true,
      indicator: true,
    },
  },
  measurements: {
    select: {
      measurement: { select: summaryMeasurementSelect },
    },
  },
} as const satisfies Prisma.InvestigationSelect

const sourceDocumentSelect = {
  id: true,
  title: true,
  publisher: true,
  originalUrl: true,
  publishedAt: true,
  fetchedAt: true,
  mediaType: true,
  sha256: true,
  cachePath: true,
  status: true,
} as const satisfies Prisma.SourceDocumentSelect

const stationSelect = {
  id: true,
  name: true,
  waterBody: true,
  latitude: true,
  longitude: true,
  riverOrder: true,
  locationSourceDocumentId: true,
  locationSourceDocument: { select: sourceDocumentSelect },
} as const satisfies Prisma.StationSelect

export const incidentDetailSelect = {
  id: true,
  evidenceLevel: true,
  conclusion: true,
  corridorKind: true,
  upstreamStationId: true,
  downstreamStationId: true,
  generatedAt: true,
  incident: {
    select: {
      title: true,
      region: true,
      indicator: true,
      signals: {
        select: {
          signal: {
            select: {
              id: true,
              title: true,
              observedAt: true,
              observedPeriod: true,
              reportedAt: true,
              latitude: true,
              longitude: true,
              locationText: true,
              phenomenon: true,
              excerpt: true,
              sourceDocumentId: true,
              extractionMode: true,
              verificationStatus: true,
              sourceDocument: { select: sourceDocumentSelect },
            },
          },
        },
      },
    },
  },
  measurements: {
    select: {
      measurement: {
        select: {
          id: true,
          stationId: true,
          sampledAt: true,
          sampledPeriod: true,
          indicator: true,
          value: true,
          rawValueText: true,
          unit: true,
          matrix: true,
          sourceDocumentId: true,
          sourceExcerpt: true,
          verificationStatus: true,
          metadata: true,
          sourcePage: { select: { pageNumber: true } },
          station: { select: stationSelect },
          sourceDocument: { select: sourceDocumentSelect },
        },
      },
    },
  },
  candidateObjects: {
    select: {
      candidateObject: {
        select: {
          id: true,
          name: true,
          objectType: true,
          latitude: true,
          longitude: true,
          geometrySourceDocumentId: true,
          geometrySourceDocument: { select: sourceDocumentSelect },
          verificationStatus: true,
          metadata: true,
          sources: {
            select: {
              sourceDocumentId: true,
              sourceDocument: { select: sourceDocumentSelect },
            },
          },
        },
      },
    },
  },
  evidenceStatements: {
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      code: true,
      sortOrder: true,
      kind: true,
      text: true,
      generatedBy: true,
      measurements: { select: { measurementId: true } },
      sources: {
        select: {
          sourceDocumentId: true,
          sourceDocument: { select: sourceDocumentSelect },
        },
      },
    },
  },
  unknowns: {
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { text: true },
  },
  upstreamStation: { select: stationSelect },
  downstreamStation: { select: stationSelect },
} as const satisfies Prisma.InvestigationSelect

export type IncidentSummaryRow = Prisma.InvestigationGetPayload<{
  select: typeof incidentSummarySelect
}>

export type IncidentDetailRow = Prisma.InvestigationGetPayload<{
  select: typeof incidentDetailSelect
}>
