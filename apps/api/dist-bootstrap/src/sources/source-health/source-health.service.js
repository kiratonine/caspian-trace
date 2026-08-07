"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceHealthService = void 0;
const common_1 = require("@nestjs/common");
const enums_1 = require("../../generated/prisma/enums");
const source_health_constants_1 = require("./source-health.constants");
const source_health_repository_1 = require("./source-health.repository");
let SourceHealthService = class SourceHealthService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    startAttempt(sourceId, at = new Date()) {
        const source = (0, source_health_constants_1.getSourceHealthDefinition)(sourceId);
        return this.repository.startAttempt({
            sourceId,
            displayName: source.displayName,
            at,
        });
    }
    markSuccess(sourceId, input) {
        const source = (0, source_health_constants_1.getSourceHealthDefinition)(sourceId);
        return this.repository.transition({
            sourceId,
            displayName: source.displayName,
            at: input.at,
            status: input.degraded
                ? enums_1.SourceHealthStatus.DEGRADED
                : enums_1.SourceHealthStatus.HEALTHY,
            lastHttpStatus: input.lastHttpStatus,
            cacheAvailable: input.cacheAvailable,
            detail: input.detail ?? null,
            actualError: false,
            success: true,
            metadata: input.metadata ?? {},
        });
    }
    markFailure(sourceId, input) {
        const source = (0, source_health_constants_1.getSourceHealthDefinition)(sourceId);
        return this.repository.transition({
            sourceId,
            displayName: source.displayName,
            at: input.at,
            status: input.degraded
                ? enums_1.SourceHealthStatus.DEGRADED
                : enums_1.SourceHealthStatus.FAILED,
            lastHttpStatus: input.lastHttpStatus,
            cacheAvailable: input.cacheAvailable,
            detail: formatError(input.error),
            actualError: true,
            success: input.success,
            metadata: input.metadata ?? {},
        });
    }
    markRateLimited(sourceId, input) {
        const source = (0, source_health_constants_1.getSourceHealthDefinition)(sourceId);
        const metadata = {
            ...(input.metadata ?? {}),
            ...(input.retryAt
                ? {
                    retryAt: input.retryAt.toISOString(),
                }
                : {}),
        };
        return this.repository.transition({
            sourceId,
            displayName: source.displayName,
            at: input.at,
            status: enums_1.SourceHealthStatus.RATE_LIMITED,
            lastHttpStatus: input.lastHttpStatus,
            cacheAvailable: input.cacheAvailable,
            detail: formatError(input.error ?? {
                code: 'SOURCE_RATE_LIMITED',
                message: 'Source is rate limited',
            }),
            actualError: true,
            success: input.success,
            metadata,
        });
    }
    getAll() {
        return this.repository.findAll(source_health_constants_1.SOURCE_HEALTH_REGISTRY.map((source) => source.dbId));
    }
};
exports.SourceHealthService = SourceHealthService;
exports.SourceHealthService = SourceHealthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [source_health_repository_1.SourceHealthRepository])
], SourceHealthService);
function formatError(error) {
    return `${error.code}: ${error.message}`;
}
//# sourceMappingURL=source-health.service.js.map