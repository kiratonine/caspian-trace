"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapLiveHealth = mapLiveHealth;
const source_health_constants_1 = require("../sources/source-health/source-health.constants");
const statusMap = {
    NEVER_RUN: 'never_run',
    HEALTHY: 'healthy',
    DEGRADED: 'degraded',
    RATE_LIMITED: 'rate_limited',
    FAILED: 'failed',
};
function mapLiveHealth(rows) {
    const byId = new Map(rows.map((row) => [row.sourceId, row]));
    return source_health_constants_1.SOURCE_HEALTH_REGISTRY.map((source) => {
        const row = byId.get(source.dbId);
        return {
            id: source.apiId,
            name: source.displayName,
            lastSuccessAt: row?.lastSuccessAt?.toISOString() ??
                null,
            cacheAvailable: row?.cacheAvailable ?? false,
            status: row
                ? statusMap[row.status]
                : 'never_run',
        };
    });
}
//# sourceMappingURL=live.mapper.js.map