import { z } from 'zod'

import type { InvestigationInput } from '@caspian-trace/investigation-core'

const id = z.string().trim().min(1)
const text = z.string().trim().min(1)
const isoDateTime = z.string().datetime({ offset: true })
const nullableDate = isoDateTime.nullable()

const sourceDocumentSchema = z.object({
  id,
  title: text,
  publisher: text,
  url: z.url({ protocol: /^https?$/ }),
  official: z.boolean(),
  verified: z.boolean(),
  publishedAt: nullableDate,
  fetchedAt: nullableDate,
  contentType: z.enum(['html', 'pdf', 'json']),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  cachePath: text.nullable(),
  status: z.enum(['verified', 'unverified', 'unavailable']),
}).strict()

const unknownSchema = z.object({
  code: z.enum([
    'STATION_ORDER_UNVERIFIED',
    'STATION_GRAPH_CYCLE',
    'UPSTREAM_BOUNDARY_UNMEASURED',
    'SYNCHRONOUS_MEASUREMENTS_UNAVAILABLE',
    'CURRENT_FIELD_UNAVAILABLE',
  ]),
  text,
}).strict()

const investigationInputSchema = z.object({
  incident: z.object({
    id,
    title: text,
    region: z.enum(['atyrau', 'mangystau']),
    indicator: text,
    unknowns: z.array(unknownSchema).optional(),
  }).strict(),
  signals: z.array(z.object({
    id,
    title: text,
    observedAt: nullableDate,
    observedPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable(),
    reportedAt: isoDateTime,
    locationText: text,
    phenomenon: z.enum([
      'oil_film',
      'color_change',
      'odor',
      'fish_kill',
      'wastewater',
      'other',
    ]),
    excerpt: text,
    sourceDocumentId: id,
    extractionMode: z.enum(['llm_verified', 'rule', 'verified_seed']),
    verificationStatus: z.enum([
      'unverified',
      'corroborated',
      'official',
      'conflicting',
    ]),
  }).strict()),
  stations: z.array(z.object({
    id,
    name: text,
    waterBody: text,
  }).strict()),
  stationRelations: z.array(z.object({
    id,
    upstreamStationId: id,
    downstreamStationId: id,
    sourceDocumentId: id,
    basis: text,
    verified: z.boolean(),
    comparisonPair: z.boolean(),
    provenance: z.object({
      fixturePath: text,
      sourcePage: z.number().int().positive().nullable(),
      sourceExcerpt: text,
    }).strict(),
  }).strict()),
  measurements: z.array(z.object({
    id,
    stationId: id,
    indicator: text,
    matrix: text,
    value: z.string().trim().regex(/^[+-]?\d+(?:\.\d+)?$/),
    rawValueText: text,
    unit: text,
    sampledAt: nullableDate,
    sampledPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable(),
    sourceDocumentId: id,
    sourcePage: z.number().int().positive().nullable(),
    sourceExcerpt: text.nullable(),
    verified: z.boolean(),
  }).strict().refine(
    ({ sampledAt, sampledPeriod }) => sampledAt !== null || sampledPeriod !== null,
    { message: 'A measurement requires sampledAt or sampledPeriod' },
  )),
  candidateObjects: z.array(z.object({
    id,
    name: text,
    category: text,
    stationId: id.nullable(),
    waterBody: text.nullable(),
    evidenceDocumentIds: z.array(id).min(1),
    completeness: z.enum(['confirmed', 'partial']),
  }).strict()),
  sourceDocuments: z.array(sourceDocumentSchema),
}).strict()

export function parseInvestigationInput(value: unknown): InvestigationInput {
  const input: InvestigationInput = investigationInputSchema.parse(value)
  assertUniqueIds(input)
  assertReferences(input)
  return input
}

function assertUniqueIds(input: InvestigationInput): void {
  for (const collection of [
    input.signals,
    input.stations,
    input.stationRelations,
    input.measurements,
    input.candidateObjects,
    input.sourceDocuments,
  ]) {
    const ids = collection.map(({ id: value }) => value)
    if (new Set(ids).size !== ids.length) throw new Error('DUPLICATE_INVESTIGATION_ID')
  }
}

function assertReferences(input: InvestigationInput): void {
  const stationIds = new Set(input.stations.map(({ id: value }) => value))
  const sourceIds = new Set(input.sourceDocuments.map(({ id: value }) => value))
  for (const signal of input.signals) {
    if (!sourceIds.has(signal.sourceDocumentId)) throw new Error('SIGNAL_SOURCE_NOT_FOUND')
  }
  for (const relation of input.stationRelations) {
    if (
      !stationIds.has(relation.upstreamStationId) ||
      !stationIds.has(relation.downstreamStationId)
    ) {
      throw new Error('RELATION_STATION_NOT_FOUND')
    }
    if (!sourceIds.has(relation.sourceDocumentId)) throw new Error('RELATION_SOURCE_NOT_FOUND')
  }
  for (const measurement of input.measurements) {
    if (!stationIds.has(measurement.stationId)) throw new Error('MEASUREMENT_STATION_NOT_FOUND')
    if (!sourceIds.has(measurement.sourceDocumentId)) throw new Error('MEASUREMENT_SOURCE_NOT_FOUND')
  }
  for (const candidate of input.candidateObjects) {
    if (candidate.stationId !== null && !stationIds.has(candidate.stationId)) {
      throw new Error('CANDIDATE_STATION_NOT_FOUND')
    }
    if (candidate.evidenceDocumentIds.some((sourceId) => !sourceIds.has(sourceId))) {
      throw new Error('CANDIDATE_SOURCE_NOT_FOUND')
    }
  }
}
