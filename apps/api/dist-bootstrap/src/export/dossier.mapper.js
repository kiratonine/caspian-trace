"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDossier = toDossier;
const contracts_1 = require("@caspian-trace/contracts");
const evidence_mapper_1 = require("../investigations/evidence.mapper");
function toDossier(stored) {
    const dossier = contracts_1.DossierSchema.parse({
        title: stored.input.incident.title,
        generatedAt: stored.generatedAt,
        disclaimer: 'Досье отражает проверенные источники и ограничения данных; оно не устанавливает юридическую ответственность.',
        conclusion: stored.result.conclusion,
        evidenceLevel: stored.result.evidenceLevel,
        signals: stored.input.signals.map(evidence_mapper_1.toIncidentSignal),
        measurements: stored.input.measurements.map(evidence_mapper_1.toMeasurement),
        supportedFacts: stored.result.supportedFacts.map(evidence_mapper_1.toEvidenceStatement),
        contradictedHypotheses: stored.result.contradictedHypotheses.map(evidence_mapper_1.toEvidenceStatement),
        unknowns: stored.result.unknowns,
        candidateObjects: stored.input.candidateObjects.map(evidence_mapper_1.toCandidateObject),
        sources: stored.input.sourceDocuments.map(evidence_mapper_1.toSourceDocument),
        inputHash: stored.result.inputHash,
        rulesetVersion: stored.result.rulesetVersion,
    });
    assertDossierReferences(dossier);
    return dossier;
}
function assertDossierReferences(dossier) {
    const measurementIds = new Set(dossier.measurements.map(({ id }) => id));
    const sourceIds = new Set(dossier.sources.map(({ id }) => id));
    for (const measurement of dossier.measurements) {
        if (!sourceIds.has(measurement.sourceDocumentId)) {
            throw new Error(`DOSSIER_UNKNOWN_MEASUREMENT_SOURCE:${measurement.id}`);
        }
    }
    for (const statement of [
        ...dossier.supportedFacts,
        ...dossier.contradictedHypotheses,
    ]) {
        if (statement.measurementIds.some((id) => !measurementIds.has(id))) {
            throw new Error(`DOSSIER_UNKNOWN_MEASUREMENT:${statement.id}`);
        }
        if (statement.sourceDocumentIds.some((id) => !sourceIds.has(id))) {
            throw new Error(`DOSSIER_UNKNOWN_SOURCE:${statement.id}`);
        }
    }
    for (const candidate of dossier.candidateObjects) {
        if (candidate.evidenceDocumentIds.some((id) => !sourceIds.has(id))) {
            throw new Error(`DOSSIER_UNKNOWN_CANDIDATE_SOURCE:${candidate.id}`);
        }
    }
}
//# sourceMappingURL=dossier.mapper.js.map