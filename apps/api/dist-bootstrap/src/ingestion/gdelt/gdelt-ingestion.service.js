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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GdeltIngestionService = void 0;
exports.normalizeGdeltRequest = normalizeGdeltRequest;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const safe_fetch_errors_1 = require("../../common/http/safe-fetch/safe-fetch.errors");
const enums_1 = require("../../generated/prisma/enums");
const source_health_service_1 = require("../../sources/source-health/source-health.service");
const direct_source_adapter_1 = require("../direct-sources/direct-source.adapter");
const direct_source_service_1 = require("../direct-sources/direct-source.service");
const article_ingestion_service_1 = require("../article/article-ingestion.service");
const ingestion_constants_1 = require("../ingestion.constants");
const ingestion_errors_1 = require("../ingestion.errors");
const ingestion_repository_1 = require("../ingestion.repository");
const article_url_1 = require("../article/article-url");
const gdelt_adapter_1 = require("./gdelt.adapter");
const article_signal_enrichment_runner_service_1 = require("../article/article-signal-enrichment-runner.service");
let GdeltIngestionService = class GdeltIngestionService {
    gdelt;
    directAdapter;
    directSources;
    articles;
    signalEnrichment;
    sourceHealth;
    repository;
    clock;
    maxRecords;
    maxArticles;
    maxWindowDays;
    constructor(gdelt, directAdapter, directSources, articles, signalEnrichment, sourceHealth, repository, config, clock) {
        this.gdelt = gdelt;
        this.directAdapter = directAdapter;
        this.directSources = directSources;
        this.articles = articles;
        this.signalEnrichment = signalEnrichment;
        this.sourceHealth = sourceHealth;
        this.repository = repository;
        this.clock = clock;
        this.maxRecords = config.getOrThrow('GDELT_MAX_RECORDS');
        this.maxArticles = config.getOrThrow('GDELT_MAX_ARTICLES_PER_RUN');
        this.maxWindowDays = config.getOrThrow('GDELT_MAX_WINDOW_DAYS');
    }
    async run(dto) {
        const request = normalizeGdeltRequest(dto, {
            now: this.clock.now(), maxRecords: this.maxRecords,
            maxArticles: this.maxArticles, maxWindowDays: this.maxWindowDays,
        });
        const startedAt = this.clock.now();
        const runId = (0, node_crypto_1.randomUUID)();
        await this.repository.createPublicRun({
            id: runId,
            adapter: enums_1.IngestionAdapter.GDELT,
            metadata: requestMetadata(request),
        });
        await this.sourceHealth.startAttempt('gdelt', startedAt);
        const state = {
            sourceStatus: null, cacheStatus: null, httpStatus: null, fetchedCount: 0,
            discoveredCount: 0, allowedCandidateCount: 0, invalidCandidateCount: 0,
            accepted: [], rejectedCount: 0, regionMismatchCount: 0,
            irrelevantCount: 0,
            parserFailureCount: 0,
            queryHash: null, error: null, responseUsable: false,
            enrichmentAttemptedCount: 0,
            enrichmentCandidateCount: 0,
            enrichmentFailedCount: 0,
            signalCandidates: [],
        };
        let gdeltCandidates = [];
        try {
            const discovery = await this.gdelt.discover(request);
            state.responseUsable = true;
            state.fetchedCount = 1;
            state.sourceStatus = discovery.metadata.sourceStatus;
            state.cacheStatus = discovery.metadata.cacheStatus;
            state.httpStatus = discovery.metadata.statusCode;
            state.discoveredCount = discovery.discoveredCount;
            state.invalidCandidateCount = discovery.invalidCandidateCount;
            state.allowedCandidateCount = discovery.candidates.length;
            state.queryHash = discovery.queryHash;
            gdeltCandidates = discovery.candidates;
            if (discovery.metadata.sourceStatus !== 'healthy') {
                state.error = safeGdeltSourceError(discovery.metadata.sourceStatus);
            }
            for (const candidate of discovery.candidates) {
                try {
                    const processed = await this.articles.process(candidate, runId);
                    if (processed.parserFailed) {
                        state.parserFailureCount += 1;
                        state.error ??= {
                            code: 'PUBLIC_ARTICLE_INGESTION_FAILED',
                            message: 'A public article was cached but could not be fully processed',
                        };
                        continue;
                    }
                    if (processed.requestedRegionMatched !== true) {
                        state.regionMismatchCount += 1;
                        continue;
                    }
                    if (processed.document.relevant !== true) {
                        state.irrelevantCount += 1;
                        continue;
                    }
                    state.accepted.push(processed);
                    state.enrichmentAttemptedCount += 1;
                    if (typeof processed.sourceText !== 'string') {
                        state.enrichmentFailedCount += 1;
                    }
                    else {
                        const enrichment = await this.signalEnrichment.run({
                            sourceDocumentId: processed.document.sourceDocumentId,
                            sourceText: processed.sourceText,
                        });
                        if (enrichment.failed) {
                            state.enrichmentFailedCount += 1;
                        }
                        else if (enrichment.candidate !== null) {
                            state.signalCandidates.push(enrichment.candidate);
                            state.enrichmentCandidateCount += 1;
                        }
                    }
                    if (processed.sourceStatus !== 'healthy') {
                        state.error ??= {
                            code: 'PUBLIC_ARTICLE_INGESTION_FAILED',
                            message: 'A public article was cached but could not be fully processed',
                        };
                    }
                }
                catch (error) {
                    state.rejectedCount += 1;
                    state.error = normalizePublicError(error, 'PUBLIC_ARTICLE_INGESTION_FAILED', 'Public article ingestion failed');
                }
            }
            if (state.accepted.length === 0 && state.rejectedCount === 0) {
                state.error ??= { code: 'GDELT_NO_ALLOWED_ARTICLES', message: 'GDELT returned no allowed articles for the requested coverage' };
            }
        }
        catch (error) {
            state.sourceStatus = isRateLimited(error) ? 'rate_limited' : 'degraded';
            state.httpStatus = error instanceof safe_fetch_errors_1.SafeFetchError ? error.statusCode ?? null : null;
            state.error = normalizePublicError(error, isRateLimited(error) ? 'GDELT_RATE_LIMITED' : 'GDELT_INGESTION_FAILED', isRateLimited(error) ? 'GDELT source is rate limited' : 'GDELT ingestion failed');
        }
        const gdeltStatus = gdeltRunStatus(state);
        const finishedAt = this.clock.now();
        await this.repository.finalizeRun({
            id: runId,
            status: dbRunStatus(gdeltStatus),
            fetchedCount: state.fetchedCount,
            acceptedCount: state.accepted.length,
            rejectedCount: state.rejectedCount,
            errorCode: state.error?.code ?? null,
            errorMessage: state.error?.message ?? null,
            finishedAt,
            metadata: {
                ...requestMetadata(request),
                discoveredCount: state.discoveredCount,
                allowedCandidateCount: state.allowedCandidateCount,
                invalidCandidateCount: state.invalidCandidateCount,
                regionMismatchCount: state.regionMismatchCount,
                irrelevantCount: state.irrelevantCount,
                parserFailureCount: state.parserFailureCount,
                ...(state.queryHash ? { queryHash: state.queryHash } : {}),
                ...(state.cacheStatus ? { cacheStatus: state.cacheStatus } : {}),
                ...(state.sourceStatus ? { sourceStatus: state.sourceStatus } : {}),
                enrichmentAttemptedCount: state.enrichmentAttemptedCount,
                enrichmentCandidateCount: state.enrichmentCandidateCount,
                enrichmentFailedCount: state.enrichmentFailedCount,
            },
        });
        const gdeltCacheAvailable = state.accepted.length > 0 ||
            await this.repository.hasAcceptedPublicRun(enums_1.IngestionAdapter.GDELT);
        await this.finalizeGdeltHealth(state, finishedAt, runId, gdeltCacheAvailable);
        const direct = await this.runDirectFallback(request, gdeltCandidates, state.accepted);
        const documents = [...state.accepted.map((item) => item.document), ...direct.documents];
        const signalCandidates = [
            ...state.signalCandidates,
            ...direct.signalCandidates,
        ];
        return {
            status: topLevelStatus(gdeltStatus, direct.status, documents.length, direct.used),
            gdelt: {
                runId, status: gdeltStatus, sourceStatus: state.sourceStatus, cacheStatus: state.cacheStatus,
                discoveredCount: state.discoveredCount, allowedCandidateCount: state.allowedCandidateCount,
                acceptedCount: state.accepted.length, rejectedCount: state.rejectedCount,
            },
            directFallback: {
                used: direct.used, runId: direct.runId, status: direct.status,
                attemptedCount: direct.attemptedCount, acceptedCount: direct.documents.length,
                rejectedCount: direct.rejectedCount,
            },
            enrichment: {
                attemptedCount: state.enrichmentAttemptedCount +
                    direct.enrichmentAttemptedCount,
                candidateCount: state.enrichmentCandidateCount +
                    direct.enrichmentCandidateCount,
                failedCount: state.enrichmentFailedCount +
                    direct.enrichmentFailedCount,
            },
            signalCandidates,
            documents,
        };
    }
    async finalizeGdeltHealth(state, at, runId, cacheAvailable) {
        const baseInput = {
            at,
            lastHttpStatus: state.httpStatus,
            cacheAvailable,
            metadata: {
                lastRunId: runId,
                cacheStatus: state.cacheStatus ?? 'none',
                originFresh: state.cacheStatus === 'miss' &&
                    state.sourceStatus === 'healthy',
            },
        };
        if (state.sourceStatus === 'rate_limited') {
            await this.sourceHealth.markRateLimited('gdelt', {
                ...baseInput,
                success: state.responseUsable,
                error: state.error ?? {
                    code: 'GDELT_RATE_LIMITED',
                    message: 'GDELT source is rate limited',
                },
            });
            return;
        }
        const actualError = state.sourceStatus !== 'healthy' ||
            state.rejectedCount > 0 ||
            state.parserFailureCount > 0;
        const degraded = state.sourceStatus === 'degraded' ||
            state.rejectedCount > 0 ||
            state.parserFailureCount > 0 ||
            state.accepted.some((item) => item.sourceStatus !== 'healthy');
        if (actualError) {
            await this.sourceHealth.markFailure('gdelt', {
                ...baseInput,
                degraded: state.responseUsable,
                success: state.responseUsable,
                error: state.error ?? {
                    code: 'GDELT_INGESTION_FAILED',
                    message: 'GDELT ingestion failed',
                },
            });
            return;
        }
        await this.sourceHealth.markSuccess('gdelt', {
            ...baseInput,
            degraded,
            detail: state.error === null
                ? null
                : `${state.error.code}: ${state.error.message}`,
        });
    }
    async finalizeDirectHealth(input) {
        const baseInput = {
            at: input.at,
            lastHttpStatus: input.lastHttpStatus,
            cacheAvailable: input.cacheAvailable,
            metadata: {
                lastRunId: input.runId,
            },
        };
        if (input.status === 'rate_limited') {
            await this.sourceHealth.markRateLimited('direct-sources', {
                ...baseInput,
                success: input.success,
                error: input.error ?? {
                    code: 'DIRECT_SOURCE_RATE_LIMITED',
                    message: 'One or more direct public sources are rate limited',
                },
            });
            return;
        }
        if (input.actualError) {
            await this.sourceHealth.markFailure('direct-sources', {
                ...baseInput,
                degraded: input.status === 'partial',
                success: input.success,
                error: input.error ?? {
                    code: 'DIRECT_SOURCE_INGESTION_FAILED',
                    message: 'One or more direct public sources could not be fully processed',
                },
            });
            return;
        }
        await this.sourceHealth.markSuccess('direct-sources', baseInput);
    }
    async runDirectFallback(request, gdeltCandidates, accepted) {
        if (!request.includeDirectFallback || accepted.length >= request.maxArticles) {
            return {
                used: false,
                runId: null,
                status: null,
                attemptedCount: 0,
                rejectedCount: 0,
                enrichmentAttemptedCount: 0,
                enrichmentCandidateCount: 0,
                enrichmentFailedCount: 0,
                signalCandidates: [],
                documents: [],
            };
        }
        const excluded = new Set(gdeltCandidates.map((candidate) => (0, article_url_1.canonicalizeArticleUrl)(new URL(candidate.originalUrl))));
        const candidates = this.directAdapter.candidates(request, request.maxArticles - accepted.length, excluded);
        if (candidates.length === 0) {
            return {
                used: false,
                runId: null,
                status: null,
                attemptedCount: 0,
                rejectedCount: 0,
                enrichmentAttemptedCount: 0,
                enrichmentCandidateCount: 0,
                enrichmentFailedCount: 0,
                signalCandidates: [],
                documents: [],
            };
        }
        const runId = (0, node_crypto_1.randomUUID)();
        const startedAt = this.clock.now();
        await this.repository.createPublicRun({
            id: runId, adapter: enums_1.IngestionAdapter.DIRECT_SOURCE,
            metadata: { ...requestMetadata(request), candidateCount: candidates.length },
        });
        await this.sourceHealth.startAttempt('direct-sources', startedAt);
        const result = await this.directSources.process(candidates, runId, {
            from: request.from,
            to: request.to,
        });
        const parserFailures = result.parserFailureCount;
        const degraded = result.degradedCount > 0;
        const actualError = result.rejectedCount > 0 || parserFailures > 0 || degraded;
        const status = directRunStatus(result.accepted.length, result.rejectedCount, result.rateLimitedCount, actualError, result.temporalMismatchCount + result.temporalUnknownCount > 0);
        const finishedAt = this.clock.now();
        const error = actualError
            ? { code: 'DIRECT_SOURCE_INGESTION_FAILED', message: 'One or more direct public sources could not be fully processed' }
            : null;
        await this.repository.finalizeRun({
            id: runId, status: dbRunStatus(status), fetchedCount: result.successfulFetchCount,
            acceptedCount: result.accepted.length, rejectedCount: result.rejectedCount,
            errorCode: error?.code ?? null, errorMessage: error?.message ?? null,
            finishedAt,
            metadata: {
                ...requestMetadata(request), candidateCount: candidates.length,
                parserFailures, regionMismatchCount: result.regionMismatchCount,
                irrelevantCount: result.irrelevantCount,
                temporalMismatchCount: result.temporalMismatchCount,
                temporalUnknownCount: result.temporalUnknownCount,
                enrichmentAttemptedCount: result.enrichmentAttemptedCount,
                enrichmentCandidateCount: result.enrichmentCandidateCount,
                enrichmentFailedCount: result.enrichmentFailedCount,
            },
        });
        const cacheAvailable = result.accepted.length > 0 ||
            await this.repository.hasAcceptedPublicRun(enums_1.IngestionAdapter.DIRECT_SOURCE);
        await this.finalizeDirectHealth({
            status,
            at: finishedAt,
            runId,
            lastHttpStatus: result.lastHttpStatus,
            cacheAvailable,
            actualError,
            success: result.successfulFetchCount > 0,
            error,
        });
        return {
            used: true,
            runId,
            status,
            attemptedCount: candidates.length,
            rejectedCount: result.rejectedCount,
            enrichmentAttemptedCount: result.enrichmentAttemptedCount,
            enrichmentCandidateCount: result.enrichmentCandidateCount,
            enrichmentFailedCount: result.enrichmentFailedCount,
            signalCandidates: result.signalCandidates,
            documents: result.accepted.map((item) => item.document),
        };
    }
};
exports.GdeltIngestionService = GdeltIngestionService;
exports.GdeltIngestionService = GdeltIngestionService = __decorate([
    (0, common_1.Injectable)(),
    __param(8, (0, common_1.Inject)(ingestion_constants_1.INGESTION_CLOCK)),
    __metadata("design:paramtypes", [gdelt_adapter_1.GdeltAdapter,
        direct_source_adapter_1.DirectSourceAdapter,
        direct_source_service_1.DirectSourceService,
        article_ingestion_service_1.ArticleIngestionService,
        article_signal_enrichment_runner_service_1.ArticleSignalEnrichmentRunner,
        source_health_service_1.SourceHealthService,
        ingestion_repository_1.IngestionRepository,
        config_1.ConfigService, Object])
], GdeltIngestionService);
function normalizeGdeltRequest(dto, limits) {
    if (!strictZulu(dto.from) || !strictZulu(dto.to))
        throw invalidRequest();
    const from = new Date(dto.from);
    const to = new Date(dto.to);
    const maxRecords = dto.maxRecords ?? limits.maxRecords;
    const maxArticles = dto.maxArticles ?? Math.min(3, limits.maxArticles, maxRecords);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to ||
        to.getTime() - from.getTime() > limits.maxWindowDays * 86_400_000 ||
        to.getTime() > limits.now.getTime() + 5 * 60_000 ||
        dto.regions.length === 0 || new Set(dto.regions).size !== dto.regions.length ||
        maxRecords < 1 || maxRecords > Math.min(25, limits.maxRecords) ||
        maxArticles < 1 || maxArticles > limits.maxArticles || maxArticles > maxRecords)
        throw invalidRequest();
    return {
        from, to, regions: [...dto.regions], maxRecords, maxArticles,
        includeDirectFallback: dto.includeDirectFallback ?? true,
    };
}
function strictZulu(value) {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
        new Date(value).toISOString().startsWith(value.slice(0, 19));
}
function invalidRequest() {
    return new common_1.BadRequestException({ code: 'GDELT_REQUEST_INVALID', message: 'GDELT ingestion request is invalid' });
}
function requestMetadata(request) {
    return {
        from: request.from.toISOString(), to: request.to.toISOString(), regions: request.regions,
        maxRecords: request.maxRecords, maxArticles: request.maxArticles,
        includeDirectFallback: request.includeDirectFallback,
    };
}
function normalizePublicError(error, code, message) {
    if (error instanceof ingestion_errors_1.PublicIngestionError)
        return { code: error.code, message: error.safeMessage };
    if (error instanceof safe_fetch_errors_1.SafeFetchError && error.sourceStatus === 'rate_limited') {
        return { code: 'GDELT_RATE_LIMITED', message: 'GDELT source is rate limited' };
    }
    return { code, message };
}
function isRateLimited(error) {
    return (error instanceof safe_fetch_errors_1.SafeFetchError && error.sourceStatus === 'rate_limited') ||
        (error instanceof ingestion_errors_1.PublicIngestionError && error.rateLimited);
}
function safeGdeltSourceError(status) {
    return status === 'rate_limited'
        ? { code: 'GDELT_RATE_LIMITED', message: 'GDELT source is rate limited; cached response was used' }
        : { code: 'GDELT_INGESTION_FAILED', message: 'GDELT source is degraded; cached response was used' };
}
function gdeltRunStatus(state) {
    if (state.sourceStatus === 'rate_limited') {
        return 'rate_limited';
    }
    if (state.accepted.length > 0 &&
        state.sourceStatus === 'healthy' &&
        state.rejectedCount === 0 &&
        state.parserFailureCount === 0 &&
        !state.accepted.some((item) => item.sourceStatus !== 'healthy')) {
        return 'succeeded';
    }
    if (state.accepted.length > 0) {
        return 'partial';
    }
    return 'failed';
}
function directRunStatus(accepted, rejected, rateLimited, actualError, temporalExclusions) {
    if (accepted > 0)
        return actualError || temporalExclusions ? 'partial' : 'succeeded';
    if (rejected > 0 && rateLimited === rejected)
        return 'rate_limited';
    return 'failed';
}
function dbRunStatus(status) {
    return {
        succeeded: enums_1.IngestionRunStatus.SUCCEEDED,
        partial: enums_1.IngestionRunStatus.PARTIAL,
        failed: enums_1.IngestionRunStatus.FAILED,
        rate_limited: enums_1.IngestionRunStatus.RATE_LIMITED,
    }[status];
}
function topLevelStatus(gdelt, direct, accepted, directUsed) {
    if (gdelt === 'succeeded' && !directUsed)
        return 'succeeded';
    if (accepted > 0)
        return 'partial';
    if (gdelt === 'rate_limited' || direct === 'rate_limited')
        return 'rate_limited';
    return 'failed';
}
//# sourceMappingURL=gdelt-ingestion.service.js.map