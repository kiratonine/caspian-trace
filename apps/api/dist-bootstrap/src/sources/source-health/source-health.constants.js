"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOURCE_HEALTH_REGISTRY = void 0;
exports.getSourceHealthDefinition = getSourceHealthDefinition;
exports.SOURCE_HEALTH_REGISTRY = [
    {
        dbId: 'kazhydromet',
        apiId: 'kazhydromet-bulletins',
        displayName: 'Казгидромет: ежемесячные бюллетени',
    },
    {
        dbId: 'gdelt',
        apiId: 'gdelt',
        displayName: 'GDELT DOC 2.0',
    },
    {
        dbId: 'direct-sources',
        apiId: 'direct-sources',
        displayName: 'Прямые публичные источники',
    },
];
function getSourceHealthDefinition(sourceId) {
    const source = exports.SOURCE_HEALTH_REGISTRY.find((candidate) => candidate.dbId === sourceId);
    if (source === undefined) {
        throw new Error(`Unsupported source health ID: ${sourceId}`);
    }
    return source;
}
//# sourceMappingURL=source-health.constants.js.map