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
exports.IngestionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const run_kazhydromet_ingestion_dto_1 = require("./dto/run-kazhydromet-ingestion.dto");
const run_gdelt_ingestion_dto_1 = require("./dto/run-gdelt-ingestion.dto");
const ingestion_token_guard_1 = require("./ingestion-token.guard");
const kazhydromet_ingestion_service_1 = require("./kazhydromet/kazhydromet-ingestion.service");
const gdelt_ingestion_service_1 = require("./gdelt/gdelt-ingestion.service");
let IngestionController = class IngestionController {
    kazhydromet;
    gdelt;
    constructor(kazhydromet, gdelt) {
        this.kazhydromet = kazhydromet;
        this.gdelt = gdelt;
    }
    runKazhydromet(dto) {
        return this.kazhydromet.run(dto);
    }
    runGdelt(dto) {
        return this.gdelt.run(dto);
    }
};
exports.IngestionController = IngestionController;
__decorate([
    (0, common_1.Post)('kazhydromet'),
    (0, common_1.HttpCode)(200),
    (0, common_1.UseGuards)(ingestion_token_guard_1.IngestionTokenGuard),
    (0, swagger_1.ApiOperation)({
        summary: 'Discover and cache Kazhydromet bulletins (internal admin)',
        description: 'Extracted values remain unverified candidates and are never written as measurements.',
    }),
    (0, swagger_1.ApiHeader)({ name: 'X-Ingestion-Token', required: true }),
    (0, swagger_1.ApiOkResponse)({
        schema: {
            type: 'object',
            required: ['runId', 'status', 'discoveredCount', 'fetchedCount', 'cachedCount', 'pageCount', 'validatedCandidateCount', 'rejectedCandidateCount', 'documents'],
            properties: {
                runId: { type: 'string', format: 'uuid' },
                status: { type: 'string', enum: ['succeeded', 'partial', 'failed', 'rate_limited'] },
                discoveredCount: { type: 'integer', minimum: 0 },
                fetchedCount: { type: 'integer', minimum: 0 },
                cachedCount: { type: 'integer', minimum: 0 },
                pageCount: { type: 'integer', minimum: 0 },
                validatedCandidateCount: { type: 'integer', minimum: 0 },
                rejectedCandidateCount: { type: 'integer', minimum: 0 },
                documents: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            sourceDocumentId: { type: 'string' },
                            period: { type: 'string', nullable: true },
                            regions: { type: 'array', items: { type: 'string', enum: ['atyrau', 'mangystau'] } },
                            sha256: { type: 'string' },
                            cachePath: { type: 'string' },
                            pageCount: { type: 'integer' },
                            relevantPageNumbers: { type: 'array', items: { type: 'integer' } },
                            validatedCandidateCount: { type: 'integer' },
                            parserStatus: { type: 'string', enum: ['succeeded', 'partial', 'failed'] },
                        },
                    },
                },
            },
        },
    }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid period, region, range, or limit' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Invalid ingestion credentials' }),
    (0, swagger_1.ApiServiceUnavailableResponse)({ description: 'Controlled upstream or storage failure' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [run_kazhydromet_ingestion_dto_1.RunKazhydrometIngestionDto]),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "runKazhydromet", null);
__decorate([
    (0, common_1.Post)('gdelt'),
    (0, common_1.HttpCode)(200),
    (0, common_1.UseGuards)(ingestion_token_guard_1.IngestionTokenGuard),
    (0, swagger_1.ApiOperation)({
        summary: 'Cache bounded public articles from fixed GDELT/direct sources (internal admin)',
        description: 'Raw snapshots remain unverified. Optional transient signal candidates may be returned, but no incident signals are created.',
    }),
    (0, swagger_1.ApiHeader)({ name: 'X-Ingestion-Token', required: true }),
    (0, swagger_1.ApiOkResponse)({
        description: 'GDELT/direct ingestion result with immutable article provenance',
        schema: {
            type: 'object',
            required: ['status', 'gdelt', 'directFallback', 'documents', 'enrichment', 'signalCandidates',],
            properties: {
                status: { type: 'string', enum: ['succeeded', 'partial', 'failed', 'rate_limited'] },
                gdelt: {
                    type: 'object',
                    required: ['runId', 'status', 'sourceStatus', 'cacheStatus', 'discoveredCount', 'allowedCandidateCount', 'acceptedCount', 'rejectedCount'],
                    properties: {
                        runId: { type: 'string', format: 'uuid' },
                        status: { type: 'string', enum: ['succeeded', 'partial', 'failed', 'rate_limited'] },
                        sourceStatus: { type: 'string', enum: ['healthy', 'degraded', 'rate_limited'], nullable: true },
                        cacheStatus: { type: 'string', enum: ['miss', 'fresh', 'stale'], nullable: true },
                        discoveredCount: { type: 'integer', minimum: 0 },
                        allowedCandidateCount: { type: 'integer', minimum: 0 },
                        acceptedCount: { type: 'integer', minimum: 0 },
                        rejectedCount: { type: 'integer', minimum: 0 },
                    },
                },
                directFallback: {
                    type: 'object',
                    required: ['used', 'runId', 'status', 'attemptedCount', 'acceptedCount', 'rejectedCount'],
                    properties: {
                        used: { type: 'boolean' },
                        runId: { type: 'string', format: 'uuid', nullable: true },
                        status: { type: 'string', enum: ['succeeded', 'partial', 'failed', 'rate_limited'], nullable: true },
                        attemptedCount: { type: 'integer', minimum: 0 },
                        acceptedCount: { type: 'integer', minimum: 0 },
                        rejectedCount: { type: 'integer', minimum: 0 },
                    },
                },
                enrichment: {
                    type: 'object',
                    required: [
                        'attemptedCount',
                        'candidateCount',
                        'failedCount',
                    ],
                    properties: {
                        attemptedCount: {
                            type: 'integer',
                            minimum: 0,
                        },
                        candidateCount: {
                            type: 'integer',
                            minimum: 0,
                        },
                        failedCount: {
                            type: 'integer',
                            minimum: 0,
                        },
                    },
                },
                signalCandidates: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: [
                            'sourceDocumentId',
                            'extractionMode',
                            'verificationStatus',
                            'signal',
                        ],
                        properties: {
                            sourceDocumentId: {
                                type: 'string',
                            },
                            extractionMode: {
                                type: 'string',
                                enum: ['llm_candidate'],
                            },
                            verificationStatus: {
                                type: 'string',
                                enum: ['unverified'],
                            },
                            signal: {
                                type: 'object',
                                required: [
                                    'observedAt',
                                    'observedPeriod',
                                    'locationText',
                                    'phenomenon',
                                    'excerpt',
                                    'evidenceQuotes',
                                    'confidence',
                                ],
                                properties: {
                                    observedAt: {
                                        type: 'string',
                                        format: 'date-time',
                                        nullable: true,
                                    },
                                    observedPeriod: {
                                        type: 'string',
                                        pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
                                        nullable: true,
                                    },
                                    locationText: {
                                        type: 'string',
                                    },
                                    phenomenon: {
                                        type: 'string',
                                        enum: [
                                            'oil_film',
                                            'color_change',
                                            'odor',
                                            'fish_kill',
                                            'wastewater',
                                            'other',
                                        ],
                                    },
                                    excerpt: {
                                        type: 'string',
                                    },
                                    evidenceQuotes: {
                                        type: 'array',
                                        minItems: 1,
                                        maxItems: 3,
                                        items: {
                                            type: 'string',
                                        },
                                    },
                                    confidence: {
                                        type: 'number',
                                        minimum: 0,
                                        maximum: 1,
                                    },
                                },
                            },
                        },
                    },
                },
                documents: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['sourceDocumentId', 'discoveryMode', 'publisher', 'title', 'canonicalUrl', 'publishedAt', 'sha256', 'cachePath', 'parserStatus', 'relevant', 'matchedRequestedRegions', 'coverage'],
                        properties: {
                            sourceDocumentId: { type: 'string' },
                            discoveryMode: { type: 'string', enum: ['gdelt', 'direct_fallback'] },
                            publisher: { type: 'string' },
                            title: { type: 'string' },
                            canonicalUrl: { type: 'string', format: 'uri' },
                            publishedAt: { type: 'string', format: 'date-time', nullable: true },
                            sha256: { type: 'string' },
                            cachePath: { type: 'string' },
                            parserStatus: { type: 'string', enum: ['succeeded', 'failed'] },
                            relevant: { type: 'boolean', nullable: true },
                            matchedRequestedRegions: {
                                type: 'array', nullable: true,
                                items: { type: 'string', enum: ['atyrau', 'mangystau'] },
                            },
                            coverage: { type: 'array', items: { type: 'string' } },
                        },
                    },
                },
            },
        },
    }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid fixed-window ingestion request' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Invalid ingestion credentials' }),
    (0, swagger_1.ApiServiceUnavailableResponse)({ description: 'Controlled upstream or storage failure' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [run_gdelt_ingestion_dto_1.RunGdeltIngestionDto]),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "runGdelt", null);
exports.IngestionController = IngestionController = __decorate([
    (0, swagger_1.ApiTags)('admin ingestion'),
    (0, common_1.Controller)('admin/ingestion'),
    __metadata("design:paramtypes", [kazhydromet_ingestion_service_1.KazhydrometIngestionService,
        gdelt_ingestion_service_1.GdeltIngestionService])
], IngestionController);
//# sourceMappingURL=ingestion.controller.js.map