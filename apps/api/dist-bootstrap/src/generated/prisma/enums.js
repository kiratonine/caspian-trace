"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceHealthStatus = exports.IngestionRunStatus = exports.IngestionAdapter = exports.ReplayStepType = exports.EvidenceGeneratedBy = exports.EvidenceKind = exports.CandidateDisposition = exports.CorridorKind = exports.IncidentStatus = exports.StationRelationEvidenceBasis = exports.StationRelationKind = exports.SourceDocumentStatus = exports.VerificationStatus = exports.ExtractionMode = exports.Region = exports.EvidenceLevel = void 0;
exports.EvidenceLevel = {
    L0: 'L0',
    L1: 'L1',
    L2: 'L2',
    L3: 'L3'
};
exports.Region = {
    ATYRAU: 'ATYRAU',
    MANGYSTAU: 'MANGYSTAU'
};
exports.ExtractionMode = {
    LLM_VERIFIED: 'LLM_VERIFIED',
    RULE: 'RULE',
    VERIFIED_SEED: 'VERIFIED_SEED'
};
exports.VerificationStatus = {
    UNVERIFIED: 'UNVERIFIED',
    CORROBORATED: 'CORROBORATED',
    OFFICIAL: 'OFFICIAL',
    CONFLICTING: 'CONFLICTING'
};
exports.SourceDocumentStatus = {
    UNVERIFIED: 'UNVERIFIED',
    VERIFIED: 'VERIFIED',
    UNAVAILABLE: 'UNAVAILABLE'
};
exports.StationRelationKind = {
    UPSTREAM_OF: 'UPSTREAM_OF',
    DOWNSTREAM_OF: 'DOWNSTREAM_OF',
    SAME_REACH: 'SAME_REACH'
};
exports.StationRelationEvidenceBasis = {
    OFFICIAL_PAIRED_ABOVE_BELOW_LABELS: 'OFFICIAL_PAIRED_ABOVE_BELOW_LABELS',
    OFFICIAL_MONITORING_TABLE_SEQUENCE_AND_STATION_LABELS: 'OFFICIAL_MONITORING_TABLE_SEQUENCE_AND_STATION_LABELS'
};
exports.IncidentStatus = {
    OPEN: 'OPEN',
    ARCHIVED: 'ARCHIVED'
};
exports.CorridorKind = {
    NONE: 'NONE',
    BETWEEN_STATIONS: 'BETWEEN_STATIONS',
    OPEN_UPSTREAM: 'OPEN_UPSTREAM',
    OPEN_DOWNSTREAM: 'OPEN_DOWNSTREAM'
};
exports.CandidateDisposition = {
    FOR_CHECK: 'FOR_CHECK',
    OUTSIDE_CORRIDOR: 'OUTSIDE_CORRIDOR',
    INSUFFICIENT_DATA: 'INSUFFICIENT_DATA'
};
exports.EvidenceKind = {
    SUPPORTS: 'SUPPORTS',
    CONTRADICTS: 'CONTRADICTS',
    LIMITS: 'LIMITS',
    UNKNOWN: 'UNKNOWN'
};
exports.EvidenceGeneratedBy = {
    RULE_ENGINE: 'RULE_ENGINE',
    HUMAN_VERIFIED: 'HUMAN_VERIFIED'
};
exports.ReplayStepType = {
    SIGNAL: 'SIGNAL',
    CORROBORATION: 'CORROBORATION',
    MEASUREMENT: 'MEASUREMENT',
    INFERENCE: 'INFERENCE',
    CONCLUSION: 'CONCLUSION'
};
exports.IngestionAdapter = {
    KAZHYDROMET: 'KAZHYDROMET',
    GDELT: 'GDELT',
    DIRECT_SOURCE: 'DIRECT_SOURCE',
    VERIFIED_MANIFEST: 'VERIFIED_MANIFEST'
};
exports.IngestionRunStatus = {
    RUNNING: 'RUNNING',
    SUCCEEDED: 'SUCCEEDED',
    PARTIAL: 'PARTIAL',
    FAILED: 'FAILED',
    RATE_LIMITED: 'RATE_LIMITED'
};
exports.SourceHealthStatus = {
    NEVER_RUN: 'NEVER_RUN',
    HEALTHY: 'HEALTHY',
    DEGRADED: 'DEGRADED',
    RATE_LIMITED: 'RATE_LIMITED',
    FAILED: 'FAILED'
};
//# sourceMappingURL=enums.js.map