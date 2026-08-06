"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toEvidenceGraph = toEvidenceGraph;
exports.toIncidentSignal = toIncidentSignal;
exports.toCandidateObject = toCandidateObject;
exports.toEvidenceStatement = toEvidenceStatement;
exports.toMeasurement = toMeasurement;
exports.toSourceDocument = toSourceDocument;
const contracts_1 = require("@caspian-trace/contracts");
function toEvidenceGraph(stored) {
    const graph = contracts_1.EvidenceGraphSchema.parse({
        investigationId: stored.investigationId,
        statements: [
            ...stored.result.supportedFacts,
            ...stored.result.contradictedHypotheses,
        ].map(toEvidenceStatement),
        measurements: stored.input.measurements.map(toMeasurement),
        sourceDocuments: stored.input.sourceDocuments.map(toSourceDocument),
    });
    assertEvidenceGraphReferences(graph);
    return graph;
}
function assertEvidenceGraphReferences(graph) {
    const measurementIds = new Set(graph.measurements.map(({ id }) => id));
    const sourceDocumentIds = new Set(graph.sourceDocuments.map(({ id }) => id));
    for (const measurement of graph.measurements) {
        if (!sourceDocumentIds.has(measurement.sourceDocumentId)) {
            throw new Error(`EVIDENCE_UNKNOWN_MEASUREMENT_SOURCE:${measurement.id}`);
        }
    }
    for (const statement of graph.statements) {
        if (statement.measurementIds.some((id) => !measurementIds.has(id))) {
            throw new Error(`EVIDENCE_UNKNOWN_MEASUREMENT:${statement.id}`);
        }
        if (statement.sourceDocumentIds.some((id) => !sourceDocumentIds.has(id))) {
            throw new Error(`EVIDENCE_UNKNOWN_SOURCE:${statement.id}`);
        }
    }
}
function toIncidentSignal(signal) {
    return {
        id: signal.id,
        title: signal.title,
        observedAt: signal.observedAt,
        observedPeriod: signal.observedPeriod,
        reportedAt: signal.reportedAt,
        location: null,
        locationText: signal.locationText,
        phenomenon: signal.phenomenon,
        excerpt: signal.excerpt,
        sourceDocumentId: signal.sourceDocumentId,
        extractionMode: signal.extractionMode,
        verificationStatus: signal.verificationStatus,
    };
}
function toCandidateObject(candidate) {
    return {
        id: candidate.id,
        name: candidate.name,
        category: candidate.category,
        location: null,
        waterBody: candidate.waterBody,
        riverOrder: null,
        evidenceDocumentIds: candidate.evidenceDocumentIds,
        completeness: candidate.completeness,
    };
}
function toEvidenceStatement(statement) {
    return {
        id: statement.id,
        code: statement.code,
        kind: statement.kind,
        text: statement.text,
        measurementIds: statement.measurementIds,
        sourceDocumentIds: statement.sourceDocumentIds,
        generatedBy: 'rule_engine',
        sortOrder: statement.sortOrder,
    };
}
function toMeasurement(measurement) {
    const value = Number(measurement.value);
    if (!Number.isFinite(value))
        throw new Error('DECIMAL_OUT_OF_API_RANGE');
    return {
        id: measurement.id,
        stationId: measurement.stationId,
        sampledAt: measurement.sampledAt,
        sampledPeriod: measurement.sampledPeriod,
        indicator: measurement.indicator,
        value,
        rawValueText: measurement.rawValueText,
        unit: normalizeContractUnit(measurement.unit),
        matrix: normalizeContractMatrix(measurement.matrix),
        qualityClass: null,
        sourceDocumentId: measurement.sourceDocumentId,
        sourcePage: measurement.sourcePage,
        sourceExcerpt: measurement.sourceExcerpt,
        verified: measurement.verified,
    };
}
function toSourceDocument(source) {
    return {
        id: source.id,
        title: source.title,
        publisher: source.publisher,
        url: source.url,
        publishedAt: source.publishedAt,
        fetchedAt: source.fetchedAt,
        contentType: source.contentType,
        sha256: source.sha256,
        cachePath: source.cachePath,
        status: source.status,
    };
}
function normalizeContractUnit(value) {
    if (value === 'mg/dm3' || value === 'mg/kg' || value === 'percent')
        return value;
    throw new Error(`UNSUPPORTED_API_UNIT:${value}`);
}
function normalizeContractMatrix(value) {
    if (value === 'water' || value === 'sediment')
        return value;
    throw new Error(`UNSUPPORTED_API_MATRIX:${value}`);
}
//# sourceMappingURL=evidence.mapper.js.map