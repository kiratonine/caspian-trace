"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeBootstrapManifestSchema = exports.RuntimeBootstrapCaseSchema = void 0;
const zod_1 = require("zod");
const nonEmptyTextSchema = zod_1.z.string().trim().min(1);
const stableIdSchema = nonEmptyTextSchema.regex(/^[a-z0-9][a-z0-9:_-]*$/);
const semanticCodeSchema = nonEmptyTextSchema.regex(/^[A-Z0-9][A-Z0-9_:-]*$/);
const fixturePathSchema = nonEmptyTextSchema.regex(/^data\/fixtures\/investigation\/[a-zA-Z0-9/_-]+\.json$/);
const unknownSchema = zod_1.z
    .object({
    code: semanticCodeSchema,
    text: nonEmptyTextSchema,
})
    .strict();
const signalProvenanceSchema = zod_1.z
    .object({
    signalId: stableIdSchema,
    sourceDocumentId: stableIdSchema,
    url: zod_1.z.string().url(),
    reportedAt: zod_1.z.string().datetime({
        offset: true,
    }),
    excerpt: nonEmptyTextSchema,
    checkedAt: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    status: nonEmptyTextSchema.optional(),
})
    .strict();
const expectedResultSchema = zod_1.z
    .object({
    evidenceLevel: zod_1.z.enum([
        'L0',
        'L1',
        'L2',
        'L3',
    ]),
    corridorKind: zod_1.z.enum([
        'none',
        'open_upstream',
        'between_stations',
    ]),
    upstreamStationId: stableIdSchema.nullable(),
    downstreamStationId: stableIdSchema.nullable(),
    supportedFactCodes: zod_1.z.array(semanticCodeSchema),
    contradictedHypothesisCodes: zod_1.z.array(semanticCodeSchema),
    objectDispositions: zod_1.z.record(stableIdSchema, nonEmptyTextSchema),
    unknownCodes: zod_1.z.array(semanticCodeSchema),
    conclusion: nonEmptyTextSchema,
    fixtureInputHash: zod_1.z
        .string()
        .regex(/^[a-f0-9]{64}$/),
    rulesetVersion: zod_1.z
        .string()
        .regex(/^\d+\.\d+\.\d+$/),
})
    .strict();
exports.RuntimeBootstrapCaseSchema = zod_1.z
    .object({
    inputPath: fixturePathSchema,
    expectedResultPath: fixturePathSchema,
    incident: zod_1.z
        .object({
        id: stableIdSchema,
        title: nonEmptyTextSchema,
        region: zod_1.z.enum([
            'atyrau',
            'mangystau',
        ]),
        indicator: nonEmptyTextSchema,
    })
        .strict(),
    signalIds: zod_1.z.array(stableIdSchema),
    signalProvenance: zod_1.z.array(signalProvenanceSchema),
    signalAbsenceReason: nonEmptyTextSchema.optional(),
    stationIds: zod_1.z.array(stableIdSchema),
    stationRelationIds: zod_1.z.array(stableIdSchema),
    stationRelationEvidenceIds: zod_1.z.array(stableIdSchema),
    comparisonPairRelationIds: zod_1.z.array(stableIdSchema),
    measurementIds: zod_1.z.array(stableIdSchema),
    candidateObjectIds: zod_1.z.array(stableIdSchema),
    sourceDocumentIds: zod_1.z.array(stableIdSchema),
    unknowns: zod_1.z.array(unknownSchema),
    expectedResult: expectedResultSchema,
})
    .strict();
exports.RuntimeBootstrapManifestSchema = zod_1.z
    .object({
    version: zod_1.z.literal(1),
    purpose: nonEmptyTextSchema,
    cases: zod_1.z
        .array(exports.RuntimeBootstrapCaseSchema)
        .length(3),
})
    .strict();
//# sourceMappingURL=runtime-bootstrap.types.js.map