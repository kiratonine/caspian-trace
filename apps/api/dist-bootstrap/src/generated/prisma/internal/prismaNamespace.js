"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineExtension = exports.NullsOrder = exports.JsonNullValueFilter = exports.QueryMode = exports.JsonNullValueInput = exports.SortOrder = exports.SourceHealthScalarFieldEnum = exports.IngestionRunScalarFieldEnum = exports.ReplayStepScalarFieldEnum = exports.ReplayScenarioScalarFieldEnum = exports.InvestigationUnknownScalarFieldEnum = exports.EvidenceStatementSourceScalarFieldEnum = exports.EvidenceStatementMeasurementScalarFieldEnum = exports.InvestigationCandidateObjectEvidenceScalarFieldEnum = exports.EvidenceStatementScalarFieldEnum = exports.InvestigationCandidateObjectScalarFieldEnum = exports.InvestigationMeasurementScalarFieldEnum = exports.InvestigationScalarFieldEnum = exports.CandidateObjectSourceScalarFieldEnum = exports.CandidateObjectScalarFieldEnum = exports.IncidentSignalLinkScalarFieldEnum = exports.IncidentScalarFieldEnum = exports.IncidentSignalScalarFieldEnum = exports.MeasurementScalarFieldEnum = exports.StationRelationEvidenceScalarFieldEnum = exports.StationRelationScalarFieldEnum = exports.StationScalarFieldEnum = exports.SourcePageScalarFieldEnum = exports.SourceDocumentScalarFieldEnum = exports.TransactionIsolationLevel = exports.ModelName = exports.AnyNull = exports.JsonNull = exports.DbNull = exports.NullTypes = exports.prismaVersion = exports.getExtensionContext = exports.Decimal = exports.Sql = exports.raw = exports.join = exports.empty = exports.sql = exports.PrismaClientValidationError = exports.PrismaClientInitializationError = exports.PrismaClientRustPanicError = exports.PrismaClientUnknownRequestError = exports.PrismaClientKnownRequestError = void 0;
const runtime = __importStar(require("@prisma/client/runtime/client"));
exports.PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError;
exports.PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError;
exports.PrismaClientRustPanicError = runtime.PrismaClientRustPanicError;
exports.PrismaClientInitializationError = runtime.PrismaClientInitializationError;
exports.PrismaClientValidationError = runtime.PrismaClientValidationError;
exports.sql = runtime.sqltag;
exports.empty = runtime.empty;
exports.join = runtime.join;
exports.raw = runtime.raw;
exports.Sql = runtime.Sql;
exports.Decimal = runtime.Decimal;
exports.getExtensionContext = runtime.Extensions.getExtensionContext;
exports.prismaVersion = {
    client: "7.6.0",
    engine: "75cbdc1eb7150937890ad5465d861175c6624711"
};
exports.NullTypes = {
    DbNull: runtime.NullTypes.DbNull,
    JsonNull: runtime.NullTypes.JsonNull,
    AnyNull: runtime.NullTypes.AnyNull,
};
exports.DbNull = runtime.DbNull;
exports.JsonNull = runtime.JsonNull;
exports.AnyNull = runtime.AnyNull;
exports.ModelName = {
    SourceDocument: 'SourceDocument',
    SourcePage: 'SourcePage',
    Station: 'Station',
    StationRelation: 'StationRelation',
    StationRelationEvidence: 'StationRelationEvidence',
    Measurement: 'Measurement',
    IncidentSignal: 'IncidentSignal',
    Incident: 'Incident',
    IncidentSignalLink: 'IncidentSignalLink',
    CandidateObject: 'CandidateObject',
    CandidateObjectSource: 'CandidateObjectSource',
    Investigation: 'Investigation',
    InvestigationMeasurement: 'InvestigationMeasurement',
    InvestigationCandidateObject: 'InvestigationCandidateObject',
    EvidenceStatement: 'EvidenceStatement',
    InvestigationCandidateObjectEvidence: 'InvestigationCandidateObjectEvidence',
    EvidenceStatementMeasurement: 'EvidenceStatementMeasurement',
    EvidenceStatementSource: 'EvidenceStatementSource',
    InvestigationUnknown: 'InvestigationUnknown',
    ReplayScenario: 'ReplayScenario',
    ReplayStep: 'ReplayStep',
    IngestionRun: 'IngestionRun',
    SourceHealth: 'SourceHealth'
};
exports.TransactionIsolationLevel = runtime.makeStrictEnum({
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
});
exports.SourceDocumentScalarFieldEnum = {
    id: 'id',
    originalUrl: 'originalUrl',
    canonicalUrl: 'canonicalUrl',
    publisher: 'publisher',
    title: 'title',
    sourceType: 'sourceType',
    mediaType: 'mediaType',
    publishedAt: 'publishedAt',
    publishedPeriod: 'publishedPeriod',
    fetchedAt: 'fetchedAt',
    sha256: 'sha256',
    cachePath: 'cachePath',
    httpStatus: 'httpStatus',
    status: 'status',
    extractionMetadata: 'extractionMetadata',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
};
exports.SourcePageScalarFieldEnum = {
    id: 'id',
    sourceDocumentId: 'sourceDocumentId',
    pageNumber: 'pageNumber',
    extractedText: 'extractedText',
    textSha256: 'textSha256',
    createdAt: 'createdAt'
};
exports.StationScalarFieldEnum = {
    id: 'id',
    name: 'name',
    waterBody: 'waterBody',
    region: 'region',
    locationText: 'locationText',
    latitude: 'latitude',
    longitude: 'longitude',
    locationSourceDocumentId: 'locationSourceDocumentId',
    riverOrder: 'riverOrder',
    metadata: 'metadata',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
};
exports.StationRelationScalarFieldEnum = {
    id: 'id',
    fromStationId: 'fromStationId',
    toStationId: 'toStationId',
    kind: 'kind',
    sourceDocumentId: 'sourceDocumentId',
    verificationStatus: 'verificationStatus',
    notes: 'notes',
    metadata: 'metadata',
    createdAt: 'createdAt'
};
exports.StationRelationEvidenceScalarFieldEnum = {
    id: 'id',
    stationRelationId: 'stationRelationId',
    sourceDocumentId: 'sourceDocumentId',
    sourcePage: 'sourcePage',
    basis: 'basis',
    sourceExcerpt: 'sourceExcerpt',
    checkedBy: 'checkedBy',
    checkedAt: 'checkedAt',
    verificationStatus: 'verificationStatus',
    createdAt: 'createdAt'
};
exports.MeasurementScalarFieldEnum = {
    id: 'id',
    stationId: 'stationId',
    sourceDocumentId: 'sourceDocumentId',
    sourcePageId: 'sourcePageId',
    indicator: 'indicator',
    value: 'value',
    rawValueText: 'rawValueText',
    unit: 'unit',
    matrix: 'matrix',
    sampledAt: 'sampledAt',
    sampledPeriod: 'sampledPeriod',
    sourceExcerpt: 'sourceExcerpt',
    extractionMode: 'extractionMode',
    verificationStatus: 'verificationStatus',
    metadata: 'metadata',
    createdAt: 'createdAt'
};
exports.IncidentSignalScalarFieldEnum = {
    id: 'id',
    title: 'title',
    observedAt: 'observedAt',
    observedPeriod: 'observedPeriod',
    reportedAt: 'reportedAt',
    latitude: 'latitude',
    longitude: 'longitude',
    locationText: 'locationText',
    phenomenon: 'phenomenon',
    excerpt: 'excerpt',
    sourceDocumentId: 'sourceDocumentId',
    extractionMode: 'extractionMode',
    verificationStatus: 'verificationStatus',
    dedupKey: 'dedupKey',
    metadata: 'metadata',
    createdAt: 'createdAt'
};
exports.IncidentScalarFieldEnum = {
    id: 'id',
    title: 'title',
    region: 'region',
    indicator: 'indicator',
    status: 'status',
    metadata: 'metadata',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
};
exports.IncidentSignalLinkScalarFieldEnum = {
    incidentId: 'incidentId',
    signalId: 'signalId'
};
exports.CandidateObjectScalarFieldEnum = {
    id: 'id',
    name: 'name',
    objectType: 'objectType',
    activity: 'activity',
    latitude: 'latitude',
    longitude: 'longitude',
    geometrySourceDocumentId: 'geometrySourceDocumentId',
    basisText: 'basisText',
    verificationStatus: 'verificationStatus',
    metadata: 'metadata',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
};
exports.CandidateObjectSourceScalarFieldEnum = {
    candidateObjectId: 'candidateObjectId',
    sourceDocumentId: 'sourceDocumentId'
};
exports.InvestigationScalarFieldEnum = {
    id: 'id',
    incidentId: 'incidentId',
    evidenceLevel: 'evidenceLevel',
    conclusion: 'conclusion',
    corridorKind: 'corridorKind',
    upstreamStationId: 'upstreamStationId',
    downstreamStationId: 'downstreamStationId',
    rulesetVersion: 'rulesetVersion',
    inputHash: 'inputHash',
    generatedAt: 'generatedAt',
    isCurrent: 'isCurrent',
    metadata: 'metadata'
};
exports.InvestigationMeasurementScalarFieldEnum = {
    investigationId: 'investigationId',
    measurementId: 'measurementId'
};
exports.InvestigationCandidateObjectScalarFieldEnum = {
    investigationId: 'investigationId',
    candidateObjectId: 'candidateObjectId',
    disposition: 'disposition',
    note: 'note'
};
exports.EvidenceStatementScalarFieldEnum = {
    id: 'id',
    investigationId: 'investigationId',
    kind: 'kind',
    code: 'code',
    text: 'text',
    generatedBy: 'generatedBy',
    sortOrder: 'sortOrder'
};
exports.InvestigationCandidateObjectEvidenceScalarFieldEnum = {
    investigationId: 'investigationId',
    candidateObjectId: 'candidateObjectId',
    evidenceStatementId: 'evidenceStatementId'
};
exports.EvidenceStatementMeasurementScalarFieldEnum = {
    evidenceStatementId: 'evidenceStatementId',
    measurementId: 'measurementId'
};
exports.EvidenceStatementSourceScalarFieldEnum = {
    evidenceStatementId: 'evidenceStatementId',
    sourceDocumentId: 'sourceDocumentId'
};
exports.InvestigationUnknownScalarFieldEnum = {
    id: 'id',
    investigationId: 'investigationId',
    code: 'code',
    text: 'text',
    sortOrder: 'sortOrder'
};
exports.ReplayScenarioScalarFieldEnum = {
    id: 'id',
    incidentId: 'incidentId',
    title: 'title',
    isDemo: 'isDemo',
    createdAt: 'createdAt'
};
exports.ReplayStepScalarFieldEnum = {
    id: 'id',
    scenarioId: 'scenarioId',
    offsetMs: 'offsetMs',
    type: 'type',
    payload: 'payload'
};
exports.IngestionRunScalarFieldEnum = {
    id: 'id',
    adapter: 'adapter',
    status: 'status',
    startedAt: 'startedAt',
    finishedAt: 'finishedAt',
    fetchedCount: 'fetchedCount',
    acceptedCount: 'acceptedCount',
    rejectedCount: 'rejectedCount',
    errorCode: 'errorCode',
    errorMessage: 'errorMessage',
    metadata: 'metadata'
};
exports.SourceHealthScalarFieldEnum = {
    sourceId: 'sourceId',
    displayName: 'displayName',
    status: 'status',
    lastAttemptAt: 'lastAttemptAt',
    lastSuccessAt: 'lastSuccessAt',
    lastHttpStatus: 'lastHttpStatus',
    cacheAvailable: 'cacheAvailable',
    consecutiveErrors: 'consecutiveErrors',
    detail: 'detail',
    metadata: 'metadata',
    updatedAt: 'updatedAt'
};
exports.SortOrder = {
    asc: 'asc',
    desc: 'desc'
};
exports.JsonNullValueInput = {
    JsonNull: exports.JsonNull
};
exports.QueryMode = {
    default: 'default',
    insensitive: 'insensitive'
};
exports.JsonNullValueFilter = {
    DbNull: exports.DbNull,
    JsonNull: exports.JsonNull,
    AnyNull: exports.AnyNull
};
exports.NullsOrder = {
    first: 'first',
    last: 'last'
};
exports.defineExtension = runtime.Extensions.defineExtension;
//# sourceMappingURL=prismaNamespace.js.map