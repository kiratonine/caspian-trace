"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRuntimeBootstrapPrerequisites = verifyRuntimeBootstrapPrerequisites;
const enums_1 = require("../../src/generated/prisma/enums");
const runtime_bootstrap_errors_1 = require("./runtime-bootstrap.errors");
async function verifyRuntimeBootstrapPrerequisites(transaction, plan) {
    const sourceDocuments = await transaction.sourceDocument.findMany({
        where: {
            id: {
                in: plan.requiredVerifiedData
                    .sourceDocumentIds,
            },
        },
        select: {
            id: true,
            originalUrl: true,
            canonicalUrl: true,
            publisher: true,
            mediaType: true,
            sha256: true,
        },
        orderBy: {
            id: 'asc',
        },
    });
    assertExactIds('source document', sourceDocuments, plan.requiredVerifiedData
        .sourceDocumentIds);
    verifySourceDocuments(sourceDocuments, plan);
    const stations = await transaction.station.findMany({
        where: {
            id: {
                in: plan.requiredVerifiedData
                    .stationIds,
            },
        },
        select: {
            id: true,
        },
        orderBy: {
            id: 'asc',
        },
    });
    assertExactIds('station', stations, plan.requiredVerifiedData.stationIds);
    const stationRelations = await transaction.stationRelation.findMany({
        where: {
            id: {
                in: plan.requiredVerifiedData
                    .stationRelationIds,
            },
        },
        select: {
            id: true,
            kind: true,
            verificationStatus: true,
        },
        orderBy: {
            id: 'asc',
        },
    });
    assertExactIds('station relation', stationRelations, plan.requiredVerifiedData
        .stationRelationIds);
    verifyStationRelations(stationRelations, plan.relations);
    const relationEvidence = await transaction
        .stationRelationEvidence
        .findMany({
        where: {
            id: {
                in: plan.requiredVerifiedData
                    .stationRelationEvidenceIds,
            },
        },
        select: {
            id: true,
            stationRelationId: true,
            sourceDocumentId: true,
            sourcePage: true,
            verificationStatus: true,
        },
        orderBy: {
            id: 'asc',
        },
    });
    assertExactIds('station relation evidence', relationEvidence, plan.requiredVerifiedData
        .stationRelationEvidenceIds);
    verifyRelationEvidence(relationEvidence, plan.relations);
    const measurements = await transaction.measurement.findMany({
        where: {
            id: {
                in: plan.requiredVerifiedData
                    .measurementIds,
            },
        },
        select: {
            id: true,
            verificationStatus: true,
        },
        orderBy: {
            id: 'asc',
        },
    });
    assertExactIds('measurement', measurements, plan.requiredVerifiedData
        .measurementIds);
    verifyMeasurements(measurements);
    return {
        sourceDocuments: sourceDocuments.length,
        stations: stations.length,
        stationRelations: stationRelations.length,
        stationRelationEvidence: relationEvidence.length,
        measurements: measurements.length,
    };
}
function verifySourceDocuments(rows, plan) {
    const expectedById = new Map(plan.sourceDocuments
        .filter(({ id }) => plan.requiredVerifiedData
        .sourceDocumentIds.includes(id))
        .map((source) => [
        source.id,
        source,
    ]));
    for (const row of rows) {
        const expected = expectedById.get(row.id);
        if (expected === undefined) {
            throw conflict(`Missing source plan for verified document ${row.id}`);
        }
        assertEqual(row.originalUrl, expected.url, `source document ${row.id} original URL`);
        assertEqual(row.canonicalUrl, expected.url, `source document ${row.id} canonical URL`);
        assertEqual(row.publisher, expected.publisher, `source document ${row.id} publisher`);
        assertEqual(row.sha256, expected.sha256, `source document ${row.id} SHA-256`);
        assertEqual(normalizeContentType(row.mediaType), expected.contentType, `source document ${row.id} content type`);
        if (!expected.official ||
            !expected.verified) {
            throw conflict(`Verified source document ${row.id} is not marked official and verified in the handoff`);
        }
    }
}
function verifyStationRelations(rows, relationPlans) {
    const expectedById = new Map(relationPlans.map((relation) => [
        relation.id,
        relation,
    ]));
    for (const row of rows) {
        const expected = expectedById.get(row.id);
        if (expected === undefined) {
            throw conflict(`Missing relation plan for ${row.id}`);
        }
        assertEqual(row.kind, enums_1.StationRelationKind.UPSTREAM_OF, `station relation ${row.id} kind`);
        assertEqual(row.verificationStatus, expectedRelationVerificationStatus(expected), `station relation ${row.id} verification status`);
    }
}
function expectedRelationVerificationStatus(relation) {
    return relation.comparisonPair
        ? enums_1.VerificationStatus.OFFICIAL
        : enums_1.VerificationStatus.CORROBORATED;
}
function verifyRelationEvidence(rows, relationPlans) {
    const relationByEvidenceId = buildRelationByEvidenceId(relationPlans);
    const foundSourcesByRelation = new Map();
    for (const row of rows) {
        const expectedRelation = relationByEvidenceId.get(row.id);
        if (expectedRelation === undefined) {
            throw conflict(`Missing relation plan for evidence ${row.id}`);
        }
        assertEqual(row.stationRelationId, expectedRelation.id, `relation evidence ${row.id} edge`);
        if (!expectedRelation
            .sourceDocumentIds
            .includes(row.sourceDocumentId)) {
            throw conflict(`Relation evidence ${row.id} references an unexpected source document`);
        }
        if (row.sourcePage === null ||
            row.sourcePage <= 0) {
            throw conflict(`Relation evidence ${row.id} has no verified source page`);
        }
        assertEqual(row.verificationStatus, expectedRelationVerificationStatus(expectedRelation), `relation evidence ${row.id} verification status`);
        const sourceIds = foundSourcesByRelation.get(expectedRelation.id) ?? new Set();
        sourceIds.add(row.sourceDocumentId);
        foundSourcesByRelation.set(expectedRelation.id, sourceIds);
    }
    for (const relation of relationPlans) {
        const actualSourceIds = [
            ...(foundSourcesByRelation.get(relation.id) ?? new Set()),
        ].sort(compareText);
        const expectedSourceIds = [
            ...relation.sourceDocumentIds,
        ].sort(compareText);
        if (!stringArraysEqual(actualSourceIds, expectedSourceIds)) {
            throw conflict(`Station relation ${relation.id} has conflicting evidence sources`);
        }
    }
}
function verifyMeasurements(rows) {
    for (const row of rows) {
        assertEqual(row.verificationStatus, enums_1.VerificationStatus.OFFICIAL, `measurement ${row.id} verification status`);
    }
}
function buildRelationByEvidenceId(relationPlans) {
    const result = new Map();
    for (const relation of relationPlans) {
        for (const evidenceId of relation.evidenceIds) {
            if (result.has(evidenceId)) {
                throw conflict(`Relation evidence ${evidenceId} belongs to multiple relation plans`);
            }
            result.set(evidenceId, relation);
        }
    }
    return result;
}
function assertExactIds(entity, rows, expectedIds) {
    const actualIds = rows
        .map(({ id }) => id)
        .sort(compareText);
    const normalizedExpected = [
        ...new Set(expectedIds),
    ].sort(compareText);
    if (stringArraysEqual(actualIds, normalizedExpected)) {
        return;
    }
    const actual = new Set(actualIds);
    const missing = normalizedExpected
        .filter((id) => !actual.has(id));
    throw new runtime_bootstrap_errors_1.RuntimeBootstrapError('RUNTIME_BOOTSTRAP_PREREQUISITE_MISSING', [
        `Missing runtime bootstrap ${entity} prerequisites.`,
        `IDs: ${missing.join(', ') || 'unknown'}`,
        'Run the verified seed before the runtime bootstrap.',
    ].join(' '));
}
function assertEqual(actual, expected, field) {
    if (actual === expected) {
        return;
    }
    throw conflict(`Conflicting runtime bootstrap prerequisite: ${field}`);
}
function normalizeContentType(mediaType) {
    const normalized = mediaType.toLowerCase();
    if (normalized.includes('pdf')) {
        return 'pdf';
    }
    if (normalized.includes('json')) {
        return 'json';
    }
    return 'html';
}
function stringArraysEqual(left, right) {
    return (left.length === right.length &&
        left.every((value, index) => value === right[index]));
}
function compareText(left, right) {
    return left.localeCompare(right);
}
function conflict(message) {
    return new runtime_bootstrap_errors_1.RuntimeBootstrapError('RUNTIME_BOOTSTRAP_PREREQUISITE_CONFLICT', message);
}
//# sourceMappingURL=runtime-bootstrap.prerequisites.js.map