import { z } from 'zod'

const nonEmptyId = z.string().trim().min(1).max(160)
const evidenceStatementId = z.string().trim().min(1).max(256)
const nonEmptyText = z.string().trim().min(1)

export const IsoDateTimeSchema = z.string().datetime({ offset: true })
export const IsoDateSchema = z.iso.date()
export const YearMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected an ISO year-month (YYYY-MM)')

export const EvidenceLevelSchema = z.enum(['L0', 'L1', 'L2', 'L3'])
export const RegionSchema = z.enum(['atyrau', 'mangystau'])
export const PhenomenonSchema = z.enum([
  'oil_film',
  'color_change',
  'odor',
  'fish_kill',
  'wastewater',
  'other',
])
export const VerificationStatusSchema = z.enum([
  'unverified',
  'corroborated',
  'official',
  'conflicting',
])
export const ExtractionModeSchema = z.enum([
  'llm_verified',
  'rule',
  'verified_seed',
])

export const LocationSchema = z
  .object({
    lat: z.number().finite().min(-90).max(90),
    lon: z.number().finite().min(-180).max(180),
  })
  .strict()
  .refine(({ lat, lon }) => lat !== 0 || lon !== 0, {
    message: 'The [0, 0] unknown-location sentinel is not allowed',
  })

export const SourceDocumentSchema = z
  .object({
    id: nonEmptyId,
    title: nonEmptyText,
    publisher: nonEmptyText,
    url: z.url({ protocol: /^https?$/ }),
    publishedAt: IsoDateTimeSchema.nullable(),
    fetchedAt: IsoDateTimeSchema.nullable(),
    contentType: z.enum(['html', 'pdf', 'json']),
    sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    cachePath: z.string().trim().min(1).nullable(),
    status: z.enum(['verified', 'unverified', 'unavailable']),
  })
  .strict()
  .refine(
    ({ fetchedAt, sha256, status }) =>
      status !== 'verified' || (fetchedAt !== null && sha256 !== null),
    {
      message: 'A verified source document requires fetchedAt and sha256',
      path: ['status'],
    },
  )

export const StationSchema = z
  .object({
    id: nonEmptyId,
    name: nonEmptyText,
    waterBody: nonEmptyText,
    location: LocationSchema.nullable(),
    riverOrder: z.number().int().nonnegative().nullable(),
    relationType: z.enum(['upstream', 'downstream', 'neutral']),
    relatedObjectId: nonEmptyId.nullable(),
    locationSourceDocumentId: nonEmptyId.nullable(),
  })
  .strict()
  .refine(
    ({ location, locationSourceDocumentId }) =>
      location === null
        ? locationSourceDocumentId === null
        : locationSourceDocumentId !== null,
    {
      message:
        'locationSourceDocumentId must be present exactly when location is present',
      path: ['locationSourceDocumentId'],
    },
  )

export const MeasurementSchema = z
  .object({
    id: nonEmptyId,
    stationId: nonEmptyId,
    sampledAt: IsoDateTimeSchema.nullable(),
    sampledPeriod: YearMonthSchema.nullable(),
    indicator: nonEmptyText,
    value: z.number().finite(),
    rawValueText: nonEmptyText,
    unit: z.enum(['mg/dm3', 'mg/kg', 'percent']),
    matrix: z.enum(['water', 'sediment']),
    qualityClass: z.number().int().positive().nullable(),
    sourceDocumentId: nonEmptyId,
    sourcePage: z.number().int().positive().nullable(),
    sourceExcerpt: nonEmptyText.nullable(),
    verified: z.boolean(),
  })
  .strict()
  .refine(
    ({ sampledAt, sampledPeriod }) => sampledAt !== null || sampledPeriod !== null,
    { message: 'Either sampledAt or sampledPeriod must be provided' },
  )
  .refine(({ sourceExcerpt, verified }) => !verified || sourceExcerpt !== null, {
    message: 'A verified measurement requires a sourceExcerpt',
    path: ['verified'],
  })

export const IncidentSignalSchema = z
  .object({
    id: nonEmptyId,
    title: nonEmptyText,
    observedAt: IsoDateTimeSchema.nullable(),
    observedPeriod: YearMonthSchema.nullable(),
    reportedAt: IsoDateTimeSchema,
    location: LocationSchema.nullable(),
    locationText: nonEmptyText,
    phenomenon: PhenomenonSchema,
    excerpt: nonEmptyText,
    sourceDocumentId: nonEmptyId,
    extractionMode: ExtractionModeSchema,
    verificationStatus: VerificationStatusSchema,
  })
  .strict()

export const CandidateObjectSchema = z
  .object({
    id: nonEmptyId,
    name: nonEmptyText,
    category: nonEmptyText,
    location: LocationSchema.nullable(),
    waterBody: nonEmptyText.nullable(),
    riverOrder: z.number().int().nonnegative().nullable(),
    evidenceDocumentIds: z.array(nonEmptyId).min(1),
    completeness: z.enum(['confirmed', 'partial']),
  })
  .strict()

export const EvidenceStatementSchema = z
  .object({
    id: evidenceStatementId,
    code: z.string().trim().regex(/^[A-Z][A-Z0-9_]*$/),
    sortOrder: z.number().int().nonnegative(),
    kind: z.enum(['supports', 'contradicts', 'limits', 'unknown']),
    text: nonEmptyText,
    measurementIds: z.array(nonEmptyId),
    sourceDocumentIds: z.array(nonEmptyId),
    generatedBy: z.enum(['rule_engine', 'human_verified']),
  })
  .strict()
  .superRefine(({ kind, sourceDocumentIds }, context) => {
    if (kind !== 'unknown' && sourceDocumentIds.length === 0) {
      context.addIssue({
        code: 'custom',
        message: `${kind} statements require source provenance`,
        path: ['sourceDocumentIds'],
      })
    }
  })

export const InvestigationUnknownSchema = z
  .object({
    code: z.string().trim().regex(/^[A-Z][A-Z0-9_]*$/),
    text: nonEmptyText,
  })
  .strict()

export const CorridorBoundsSchema = z
  .object({
    upstreamStationId: nonEmptyId.nullable(),
    downstreamStationId: nonEmptyId,
  })
  .strict()

const GeoJsonLineStringSchema = z
  .object({
    type: z.literal('LineString'),
    coordinates: z.array(z.tuple([z.number().finite(), z.number().finite()])).min(2),
  })
  .strict()

const GeoJsonPolygonSchema = z
  .object({
    type: z.literal('Polygon'),
    coordinates: z
      .array(z.array(z.tuple([z.number().finite(), z.number().finite()])).min(4))
      .min(1),
  })
  .strict()

export const GeoJsonFeatureSchema = z
  .object({
    type: z.literal('Feature'),
    geometry: z.discriminatedUnion('type', [
      GeoJsonLineStringSchema,
      GeoJsonPolygonSchema,
    ]),
    properties: z.record(z.string(), z.unknown()).nullable(),
  })
  .strict()

export const InvestigationSchema = z
  .object({
    id: nonEmptyId,
    title: nonEmptyText,
    signalIds: z.array(nonEmptyId),
    indicator: nonEmptyText,
    evidenceLevel: EvidenceLevelSchema,
    corridor: GeoJsonFeatureSchema.nullable(),
    supportedFacts: z.array(EvidenceStatementSchema),
    contradictedHypotheses: z.array(EvidenceStatementSchema),
    unknowns: z.array(nonEmptyText),
    conclusion: nonEmptyText,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()

export const IncidentSummarySchema = z
  .object({
    id: nonEmptyId,
    title: nonEmptyText,
    region: RegionSchema,
    evidenceLevel: EvidenceLevelSchema,
    indicator: nonEmptyText,
    updatedAt: IsoDateTimeSchema,
    period: YearMonthSchema.nullable(),
  })
  .strict()

export const IncidentSummaryListSchema = z.array(IncidentSummarySchema)

export const IncidentDetailSchema = z
  .object({
    investigation: InvestigationSchema,
    region: RegionSchema,
    signals: z.array(IncidentSignalSchema),
    measurements: z.array(MeasurementSchema),
    stations: z.array(StationSchema),
    candidateObjects: z.array(CandidateObjectSchema),
    sourceDocuments: z.array(SourceDocumentSchema),
    corridorBounds: CorridorBoundsSchema.nullable(),
  })
  .strict()

export const EvidenceGraphSchema = z
  .object({
    investigationId: nonEmptyId,
    statements: z.array(EvidenceStatementSchema),
    measurements: z.array(MeasurementSchema),
    sourceDocuments: z.array(SourceDocumentSchema),
  })
  .strict()

const SignalReplayStepSchema = z
  .object({
    id: nonEmptyId,
    offsetMs: z.number().int().nonnegative(),
    type: z.literal('signal'),
    payload: z
      .object({
        signal: IncidentSignalSchema,
        evidenceLevel: EvidenceLevelSchema,
      })
      .strict(),
  })
  .strict()

const CorroborationReplayStepSchema = z
  .object({
    id: nonEmptyId,
    offsetMs: z.number().int().nonnegative(),
    type: z.literal('corroboration'),
    payload: z
      .object({
        text: nonEmptyText,
        sourceDocumentId: nonEmptyId,
        evidenceLevel: EvidenceLevelSchema,
      })
      .strict(),
  })
  .strict()

const MeasurementReplayStepSchema = z
  .object({
    id: nonEmptyId,
    offsetMs: z.number().int().nonnegative(),
    type: z.literal('measurement'),
    payload: z
      .object({
        measurements: z.array(MeasurementSchema),
        evidenceLevel: EvidenceLevelSchema,
      })
      .strict(),
  })
  .strict()

const InferenceReplayStepSchema = z
  .object({
    id: nonEmptyId,
    offsetMs: z.number().int().nonnegative(),
    type: z.literal('inference'),
    payload: z
      .object({ text: nonEmptyText, evidenceLevel: EvidenceLevelSchema })
      .strict(),
  })
  .strict()

const ConclusionReplayStepSchema = z
  .object({
    id: nonEmptyId,
    offsetMs: z.number().int().nonnegative(),
    type: z.literal('conclusion'),
    payload: z
      .object({ text: nonEmptyText, evidenceLevel: EvidenceLevelSchema })
      .strict(),
  })
  .strict()

export const ReplayStepSchema = z.discriminatedUnion('type', [
  SignalReplayStepSchema,
  CorroborationReplayStepSchema,
  MeasurementReplayStepSchema,
  InferenceReplayStepSchema,
  ConclusionReplayStepSchema,
])

export const ReplayScenarioSchema = z
  .object({
    id: nonEmptyId,
    incidentId: nonEmptyId,
    steps: z.array(ReplayStepSchema),
  })
  .strict()
  .refine(
    ({ steps }) => steps.every((step, index) => index === 0 || step.offsetMs >= steps[index - 1]!.offsetMs),
    { message: 'Replay steps must be ordered by offsetMs' },
  )

export const SourceHealthStatusSchema = z.enum([
  'never_run',
  'healthy',
  'degraded',
  'rate_limited',
  'failed',
])

export const SourceHealthItemSchema = z
  .object({
    id: nonEmptyId,
    name: nonEmptyText,
    lastSuccessAt: IsoDateTimeSchema.nullable(),
    cacheAvailable: z.boolean(),
    status: SourceHealthStatusSchema,
  })
  .strict()

export const LiveStatusSchema = z
  .object({ sources: z.array(SourceHealthItemSchema) })
  .strict()

export const DossierSchema = z
  .object({
    title: nonEmptyText,
    generatedAt: IsoDateTimeSchema.nullable(),
    disclaimer: nonEmptyText,
    conclusion: nonEmptyText,
    evidenceLevel: EvidenceLevelSchema,
    signals: z.array(IncidentSignalSchema),
    measurements: z.array(MeasurementSchema),
    supportedFacts: z.array(EvidenceStatementSchema),
    contradictedHypotheses: z.array(EvidenceStatementSchema),
    unknowns: z.array(InvestigationUnknownSchema),
    candidateObjects: z.array(CandidateObjectSchema),
    sources: z.array(SourceDocumentSchema),
    inputHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    rulesetVersion: z.string().trim().min(1).nullable(),
  })
  .strict()

export const ApiErrorSchema = z
  .object({
    code: z.string().trim().regex(/^[A-Z][A-Z0-9_]*$/),
    message: nonEmptyText,
    requestId: z.string().trim().min(1).max(128),
  })
  .strict()

export const HealthLiveSchema = z
  .object({
    status: z.literal('ok'),
    service: z.literal('caspian-trace-api'),
  })
  .strict()

export const HealthReadySchema = z
  .object({
    status: z.literal('ok'),
    service: z.literal('caspian-trace-api'),
    database: z.literal('ready'),
  })
  .strict()

export const PrismaRegionSchema = z.enum(['ATYRAU', 'MANGYSTAU'])

export function mapRegionToApi(value: z.input<typeof PrismaRegionSchema>): Region {
  const region = PrismaRegionSchema.parse(value)
  return region === 'ATYRAU' ? 'atyrau' : 'mangystau'
}

export type EvidenceLevel = z.infer<typeof EvidenceLevelSchema>
export type Region = z.infer<typeof RegionSchema>
export type Phenomenon = z.infer<typeof PhenomenonSchema>
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>
export type ExtractionMode = z.infer<typeof ExtractionModeSchema>
export type SourceDocument = z.infer<typeof SourceDocumentSchema>
export type Station = z.infer<typeof StationSchema>
export type Measurement = z.infer<typeof MeasurementSchema>
export type IncidentSignal = z.infer<typeof IncidentSignalSchema>
export type CandidateObject = z.infer<typeof CandidateObjectSchema>
export type EvidenceStatement = z.infer<typeof EvidenceStatementSchema>
export type InvestigationUnknown = z.infer<typeof InvestigationUnknownSchema>
export type CorridorBounds = z.infer<typeof CorridorBoundsSchema>
export type Investigation = z.infer<typeof InvestigationSchema>
export type IncidentSummary = z.infer<typeof IncidentSummarySchema>
export type IncidentDetail = z.infer<typeof IncidentDetailSchema>
export type EvidenceGraph = z.infer<typeof EvidenceGraphSchema>
export type ReplayStep = z.infer<typeof ReplayStepSchema>
export type ReplayScenario = z.infer<typeof ReplayScenarioSchema>
export type SourceHealthItem = z.infer<typeof SourceHealthItemSchema>
export type LiveStatus = z.infer<typeof LiveStatusSchema>
export type Dossier = z.infer<typeof DossierSchema>
export type ApiError = z.infer<typeof ApiErrorSchema>
export type HealthLive = z.infer<typeof HealthLiveSchema>
export type HealthReady = z.infer<typeof HealthReadySchema>
