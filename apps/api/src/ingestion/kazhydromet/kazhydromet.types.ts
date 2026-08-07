import { z } from 'zod'

import { KAZHYDROMET_REGIONS } from '../ingestion.types'

export const PdfCandidateSchema = z.object({
  url: z.instanceof(URL),
  canonicalUrl: z.url({ protocol: /^https$/ }),
  listingUrl: z.url({ protocol: /^https$/ }),
  anchorText: z.string(),
  contextText: z.string(),
  publishedPeriod: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/).nullable(),
  regions: z.array(z.enum(KAZHYDROMET_REGIONS)).min(1),
  language: z.enum(['ru', 'kk', 'unknown']),
  discoveryMode: z.literal('listing'),
  confidence: z.number().int().nonnegative(),
})

export type PdfCandidate = z.infer<typeof PdfCandidateSchema>

export interface KazhydrometRawSnapshot {
  candidate: PdfCandidate
  bytes: Buffer
  fetchedAt: Date
  httpStatus: number
  finalUrl: string
  sha256: string
  sourceStatus: 'healthy' | 'degraded' | 'rate_limited'
}

export interface PdfPage {
  pageNumber: number
  text: string
  textSha256: string
}

export interface RelevantPage {
  pageNumber: number
  matchedKeywords: string[]
  score: number
}

export interface MeasurementCandidate {
  pageNumber: number
  indicator: 'нефтепродукты'
  stationLabel: string | null
  rawValueText: string
  normalizedValue: string
  unit: 'mg/dm3'
  sourceExcerpt: string
}

export type CandidateRejectReason =
  | 'VALUE_NOT_IN_PAGE'
  | 'INDICATOR_NOT_IN_EXCERPT'
  | 'UNIT_NOT_IN_EXCERPT'
  | 'DECIMAL_INVALID'
  | 'EXCERPT_NOT_IN_PAGE'
  | 'STATION_LABEL_AMBIGUOUS'

export type CandidateValidation =
  | { valid: true }
  | { valid: false; reason: CandidateRejectReason }
