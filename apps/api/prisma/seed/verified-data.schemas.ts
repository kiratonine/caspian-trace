import { z } from 'zod'

const idSchema = z
  .string()
  .min(1)
  .max(160)
  .refine((value) => value === value.trim(), {
    message: 'Identifier surrounding whitespace is not allowed',
  })
const nonEmptyTextSchema = z.string().trim().min(1)
const preservedNonEmptyTextSchema = z
  .string()
  .min(1)
  .refine((value) => value === value.trim(), {
    message: 'Surrounding whitespace is not allowed',
  })
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const sourcePageSchema = z.number().int().positive().nullable()
const yearMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const calendarDateSchema = z.iso.date()
const httpsUrlSchema = z.url({ protocol: /^https$/ })
const reviewerSchema = z
  .string()
  .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/)
  .refine((value) => !value.includes('--'), {
    message: 'Reviewer must be a GitHub-like username',
  })

const checkedBySchema = z
  .array(reviewerSchema)
  .min(1)
  .superRefine((reviewers, context) => {
    if (new Set(reviewers.map((reviewer) => reviewer.toLowerCase())).size !== reviewers.length) {
      context.addIssue({ code: 'custom', message: 'Reviewers must be unique' })
    }
  })

const baseDocumentSchema = z
  .object({
    id: idSchema,
    url: httpsUrlSchema,
    sha256: sha256Schema,
    sourcePage: sourcePageSchema,
    verificationStatus: z.literal(
      'automated_source_checked_human_review_pending',
    ),
  })
  .strict()

export const measurementDocumentSchema = baseDocumentSchema.extend({
  period: yearMonthSchema,
})

export const relationDocumentSchema = baseDocumentSchema

export const verifiedMeasurementSchema = z
  .object({
    id: idSchema,
    stationId: idSchema,
    stationLabel: preservedNonEmptyTextSchema,
    indicator: nonEmptyTextSchema,
    rawValueText: preservedNonEmptyTextSchema,
    normalizedValue: z
      .string()
      .regex(/^(0|[1-9]\d{0,11})(?:\.\d{0,5}[1-9])?$/),
    unit: z.literal('mg/dm3'),
    sampledAt: calendarDateSchema.nullable(),
    sampledPeriod: yearMonthSchema.nullable(),
    sourceUrl: httpsUrlSchema,
    sourceSha256: sha256Schema,
    sourcePage: sourcePageSchema,
    sourceExcerpt: preservedNonEmptyTextSchema,
    checkedBy: checkedBySchema,
    checkedAt: calendarDateSchema,
  })
  .strict()
  .superRefine(({ normalizedValue, rawValueText, sampledAt, sampledPeriod }, context) => {
    if ((sampledAt === null) === (sampledPeriod === null)) {
      context.addIssue({
        code: 'custom',
        message: 'Exactly one of sampledAt and sampledPeriod is required',
      })
    }
    if (canonicalDecimalFromRaw(rawValueText) !== normalizedValue) {
      context.addIssue({
        code: 'custom',
        message: 'rawValueText and normalizedValue must represent the same Decimal',
        path: ['normalizedValue'],
      })
    }
  })

export const relationBasisSchema = z.enum([
  'official_paired_above_below_labels',
  'official_monitoring_table_sequence_and_station_labels',
])

export const verifiedStationRelationSchema = z
  .object({
    id: idSchema,
    upstreamStationId: idSchema,
    downstreamStationId: idSchema,
    basis: relationBasisSchema,
    sourceSha256: sha256Schema,
    sourcePage: sourcePageSchema,
    sourceExcerpt: preservedNonEmptyTextSchema,
    checkedBy: checkedBySchema,
    checkedAt: calendarDateSchema,
  })
  .strict()
  .refine(
    ({ upstreamStationId, downstreamStationId }) =>
      upstreamStationId !== downstreamStationId,
    { message: 'A station relation cannot reference itself' },
  )

export const measurementFixtureSchema = z
  .object({
    document: measurementDocumentSchema,
    measurements: z.array(verifiedMeasurementSchema).min(1),
  })
  .strict()

export const stationRelationFixtureSchema = z
  .object({
    document: relationDocumentSchema,
    relations: z.array(verifiedStationRelationSchema).min(1),
  })
  .strict()

export const verifiedManifestSchema = z
  .object({
    version: z.literal(1),
    generatedAt: calendarDateSchema,
    reviewPolicy: z
      .object({
        requiredHumanReviewers: z.literal(2),
        completedHumanReviewers: z.number().int().nonnegative(),
        status: z.enum(['pending', 'complete']),
      })
      .strict(),
    fixtures: z
      .array(
        z
          .object({
            kind: z.enum(['measurements', 'station_relations']),
            path: z.string().min(1),
            documentSha256: sha256Schema,
            sourcePage: sourcePageSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine(({ fixtures }, context) => {
    const paths = new Set<string>()
    const kindPaths = new Set<string>()
    for (const [index, fixture] of fixtures.entries()) {
      const kindPath = `${fixture.kind}:${fixture.path}`
      if (paths.has(fixture.path) || kindPaths.has(kindPath)) {
        context.addIssue({
          code: 'custom',
          message: 'Fixture paths must be unique',
          path: ['fixtures', index, 'path'],
        })
      }
      paths.add(fixture.path)
      kindPaths.add(kindPath)
    }
  })

export type VerifiedManifest = z.infer<typeof verifiedManifestSchema>
export type ManifestFixture = VerifiedManifest['fixtures'][number]
export type MeasurementFixture = z.infer<typeof measurementFixtureSchema>
export type StationRelationFixture = z.infer<
  typeof stationRelationFixtureSchema
>
export type VerifiedMeasurement = z.infer<typeof verifiedMeasurementSchema>
export type VerifiedStationRelation = z.infer<
  typeof verifiedStationRelationSchema
>
export type RelationBasis = z.infer<typeof relationBasisSchema>

export function canonicalDecimalFromRaw(value: string): string | null {
  if (!/^(0|[1-9]\d{0,11})(?:[,.]\d{1,6})?$/.test(value)) return null
  const normalizedSeparator = value.replace(',', '.')
  const [whole, fraction] = normalizedSeparator.split('.')
  if (fraction === undefined) return whole ?? null
  const canonicalFraction = fraction.replace(/0+$/, '')
  return canonicalFraction.length === 0
    ? (whole ?? null)
    : `${whole}.${canonicalFraction}`
}
