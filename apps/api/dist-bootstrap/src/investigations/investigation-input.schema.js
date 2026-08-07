"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseInvestigationInput = parseInvestigationInput;
const zod_1 = require("zod");
const id = zod_1.z.string().trim().min(1);
const text = zod_1.z.string().trim().min(1);
const isoDateTime = zod_1.z.string().datetime({ offset: true });
const nullableDate = isoDateTime.nullable();
const sourceDocumentSchema = zod_1.z.object({
    id,
    title: text,
    publisher: text,
    url: zod_1.z.url({ protocol: /^https?$/ }),
    official: zod_1.z.boolean(),
    verified: zod_1.z.boolean(),
    publishedAt: nullableDate,
    fetchedAt: nullableDate,
    contentType: zod_1.z.enum(['html', 'pdf', 'json']),
    sha256: zod_1.z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    cachePath: text.nullable(),
    status: zod_1.z.enum(['verified', 'unverified', 'unavailable']),
}).strict();
const unknownSchema = zod_1.z.object({
    code: zod_1.z.enum([
        'STATION_ORDER_UNVERIFIED',
        'STATION_GRAPH_CYCLE',
        'UPSTREAM_BOUNDARY_UNMEASURED',
        'SYNCHRONOUS_MEASUREMENTS_UNAVAILABLE',
        'CURRENT_FIELD_UNAVAILABLE',
    ]),
    text,
}).strict();
const investigationInputSchema = zod_1.z.object({
    incident: zod_1.z.object({
        id,
        title: text,
        region: zod_1.z.enum(['atyrau', 'mangystau']),
        indicator: text,
        unknowns: zod_1.z.array(unknownSchema).optional(),
    }).strict(),
    signals: zod_1.z.array(zod_1.z.object({
        id,
        title: text,
        observedAt: nullableDate,
        observedPeriod: zod_1.z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable(),
        reportedAt: isoDateTime,
        locationText: text,
        phenomenon: zod_1.z.enum([
            'oil_film',
            'color_change',
            'odor',
            'fish_kill',
            'wastewater',
            'other',
        ]),
        excerpt: text,
        sourceDocumentId: id,
        extractionMode: zod_1.z.enum(['llm_verified', 'rule', 'verified_seed']),
        verificationStatus: zod_1.z.enum([
            'unverified',
            'corroborated',
            'official',
            'conflicting',
        ]),
    }).strict()),
    stations: zod_1.z.array(zod_1.z.object({
        id,
        name: text,
        waterBody: text,
    }).strict()),
    stationRelations: zod_1.z.array(zod_1.z.object({
        id,
        upstreamStationId: id,
        downstreamStationId: id,
        sourceDocumentId: id,
        basis: text,
        verified: zod_1.z.boolean(),
        comparisonPair: zod_1.z.boolean(),
        provenance: zod_1.z.object({
            fixturePath: text,
            sourcePage: zod_1.z.number().int().positive().nullable(),
            sourceExcerpt: text,
        }).strict(),
    }).strict()),
    measurements: zod_1.z.array(zod_1.z.object({
        id,
        stationId: id,
        indicator: text,
        matrix: text,
        value: zod_1.z.string().trim().regex(/^[+-]?\d+(?:\.\d+)?$/),
        rawValueText: text,
        unit: text,
        sampledAt: nullableDate,
        sampledPeriod: zod_1.z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable(),
        sourceDocumentId: id,
        sourcePage: zod_1.z.number().int().positive().nullable(),
        sourceExcerpt: text.nullable(),
        verified: zod_1.z.boolean(),
    }).strict().refine(({ sampledAt, sampledPeriod }) => sampledAt !== null || sampledPeriod !== null, { message: 'A measurement requires sampledAt or sampledPeriod' })),
    candidateObjects: zod_1.z.array(zod_1.z.object({
        id,
        name: text,
        category: text,
        stationId: id.nullable(),
        waterBody: text.nullable(),
        evidenceDocumentIds: zod_1.z.array(id).min(1),
        completeness: zod_1.z.enum(['confirmed', 'partial']),
    }).strict()),
    sourceDocuments: zod_1.z.array(sourceDocumentSchema),
}).strict();
function parseInvestigationInput(value) {
    const input = investigationInputSchema.parse(value);
    assertUniqueIds(input);
    assertReferences(input);
    return input;
}
function assertUniqueIds(input) {
    for (const collection of [
        input.signals,
        input.stations,
        input.stationRelations,
        input.measurements,
        input.candidateObjects,
        input.sourceDocuments,
    ]) {
        const ids = collection.map(({ id: value }) => value);
        if (new Set(ids).size !== ids.length)
            throw new Error('DUPLICATE_INVESTIGATION_ID');
    }
}
function assertReferences(input) {
    const stationIds = new Set(input.stations.map(({ id: value }) => value));
    const sourceIds = new Set(input.sourceDocuments.map(({ id: value }) => value));
    for (const signal of input.signals) {
        if (!sourceIds.has(signal.sourceDocumentId))
            throw new Error('SIGNAL_SOURCE_NOT_FOUND');
    }
    for (const relation of input.stationRelations) {
        if (!stationIds.has(relation.upstreamStationId) ||
            !stationIds.has(relation.downstreamStationId)) {
            throw new Error('RELATION_STATION_NOT_FOUND');
        }
        if (!sourceIds.has(relation.sourceDocumentId))
            throw new Error('RELATION_SOURCE_NOT_FOUND');
    }
    for (const measurement of input.measurements) {
        if (!stationIds.has(measurement.stationId))
            throw new Error('MEASUREMENT_STATION_NOT_FOUND');
        if (!sourceIds.has(measurement.sourceDocumentId))
            throw new Error('MEASUREMENT_SOURCE_NOT_FOUND');
    }
    for (const candidate of input.candidateObjects) {
        if (candidate.stationId !== null && !stationIds.has(candidate.stationId)) {
            throw new Error('CANDIDATE_STATION_NOT_FOUND');
        }
        if (candidate.evidenceDocumentIds.some((sourceId) => !sourceIds.has(sourceId))) {
            throw new Error('CANDIDATE_SOURCE_NOT_FOUND');
        }
    }
}
//# sourceMappingURL=investigation-input.schema.js.map