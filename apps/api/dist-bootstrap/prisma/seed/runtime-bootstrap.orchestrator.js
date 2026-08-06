"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRuntimeBootstrap = runRuntimeBootstrap;
exports.executeRuntimeBootstrap = executeRuntimeBootstrap;
const runtime_bootstrap_errors_1 = require("./runtime-bootstrap.errors");
const runtime_bootstrap_loader_1 = require("./runtime-bootstrap.loader");
const runtime_bootstrap_plan_1 = require("./runtime-bootstrap.plan");
const runtime_bootstrap_persistence_1 = require("./runtime-bootstrap.persistence");
const runtime_bootstrap_validator_1 = require("./runtime-bootstrap.validator");
async function runRuntimeBootstrap(persistenceClient, recompute, options = {}) {
    const loaded = await (0, runtime_bootstrap_loader_1.loadRuntimeBootstrap)({
        repositoryRoot: options.repositoryRoot,
    });
    const validated = (0, runtime_bootstrap_validator_1.validateRuntimeBootstrap)(loaded);
    const plan = (0, runtime_bootstrap_plan_1.buildRuntimeBootstrapPlan)(validated);
    return executeRuntimeBootstrap({
        persistenceClient,
        plan,
        recompute,
    });
}
async function executeRuntimeBootstrap({ persistenceClient, plan, recompute, persist = runtime_bootstrap_persistence_1.persistRuntimeBootstrapPlan, }) {
    const persistence = await persist(persistenceClient, plan);
    const investigations = [];
    const incidents = [...plan.incidents].sort((left, right) => left.id.localeCompare(right.id));
    for (const incident of incidents) {
        const expected = incident.metadata.runtimeBootstrap;
        const stored = await recompute(incident.id);
        assertRecomputedVersion(incident.id, expected.fixtureInputHash, expected.rulesetVersion, stored);
        investigations.push({
            incidentId: incident.id,
            investigationVersionId: stored.id,
            inputHash: stored.result.inputHash,
            rulesetVersion: stored.result.rulesetVersion,
            evidenceLevel: stored.result.evidenceLevel,
            isCurrent: stored.isCurrent,
        });
    }
    return {
        plan: {
            incidents: plan.incidents.length,
            sourceDocuments: plan.sourceDocuments.length,
            signals: plan.signals.length,
            candidateObjects: plan.candidateObjects.length,
        },
        persistence,
        investigations,
    };
}
function assertRecomputedVersion(expectedIncidentId, expectedInputHash, expectedRulesetVersion, stored) {
    if (stored.investigationId !== expectedIncidentId) {
        throw recomputeMismatch(`Incident mismatch for ${expectedIncidentId}`);
    }
    if (stored.result.inputHash !== expectedInputHash) {
        throw recomputeMismatch(`Input hash mismatch for ${expectedIncidentId}`);
    }
    if (stored.result.rulesetVersion !==
        expectedRulesetVersion) {
        throw recomputeMismatch(`Ruleset version mismatch for ${expectedIncidentId}`);
    }
    if (!stored.isCurrent) {
        throw recomputeMismatch(`Recomputed investigation is not current: ${expectedIncidentId}`);
    }
}
function recomputeMismatch(message) {
    return new runtime_bootstrap_errors_1.RuntimeBootstrapError('RUNTIME_BOOTSTRAP_RECOMPUTE_MISMATCH', message);
}
//# sourceMappingURL=runtime-bootstrap.orchestrator.js.map