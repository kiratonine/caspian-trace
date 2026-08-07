"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRuntimeBootstrapPlan = buildRuntimeBootstrapPlan;
const runtime_bootstrap_errors_1 = require("./runtime-bootstrap.errors");
function buildRuntimeBootstrapPlan(validated) {
    const sourceDocuments = new Map();
    const signals = new Map();
    const relations = new Map();
    const candidateObjects = new Map();
    const incidents = [];
    const signalLinks = [];
    for (const validatedCase of validated.cases) {
        incidents.push(buildIncidentPlan(validatedCase));
        addSources(sourceDocuments, validatedCase);
        addSignals(signals, signalLinks, validatedCase);
        addRelations(relations, validatedCase);
        addCandidates(candidateObjects, validatedCase);
    }
    const candidates = [...candidateObjects.values()]
        .map((candidate) => ({
        ...candidate,
        evidenceDocumentIds: uniqueSorted(candidate.evidenceDocumentIds),
        incidentIds: uniqueSorted(candidate.incidentIds),
    }))
        .sort(compareById);
    return {
        version: 1,
        incidents,
        sourceDocuments: [...sourceDocuments.values()]
            .map((source) => ({
            ...source,
            inputPaths: uniqueSorted(source.inputPaths),
        }))
            .sort(compareById),
        signals: [...signals.values()]
            .map((signal) => ({
            ...signal,
            incidentIds: uniqueSorted(signal.incidentIds),
            inputPaths: uniqueSorted(signal.inputPaths),
        }))
            .sort(compareById),
        signalLinks: [...signalLinks]
            .sort(compareSignalLinks),
        relations: [...relations.values()]
            .map((relation) => ({
            ...relation,
            evidenceIds: uniqueSorted(relation.evidenceIds),
            sourceDocumentIds: uniqueSorted(relation.sourceDocumentIds),
        }))
            .sort(compareById),
        candidateObjects: candidates,
        candidateSources: candidates
            .flatMap((candidate) => candidate.evidenceDocumentIds.map((sourceDocumentId) => ({
            candidateObjectId: candidate.id,
            sourceDocumentId,
        })))
            .sort(compareCandidateSources),
        requiredVerifiedData: {
            sourceDocumentIds: uniqueSorted(validated.cases.flatMap(({ input }) => input.sourceDocuments
                .filter(({ official }) => official)
                .map(({ id }) => id))),
            stationIds: uniqueSorted(validated.cases.flatMap(({ handoff }) => handoff.stationIds)),
            stationRelationIds: uniqueSorted(validated.cases.flatMap(({ handoff }) => handoff.stationRelationIds)),
            stationRelationEvidenceIds: uniqueSorted(validated.cases.flatMap(({ handoff }) => handoff
                .stationRelationEvidenceIds)),
            measurementIds: uniqueSorted(validated.cases.flatMap(({ handoff }) => handoff.measurementIds)),
        },
    };
}
function buildIncidentPlan(validatedCase) {
    const { handoff, input } = validatedCase;
    const stationRelationFacts = input.stationRelations.map((relation, index) => {
        const relationId = handoff.stationRelationIds[index];
        const expectedEvidenceId = handoff
            .stationRelationEvidenceIds[index];
        if (relationId === undefined) {
            throw planConflict(`Missing canonical relation ID for ${relation.id}`);
        }
        if (expectedEvidenceId ===
            undefined) {
            throw planConflict(`Missing relation evidence ID for ${relationId}`);
        }
        if (expectedEvidenceId !==
            relation.id) {
            throw planConflict([
                'Relation evidence order',
                'does not match input:',
                relation.id,
            ].join(' '));
        }
        return {
            relationId,
            evidenceId: relation.id,
            sourceDocumentId: relation.sourceDocumentId,
            basis: relation.basis,
            comparisonPair: relation.comparisonPair,
            provenance: structuredClone(relation.provenance),
        };
    });
    const candidateObjectFacts = input.candidateObjects.map((candidate) => ({
        candidateObjectId: candidate.id,
        evidenceDocumentIds: uniqueSorted(candidate
            .evidenceDocumentIds),
    }));
    return {
        id: input.incident.id,
        title: input.incident.title,
        region: input.incident.region,
        indicator: input.incident.indicator,
        status: 'OPEN',
        metadata: {
            unknowns: structuredClone(input.incident.unknowns ??
                []),
            stationIds: [
                ...handoff.stationIds,
            ],
            stationRelationIds: [
                ...handoff.stationRelationIds,
            ],
            measurementIds: [
                ...handoff.measurementIds,
            ],
            candidateObjectIds: [
                ...handoff
                    .candidateObjectIds,
            ],
            sourceDocumentIds: [
                ...handoff
                    .sourceDocumentIds,
            ],
            runtimeBootstrap: {
                version: 1,
                inputPath: handoff.inputPath,
                expectedResultPath: handoff
                    .expectedResultPath,
                stationRelationEvidenceIds: [
                    ...handoff
                        .stationRelationEvidenceIds,
                ],
                stationFacts: structuredClone(input.stations),
                stationRelationFacts,
                candidateObjectFacts,
                sourceDocumentFacts: structuredClone(input.sourceDocuments),
                measurementFacts: structuredClone(input.measurements),
                fixtureInputHash: handoff.expectedResult
                    .fixtureInputHash,
                rulesetVersion: handoff.expectedResult
                    .rulesetVersion,
                signalAbsenceReason: handoff
                    .signalAbsenceReason ??
                    null,
            },
        },
    };
}
function addSources(target, validatedCase) {
    for (const source of validatedCase.input.sourceDocuments) {
        const next = {
            id: source.id,
            title: source.title,
            publisher: source.publisher,
            url: source.url,
            official: source.official,
            verified: source.verified,
            publishedAt: source.publishedAt,
            fetchedAt: source.fetchedAt,
            contentType: source.contentType,
            sha256: source.sha256,
            cachePath: source.cachePath,
            status: source.status,
            inputPaths: [
                validatedCase.handoff.inputPath,
            ],
        };
        const existing = target.get(source.id);
        if (existing === undefined) {
            target.set(source.id, next);
            continue;
        }
        assertSameFingerprint(sourceFingerprint(existing), sourceFingerprint(next), `source document ${source.id}`);
        existing.inputPaths.push(validatedCase.handoff.inputPath);
    }
}
function addSignals(target, links, validatedCase) {
    for (const signal of validatedCase.input.signals) {
        const provenance = requiredSignalProvenance(validatedCase.handoff, signal.id);
        const next = {
            id: signal.id,
            title: signal.title,
            observedAt: signal.observedAt,
            observedPeriod: signal.observedPeriod,
            reportedAt: signal.reportedAt,
            locationText: signal.locationText,
            phenomenon: signal.phenomenon,
            excerpt: signal.excerpt,
            sourceDocumentId: signal.sourceDocumentId,
            extractionMode: signal.extractionMode,
            verificationStatus: signal.verificationStatus,
            checkedAt: provenance.checkedAt ?? null,
            provenanceStatus: provenance.status ?? null,
            incidentIds: [
                validatedCase.input.incident.id,
            ],
            inputPaths: [
                validatedCase.handoff.inputPath,
            ],
        };
        const existing = target.get(signal.id);
        if (existing === undefined) {
            target.set(signal.id, next);
        }
        else {
            assertSameFingerprint(signalFingerprint(existing), signalFingerprint(next), `incident signal ${signal.id}`);
            existing.incidentIds.push(validatedCase.input.incident.id);
            existing.inputPaths.push(validatedCase.handoff.inputPath);
        }
        links.push({
            incidentId: validatedCase.input.incident.id,
            signalId: signal.id,
        });
    }
}
function addRelations(target, validatedCase) {
    const { handoff, input, } = validatedCase;
    for (const [index, relation] of input.stationRelations.entries()) {
        const canonicalId = handoff.stationRelationIds[index];
        if (canonicalId === undefined) {
            throw planConflict(`Missing canonical relation ID for ${relation.id}`);
        }
        const comparisonPair = handoff.comparisonPairRelationIds
            .includes(canonicalId);
        if (relation.comparisonPair !==
            comparisonPair) {
            throw planConflict(`Comparison-pair mismatch for ${canonicalId}`);
        }
        const existing = target.get(canonicalId);
        if (existing === undefined) {
            target.set(canonicalId, {
                id: canonicalId,
                comparisonPair,
                evidenceIds: [relation.id],
                sourceDocumentIds: [
                    relation.sourceDocumentId,
                ],
            });
            continue;
        }
        if (existing.comparisonPair !==
            comparisonPair) {
            throw planConflict(`Conflicting comparison-pair value for ${canonicalId}`);
        }
        existing.evidenceIds.push(relation.id);
        existing.sourceDocumentIds.push(relation.sourceDocumentId);
    }
}
function addCandidates(target, validatedCase) {
    for (const candidate of validatedCase.input.candidateObjects) {
        const next = {
            id: candidate.id,
            name: candidate.name,
            category: candidate.category,
            stationId: candidate.stationId,
            waterBody: candidate.waterBody,
            completeness: candidate.completeness,
            evidenceDocumentIds: [
                ...candidate
                    .evidenceDocumentIds,
            ],
            incidentIds: [
                validatedCase.input.incident.id,
            ],
        };
        const existing = target.get(candidate.id);
        if (existing === undefined) {
            target.set(candidate.id, next);
            continue;
        }
        assertSameFingerprint(candidateFingerprint(existing), candidateFingerprint(next), `candidate object ${candidate.id}`);
        existing.evidenceDocumentIds.push(...candidate.evidenceDocumentIds);
        existing.incidentIds.push(validatedCase.input.incident.id);
    }
}
function requiredSignalProvenance(handoff, signalId) {
    const provenance = handoff.signalProvenance.find((item) => item.signalId === signalId);
    if (provenance === undefined) {
        throw planConflict(`Missing signal provenance for ${signalId}`);
    }
    return provenance;
}
function sourceFingerprint(source) {
    return JSON.stringify([
        source.id,
        source.title,
        source.publisher,
        source.url,
        source.official,
        source.verified,
        source.publishedAt,
        source.fetchedAt,
        source.contentType,
        source.sha256,
        source.cachePath,
        source.status,
    ]);
}
function signalFingerprint(signal) {
    return JSON.stringify([
        signal.id,
        signal.title,
        signal.observedAt,
        signal.observedPeriod,
        signal.reportedAt,
        signal.locationText,
        signal.phenomenon,
        signal.excerpt,
        signal.sourceDocumentId,
        signal.extractionMode,
        signal.verificationStatus,
        signal.checkedAt,
        signal.provenanceStatus,
    ]);
}
function candidateFingerprint(candidate) {
    return JSON.stringify([
        candidate.id,
        candidate.name,
        candidate.category,
        candidate.stationId,
        candidate.waterBody,
        candidate.completeness,
    ]);
}
function assertSameFingerprint(existing, expected, entity) {
    if (existing === expected) {
        return;
    }
    throw planConflict(`Conflicting runtime bootstrap ${entity}`);
}
function uniqueSorted(values) {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
function compareById(left, right) {
    return left.id.localeCompare(right.id);
}
function compareSignalLinks(left, right) {
    return (left.incidentId.localeCompare(right.incidentId) ||
        left.signalId.localeCompare(right.signalId));
}
function compareCandidateSources(left, right) {
    return (left.candidateObjectId.localeCompare(right.candidateObjectId) ||
        left.sourceDocumentId.localeCompare(right.sourceDocumentId));
}
function planConflict(message) {
    return new runtime_bootstrap_errors_1.RuntimeBootstrapError('RUNTIME_BOOTSTRAP_PLAN_CONFLICT', message);
}
//# sourceMappingURL=runtime-bootstrap.plan.js.map