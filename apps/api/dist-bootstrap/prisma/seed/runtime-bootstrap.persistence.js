"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistRuntimeBootstrapPlan = persistRuntimeBootstrapPlan;
const enums_1 = require("../../src/generated/prisma/enums");
const runtime_bootstrap_errors_1 = require("./runtime-bootstrap.errors");
const runtime_bootstrap_prerequisites_1 = require("./runtime-bootstrap.prerequisites");
async function persistRuntimeBootstrapPlan(prisma, plan, options = {}) {
    const verifyPrerequisites = options.verifyPrerequisites ?? runtime_bootstrap_prerequisites_1.verifyRuntimeBootstrapPrerequisites;
    return prisma.$transaction(async (transaction) => {
        const prerequisites = await verifyPrerequisites(transaction, plan);
        for (const source of plan.sourceDocuments) {
            await persistSourceDocument(transaction, source);
        }
        for (const relation of plan.relations) {
            const existing = await transaction.stationRelation.findUnique({
                where: { id: relation.id },
                select: { id: true, metadata: true },
            });
            if (existing === null) {
                throw conflict(`Canonical station relation is missing: ${relation.id}`);
            }
            await transaction.stationRelation.update({
                where: { id: relation.id },
                data: {
                    metadata: mergeMetadata(existing.metadata, {
                        comparisonPair: relation.comparisonPair,
                        runtimeBootstrap: {
                            version: 1,
                            evidenceIds: relation.evidenceIds,
                            sourceDocumentIds: relation.sourceDocumentIds,
                        },
                    }),
                },
            });
        }
        for (const incident of plan.incidents) {
            await persistIncident(transaction, incident);
        }
        for (const signal of plan.signals) {
            await persistSignal(transaction, signal);
        }
        for (const link of plan.signalLinks) {
            await transaction.incidentSignalLink.upsert({
                where: {
                    incidentId_signalId: {
                        incidentId: link.incidentId,
                        signalId: link.signalId,
                    },
                },
                create: {
                    incidentId: link.incidentId,
                    signalId: link.signalId,
                },
                update: {},
            });
        }
        for (const candidate of plan.candidateObjects) {
            await persistCandidateObject(transaction, candidate);
        }
        for (const link of plan.candidateSources) {
            await transaction.candidateObjectSource.upsert({
                where: {
                    candidateObjectId_sourceDocumentId: {
                        candidateObjectId: link.candidateObjectId,
                        sourceDocumentId: link.sourceDocumentId,
                    },
                },
                create: {
                    candidateObjectId: link.candidateObjectId,
                    sourceDocumentId: link.sourceDocumentId,
                },
                update: {},
            });
        }
        return {
            prerequisites,
            sourceDocuments: plan.sourceDocuments.length,
            stationRelations: plan.relations.length,
            incidents: plan.incidents.length,
            incidentSignals: plan.signals.length,
            incidentSignalLinks: plan.signalLinks.length,
            candidateObjects: plan.candidateObjects.length,
            candidateObjectSources: plan.candidateSources.length,
        };
    }, {
        maxWait: 10_000,
        timeout: 30_000,
    });
}
async function persistSourceDocument(transaction, source) {
    const existing = await transaction.sourceDocument.findUnique({
        where: { id: source.id },
        select: {
            id: true,
            originalUrl: true,
            canonicalUrl: true,
            publisher: true,
            title: true,
            sourceType: true,
            mediaType: true,
            publishedAt: true,
            fetchedAt: true,
            sha256: true,
            cachePath: true,
            status: true,
            extractionMetadata: true,
        },
    });
    const status = mapSourceStatus(source.status);
    const metadata = mergeMetadata(existing?.extractionMetadata, {
        official: source.official,
        verified: source.verified,
        runtimeBootstrap: {
            version: 1,
            inputPaths: source.inputPaths,
        },
    });
    if (existing === null) {
        if (source.official) {
            throw conflict(`Verified source document is missing: ${source.id}`);
        }
        await transaction.sourceDocument.create({
            data: {
                id: source.id,
                originalUrl: source.url,
                canonicalUrl: source.url,
                publisher: source.publisher,
                title: source.title,
                sourceType: 'media_article',
                mediaType: mapMediaType(source.contentType),
                publishedAt: toDate(source.publishedAt),
                publishedPeriod: null,
                fetchedAt: toDate(source.fetchedAt),
                sha256: source.sha256,
                cachePath: source.cachePath,
                httpStatus: null,
                status,
                extractionMetadata: metadata,
            },
        });
        return;
    }
    assertEqual(existing.originalUrl, source.url, `${source.id} original URL`);
    assertEqual(existing.canonicalUrl, source.url, `${source.id} canonical URL`);
    assertEqual(existing.publisher, source.publisher, `${source.id} publisher`);
    assertExpectedNullable(existing.sha256, source.sha256, `${source.id} SHA-256`);
    assertExpectedNullable(existing.cachePath, source.cachePath, `${source.id} cache path`);
    assertExpectedDate(existing.publishedAt, source.publishedAt, `${source.id} publishedAt`);
    assertExpectedDate(existing.fetchedAt, source.fetchedAt, `${source.id} fetchedAt`);
    assertEqual(normalizeMediaType(existing.mediaType), source.contentType, `${source.id} media type`);
    function assertExpectedNullable(actual, expected, label) {
        if (expected === null) {
            return;
        }
        assertEqual(actual, expected, label);
    }
    function assertExpectedDate(actual, expected, label) {
        if (expected === null) {
            return;
        }
        assertDate(actual, expected, label);
    }
    await transaction.sourceDocument.update({
        where: { id: source.id },
        data: {
            title: source.title,
            extractionMetadata: metadata,
        },
    });
}
async function persistIncident(transaction, incident) {
    const region = mapRegion(incident.region);
    const existing = await transaction.incident.findUnique({
        where: { id: incident.id },
        select: {
            id: true,
            region: true,
            indicator: true,
        },
    });
    if (existing !== null) {
        assertEqual(existing.region, region, `${incident.id} region`);
        assertEqual(existing.indicator, incident.indicator, `${incident.id} indicator`);
    }
    await transaction.incident.upsert({
        where: { id: incident.id },
        create: {
            id: incident.id,
            title: incident.title,
            region,
            indicator: incident.indicator,
            status: enums_1.IncidentStatus.OPEN,
            metadata: jsonValue(incident.metadata),
        },
        update: {
            title: incident.title,
            status: enums_1.IncidentStatus.OPEN,
            metadata: jsonValue(incident.metadata),
        },
    });
}
async function persistSignal(transaction, signal) {
    const existing = await transaction.incidentSignal.findUnique({
        where: { id: signal.id },
        select: {
            id: true,
            sourceDocumentId: true,
            dedupKey: true,
        },
    });
    if (existing !== null) {
        assertEqual(existing.sourceDocumentId, signal.sourceDocumentId, `${signal.id} source document`);
        assertEqual(existing.dedupKey, signal.id, `${signal.id} dedup key`);
    }
    const data = {
        title: signal.title,
        observedAt: toDate(signal.observedAt),
        observedPeriod: signal.observedPeriod,
        reportedAt: requiredDate(signal.reportedAt, `${signal.id} reportedAt`),
        latitude: null,
        longitude: null,
        locationText: signal.locationText,
        phenomenon: signal.phenomenon,
        excerpt: signal.excerpt,
        sourceDocumentId: signal.sourceDocumentId,
        extractionMode: mapExtractionMode(signal.extractionMode),
        verificationStatus: mapVerificationStatus(signal.verificationStatus),
        dedupKey: signal.id,
        metadata: jsonValue({
            runtimeBootstrap: {
                version: 1,
                checkedAt: signal.checkedAt,
                provenanceStatus: signal.provenanceStatus,
                inputPaths: signal.inputPaths,
            },
        }),
    };
    await transaction.incidentSignal.upsert({
        where: { id: signal.id },
        create: {
            id: signal.id,
            ...data,
        },
        update: data,
    });
}
async function persistCandidateObject(transaction, candidate) {
    const existing = await transaction.candidateObject.findUnique({
        where: { id: candidate.id },
        select: {
            id: true,
            name: true,
            objectType: true,
        },
    });
    if (existing !== null) {
        assertEqual(existing.name, candidate.name, `${candidate.id} name`);
        assertEqual(existing.objectType, candidate.category, `${candidate.id} category`);
    }
    const basisText = [
        `Объект упомянут в документах: ${candidate.evidenceDocumentIds.join(', ')}.`,
        'Причинная связь с загрязнением не установлена.',
    ].join(' ');
    const data = {
        name: candidate.name,
        objectType: candidate.category,
        activity: null,
        latitude: null,
        longitude: null,
        geometrySourceDocumentId: null,
        basisText,
        verificationStatus: candidate.completeness === 'confirmed'
            ? enums_1.VerificationStatus.OFFICIAL
            : enums_1.VerificationStatus.UNVERIFIED,
        metadata: jsonValue({
            stationId: candidate.stationId,
            waterBody: candidate.waterBody,
            completeness: candidate.completeness,
            incidentIds: candidate.incidentIds,
            runtimeBootstrap: {
                version: 1,
                evidenceDocumentIds: candidate.evidenceDocumentIds,
            },
        }),
    };
    await transaction.candidateObject.upsert({
        where: { id: candidate.id },
        create: {
            id: candidate.id,
            ...data,
        },
        update: data,
    });
}
function mapRegion(value) {
    return value === 'atyrau' ? enums_1.Region.ATYRAU : enums_1.Region.MANGYSTAU;
}
function mapSourceStatus(value) {
    switch (value) {
        case 'unverified':
            return enums_1.SourceDocumentStatus.UNVERIFIED;
        case 'verified':
            return enums_1.SourceDocumentStatus.VERIFIED;
        case 'unavailable':
            return enums_1.SourceDocumentStatus.UNAVAILABLE;
    }
}
function mapExtractionMode(value) {
    switch (value) {
        case 'llm_verified':
            return enums_1.ExtractionMode.LLM_VERIFIED;
        case 'rule':
            return enums_1.ExtractionMode.RULE;
        case 'verified_seed':
            return enums_1.ExtractionMode.VERIFIED_SEED;
    }
}
function mapVerificationStatus(value) {
    switch (value) {
        case 'unverified':
            return enums_1.VerificationStatus.UNVERIFIED;
        case 'corroborated':
            return enums_1.VerificationStatus.CORROBORATED;
        case 'official':
            return enums_1.VerificationStatus.OFFICIAL;
        case 'conflicting':
            return enums_1.VerificationStatus.CONFLICTING;
    }
}
function mapMediaType(value) {
    return value === 'pdf' ? 'application/pdf' : 'text/html';
}
function normalizeMediaType(value) {
    if (value === 'pdf' || value === 'application/pdf')
        return 'pdf';
    if (value === 'html' || value === 'text/html')
        return 'html';
    throw conflict(`Unsupported source media type: ${value}`);
}
function requiredDate(value, label) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw conflict(`Invalid datetime for ${label}`);
    }
    return parsed;
}
function toDate(value) {
    return value === null ? null : requiredDate(value, 'runtime bootstrap value');
}
function assertDate(actual, expected, label) {
    const actualValue = actual?.toISOString() ?? null;
    const expectedValue = expected === null
        ? null
        : requiredDate(expected, label).toISOString();
    assertEqual(actualValue, expectedValue, label);
}
function assertEqual(actual, expected, label) {
    if (actual !== expected) {
        throw conflict(`Conflicting ${label}`);
    }
}
function mergeMetadata(existing, patch) {
    return jsonValue({
        ...asRecord(existing),
        ...patch,
    });
}
function jsonValue(value) {
    return JSON.parse(JSON.stringify(value));
}
function asRecord(value) {
    return typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
        ? value
        : {};
}
function conflict(message) {
    return new runtime_bootstrap_errors_1.RuntimeBootstrapError('RUNTIME_BOOTSTRAP_PERSISTENCE_CONFLICT', message);
}
//# sourceMappingURL=runtime-bootstrap.persistence.js.map