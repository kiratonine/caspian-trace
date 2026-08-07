import { z } from 'zod'

const nonEmptyTextSchema = z.string().trim().min(1)

const stableIdSchema = nonEmptyTextSchema.regex(
    /^[a-z0-9][a-z0-9:_-]*$/,
)

const semanticCodeSchema = nonEmptyTextSchema.regex(
    /^[A-Z0-9][A-Z0-9_:-]*$/,
)

const fixturePathSchema = nonEmptyTextSchema.regex(
    /^data\/fixtures\/investigation\/[a-zA-Z0-9/_-]+\.json$/,
)

const unknownSchema = z
    .object({
        code: semanticCodeSchema,
        text: nonEmptyTextSchema,
    })
    .strict()

const signalProvenanceSchema = z
    .object({
        signalId: stableIdSchema,
        sourceDocumentId: stableIdSchema,
        url: z.string().url(),
        reportedAt: z.string().datetime({
            offset: true,
        }),
        excerpt: nonEmptyTextSchema,
        checkedAt: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        status: nonEmptyTextSchema.optional(),
    })
    .strict()

const expectedResultSchema = z
    .object({
        evidenceLevel: z.enum([
            'L0',
            'L1',
            'L2',
            'L3',
        ]),
        corridorKind: z.enum([
            'none',
            'open_upstream',
            'between_stations',
        ]),
        upstreamStationId:
            stableIdSchema.nullable(),
        downstreamStationId:
            stableIdSchema.nullable(),
        supportedFactCodes: z.array(
            semanticCodeSchema,
        ),
        contradictedHypothesisCodes: z.array(
            semanticCodeSchema,
        ),
        objectDispositions: z.record(
            stableIdSchema,
            nonEmptyTextSchema,
        ),
        unknownCodes: z.array(
            semanticCodeSchema,
        ),
        conclusion: nonEmptyTextSchema,
        fixtureInputHash: z
            .string()
            .regex(/^[a-f0-9]{64}$/),
        rulesetVersion: z
            .string()
            .regex(/^\d+\.\d+\.\d+$/),
    })
    .strict()

export const RuntimeBootstrapCaseSchema = z
    .object({
        inputPath: fixturePathSchema,
        expectedResultPath: fixturePathSchema,
        incident: z
            .object({
                id: stableIdSchema,
                title: nonEmptyTextSchema,
                region: z.enum([
                    'atyrau',
                    'mangystau',
                ]),
                indicator: nonEmptyTextSchema,
            })
            .strict(),
        signalIds: z.array(stableIdSchema),
        signalProvenance: z.array(
            signalProvenanceSchema,
        ),
        signalAbsenceReason:
            nonEmptyTextSchema.optional(),
        stationIds: z.array(stableIdSchema),
        stationRelationIds: z.array(
            stableIdSchema,
        ),
        stationRelationEvidenceIds: z.array(
            stableIdSchema,
        ),
        comparisonPairRelationIds: z.array(
            stableIdSchema,
        ),
        measurementIds: z.array(
            stableIdSchema,
        ),
        candidateObjectIds: z.array(
            stableIdSchema,
        ),
        sourceDocumentIds: z.array(
            stableIdSchema,
        ),
        unknowns: z.array(unknownSchema),
        expectedResult: expectedResultSchema,
    })
    .strict()

export const RuntimeBootstrapManifestSchema = z
    .object({
        version: z.literal(1),
        purpose: nonEmptyTextSchema,
        cases: z
            .array(RuntimeBootstrapCaseSchema)
            .length(3),
    })
    .strict()

export type RuntimeBootstrapCase = z.infer<
    typeof RuntimeBootstrapCaseSchema
>

export type RuntimeBootstrapManifest = z.infer<
    typeof RuntimeBootstrapManifestSchema
>

export interface LoadedRuntimeBootstrapCase {
    handoff: RuntimeBootstrapCase
    input: unknown
    expectedResult: unknown
}

export interface LoadedRuntimeBootstrap {
    manifest: RuntimeBootstrapManifest
    cases: LoadedRuntimeBootstrapCase[]
}