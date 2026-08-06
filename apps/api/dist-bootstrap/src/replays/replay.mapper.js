"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toReplayScenario = toReplayScenario;
const contracts_1 = require("@caspian-trace/contracts");
const evidence_mapper_1 = require("../investigations/evidence.mapper");
const REPLAY_STEP_INTERVAL_MS = 5_000;
function toReplayScenario(stored) {
    const signal = stored.input.signals[0];
    const officialSourceIds = new Set(stored.input.sourceDocuments
        .filter(({ official, verified }) => official && verified)
        .map(({ id }) => id));
    const verifiedMeasurements = stored.input.measurements.filter(({ sourceDocumentId, verified }) => verified && officialSourceIds.has(sourceDocumentId));
    const corroboratingSource = stored.input.sourceDocuments.find(({ id }) => officialSourceIds.has(id) &&
        (verifiedMeasurements.some(({ sourceDocumentId }) => sourceDocumentId === id) ||
            stored.input.signals.some(({ sourceDocumentId }) => sourceDocumentId === id)));
    const steps = [];
    let offsetMs = 0;
    if (signal !== undefined) {
        steps.push({
            id: `${stored.investigationId}-signal`,
            offsetMs,
            type: 'signal',
            payload: { signal: (0, evidence_mapper_1.toIncidentSignal)(signal), evidenceLevel: 'L0' },
        });
        offsetMs += REPLAY_STEP_INTERVAL_MS;
    }
    if (corroboratingSource !== undefined &&
        evidenceRank(stored.result.evidenceLevel) >= evidenceRank('L1')) {
        steps.push({
            id: `${stored.investigationId}-corroboration`,
            offsetMs,
            type: 'corroboration',
            payload: {
                text: `Проверенный официальный источник «${corroboratingSource.title}» включён в доказательную базу.`,
                sourceDocumentId: corroboratingSource.id,
                evidenceLevel: 'L1',
            },
        });
        offsetMs += REPLAY_STEP_INTERVAL_MS;
    }
    if (verifiedMeasurements.length > 0 &&
        evidenceRank(stored.result.evidenceLevel) >= evidenceRank('L1')) {
        steps.push({
            id: `${stored.investigationId}-measurements`,
            offsetMs,
            type: 'measurement',
            payload: {
                measurements: verifiedMeasurements.map(evidence_mapper_1.toMeasurement),
                evidenceLevel: 'L1',
            },
        });
        offsetMs += REPLAY_STEP_INTERVAL_MS;
    }
    for (const statement of [
        ...stored.result.supportedFacts,
        ...stored.result.contradictedHypotheses,
    ]) {
        steps.push({
            id: `${stored.investigationId}-inference-${statement.id}`,
            offsetMs,
            type: 'inference',
            payload: { text: statement.text, evidenceLevel: stored.result.evidenceLevel },
        });
        offsetMs += REPLAY_STEP_INTERVAL_MS;
    }
    steps.push({
        id: `${stored.investigationId}-conclusion`,
        offsetMs,
        type: 'conclusion',
        payload: {
            text: stored.result.conclusion,
            evidenceLevel: stored.result.evidenceLevel,
        },
    });
    validateReferences(stored, steps);
    return contracts_1.ReplayScenarioSchema.parse({
        id: stored.investigationId,
        incidentId: stored.input.incident.id,
        steps,
    });
}
function evidenceRank(level) {
    return Number(level.slice(1));
}
function validateReferences(stored, steps) {
    const measurementIds = new Set(stored.input.measurements.map(({ id }) => id));
    const sourceIds = new Set(stored.input.sourceDocuments.map(({ id }) => id));
    for (const step of steps) {
        if (step.type === 'measurement') {
            if (step.payload.measurements.some(({ id }) => !measurementIds.has(id))) {
                throw new Error('REPLAY_UNKNOWN_MEASUREMENT');
            }
        }
        if (step.type === 'corroboration' &&
            !sourceIds.has(step.payload.sourceDocumentId)) {
            throw new Error('REPLAY_UNKNOWN_SOURCE');
        }
    }
}
//# sourceMappingURL=replay.mapper.js.map