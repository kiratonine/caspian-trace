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
exports.ArticleIngestionService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const safe_fetch_service_1 = require("../../common/http/safe-fetch/safe-fetch.service");
const sources_service_1 = require("../../sources/sources.service");
const direct_source_registry_1 = require("../direct-sources/direct-source-registry");
const ingestion_constants_1 = require("../ingestion.constants");
const ingestion_errors_1 = require("../ingestion.errors");
const ingestion_repository_1 = require("../ingestion.repository");
const article_document_identity_1 = require("./article-document-identity");
const article_url_1 = require("./article-url");
const article_text_service_1 = require("./article-text.service");
let ArticleIngestionService = class ArticleIngestionService {
    safeFetch;
    sources;
    repository;
    articleText;
    clock;
    allowedHosts;
    maximumBytes;
    timeoutMs;
    constructor(safeFetch, sources, repository, articleText, config, clock) {
        this.safeFetch = safeFetch;
        this.sources = sources;
        this.repository = repository;
        this.articleText = articleText;
        this.clock = clock;
        this.allowedHosts = config.getOrThrow('DIRECT_SOURCE_ALLOWED_HOSTS');
        this.maximumBytes = config.getOrThrow('DIRECT_SOURCE_HTML_MAX_BYTES');
        this.timeoutMs = Math.min(10_000, config.getOrThrow('HTTP_TIMEOUT_MS'));
    }
    async process(candidate, runId) {
        const fetched = await this.safeFetch.fetchBuffer(new URL(candidate.originalUrl), {
            allowedHosts: this.allowedHosts,
            expectedContentTypes: ['text/html'],
            maxBytes: this.maximumBytes,
            timeoutMs: this.timeoutMs,
            cache: { enabled: true, ttlMs: 15 * 60 * 1_000, staleIfErrorMs: 24 * 60 * 60 * 1_000 },
        });
        if (fetched.body.length === 0) {
            throw (0, ingestion_errors_1.publicIngestionError)('PUBLIC_ARTICLE_TEXT_EMPTY', 'Public article response is empty');
        }
        const finalUrl = new URL(fetched.metadata.finalUrl);
        const source = (0, direct_source_registry_1.findDirectSource)(finalUrl.hostname);
        if (!source || !this.allowedHosts.includes(finalUrl.hostname)) {
            throw (0, ingestion_errors_1.publicIngestionError)('DIRECT_SOURCE_HOST_NOT_ALLOWED', 'Public article host is not allowed');
        }
        if (!source.requestRegions.some((region) => candidate.requestedRegions.includes(region))) {
            throw (0, ingestion_errors_1.publicIngestionError)('DIRECT_SOURCE_REGION_MISMATCH', 'Public article does not cover the requested region');
        }
        const canonicalUrl = (0, article_url_1.canonicalizeArticleUrl)(finalUrl);
        const sha256 = (0, node_crypto_1.createHash)('sha256').update(fetched.body).digest('hex');
        const identity = (0, article_document_identity_1.buildArticleIdentity)({ candidate, source, canonicalUrl, sha256, runId });
        const initial = await this.repository.ensureArticleDocument(identity);
        const cached = await this.sources.cacheExistingSourceSnapshot({
            sourceDocumentId: initial.id,
            bytes: fetched.body,
            mediaType: 'text/html',
            fetchedAt: new Date(fetched.metadata.fetchedAt),
            httpStatus: fetched.metadata.statusCode,
        });
        if (cached.sha256 !== sha256) {
            throw (0, ingestion_errors_1.publicIngestionError)('PUBLIC_ARTICLE_SOURCE_CONFLICT', 'Cached public article hash does not match source identity');
        }
        let extraction;
        try {
            extraction = this.articleText.extract(fetched.body, candidate.discoveryTitle, candidate.requestedRegions, this.clock.now());
        }
        catch {
            await this.repository.markArticleParserFailure(initial.id, this.clock.now());
            return {
                document: {
                    sourceDocumentId: initial.id,
                    discoveryMode: candidate.discoveryMode,
                    publisher: initial.publisher,
                    title: initial.title,
                    canonicalUrl: initial.canonicalUrl,
                    publishedAt: initial.publishedAt?.toISOString() ?? null,
                    sha256,
                    cachePath: cached.cachePath,
                    parserStatus: 'failed',
                    relevant: null,
                    matchedRequestedRegions: null,
                    coverage: source.coverage,
                },
                sourceText: null,
                parserFailed: true,
                requestedRegionMatched: null,
                sourceStatus: fetched.metadata.sourceStatus,
                cacheStatus: fetched.metadata.cacheStatus,
                httpStatus: fetched.metadata.statusCode,
            };
        }
        const persisted = await this.repository.persistArticleExtraction({
            sourceDocumentId: initial.id,
            extraction,
            parsedAt: this.clock.now(),
        });
        return {
            document: {
                sourceDocumentId: persisted.id,
                discoveryMode: candidate.discoveryMode,
                publisher: persisted.publisher,
                title: persisted.title,
                canonicalUrl: persisted.canonicalUrl,
                publishedAt: persisted.publishedAt?.toISOString() ?? null,
                sha256,
                cachePath: cached.cachePath,
                parserStatus: 'succeeded',
                relevant: extraction.relevant,
                matchedRequestedRegions: extraction.matchedRequestedRegions,
                coverage: source.coverage,
            },
            sourceText: extraction.text,
            parserFailed: false,
            requestedRegionMatched: extraction.matchedRequestedRegions.length > 0,
            sourceStatus: fetched.metadata.sourceStatus,
            cacheStatus: fetched.metadata.cacheStatus,
            httpStatus: fetched.metadata.statusCode,
        };
    }
};
exports.ArticleIngestionService = ArticleIngestionService;
exports.ArticleIngestionService = ArticleIngestionService = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_1.Inject)(ingestion_constants_1.INGESTION_CLOCK)),
    __metadata("design:paramtypes", [safe_fetch_service_1.SafeFetchService,
        sources_service_1.SourcesService,
        ingestion_repository_1.IngestionRepository,
        article_text_service_1.ArticleTextService,
        config_1.ConfigService, Object])
], ArticleIngestionService);
//# sourceMappingURL=article-ingestion.service.js.map