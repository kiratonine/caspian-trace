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
exports.GdeltAdapter = void 0;
exports.boundedCandidates = boundedCandidates;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const safe_fetch_service_1 = require("../../common/http/safe-fetch/safe-fetch.service");
const safe_fetch_errors_1 = require("../../common/http/safe-fetch/safe-fetch.errors");
const article_url_1 = require("../article/article-url");
const direct_source_registry_1 = require("../direct-sources/direct-source-registry");
const ingestion_errors_1 = require("../ingestion.errors");
const gdelt_query_1 = require("./gdelt-query");
const gdelt_schemas_1 = require("./gdelt.schemas");
let GdeltAdapter = class GdeltAdapter {
    safeFetch;
    endpoint;
    gdeltHosts;
    directHosts;
    cacheTtlMs;
    staleIfErrorMs;
    httpMaxBytes;
    httpTimeoutMs;
    perDomainLimit;
    constructor(safeFetch, config) {
        this.safeFetch = safeFetch;
        this.endpoint = config.getOrThrow('GDELT_ENDPOINT_URL');
        this.gdeltHosts = config.getOrThrow('GDELT_ALLOWED_HOSTS');
        this.directHosts = config.getOrThrow('DIRECT_SOURCE_ALLOWED_HOSTS');
        this.cacheTtlMs = config.getOrThrow('GDELT_CACHE_TTL_SECONDS') * 1_000;
        this.staleIfErrorMs = config.getOrThrow('GDELT_STALE_IF_ERROR_SECONDS') * 1_000;
        this.httpMaxBytes = config.getOrThrow('HTTP_MAX_BYTES');
        this.httpTimeoutMs = config.getOrThrow('HTTP_TIMEOUT_MS');
        this.perDomainLimit = config.getOrThrow('DIRECT_SOURCE_MAX_ARTICLES_PER_DOMAIN');
    }
    async discover(request) {
        const url = (0, gdelt_query_1.buildGdeltQuery)({
            endpoint: this.endpoint,
            from: request.from,
            to: request.to,
            regions: request.regions,
            maxRecords: request.maxRecords,
        });
        let response;
        try {
            response = await this.safeFetch.fetchJson(url, gdelt_schemas_1.GdeltResponseSchema, {
                allowedHosts: this.gdeltHosts,
                expectedContentTypes: ['application/json'],
                maxBytes: Math.min(2 * 1024 * 1024, this.httpMaxBytes),
                timeoutMs: Math.min(10_000, this.httpTimeoutMs),
                cache: { enabled: true, ttlMs: this.cacheTtlMs, staleIfErrorMs: this.staleIfErrorMs },
            });
        }
        catch (error) {
            if (error instanceof safe_fetch_errors_1.SafeFetchError &&
                (error.code === 'SAFE_FETCH_JSON_INVALID' ||
                    error.code === 'SAFE_FETCH_RESPONSE_SCHEMA_INVALID')) {
                throw (0, ingestion_errors_1.publicIngestionError)('GDELT_RESPONSE_INVALID', 'GDELT response does not match the expected schema');
            }
            throw error;
        }
        let invalidCandidateCount = 0;
        const mapped = [];
        for (const raw of response.data.articles.slice(0, request.maxRecords)) {
            const parsed = gdelt_schemas_1.GdeltArticleSchema.safeParse(raw);
            if (!parsed.success) {
                invalidCandidateCount += 1;
                continue;
            }
            const candidate = mapArticle(parsed.data, request);
            if (!candidate || !this.directHosts.includes(candidate.publisherHost)) {
                invalidCandidateCount += 1;
                continue;
            }
            mapped.push({ candidate, seen: seenTimestamp(parsed.data.seendate) });
        }
        mapped.sort((left, right) => right.seen - left.seen ||
            (left.candidate.discoveryTitle ?? '').localeCompare(right.candidate.discoveryTitle ?? '') ||
            left.candidate.originalUrl.localeCompare(right.candidate.originalUrl));
        const candidates = boundedCandidates(mapped.map(({ candidate }) => candidate), request.maxArticles, this.perDomainLimit);
        return {
            candidates,
            discoveredCount: response.data.articles.length,
            invalidCandidateCount,
            metadata: response.metadata,
            queryHash: (0, node_crypto_1.createHash)('sha256').update(url.searchParams.get('query') ?? '').digest('hex'),
        };
    }
};
exports.GdeltAdapter = GdeltAdapter;
exports.GdeltAdapter = GdeltAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [safe_fetch_service_1.SafeFetchService,
        config_1.ConfigService])
], GdeltAdapter);
function mapArticle(article, request) {
    const url = (0, article_url_1.parsePublicArticleUrl)(article.url);
    if (!url)
        return null;
    const source = (0, direct_source_registry_1.findDirectSource)(url.hostname);
    if (!source || !source.requestRegions.some((region) => request.regions.includes(region)))
        return null;
    const requestedRegions = request.regions.filter((region) => source.requestRegions.includes(region));
    const title = article.title?.replace(/\s+/g, ' ').trim() ?? '';
    return {
        discoveryMode: 'gdelt',
        originalUrl: url.toString(),
        discoveryTitle: title.length > 0 && title.length <= 500 ? title : null,
        gdeltSeenAt: typeof article.seendate === 'string' && article.seendate.length <= 64 ? article.seendate : null,
        gdeltLanguage: boundedMetadata(article.language),
        gdeltSourceCountry: boundedMetadata(article.sourcecountry),
        requestedRegions,
        publisherHost: url.hostname,
        coverage: source.coverage,
    };
}
function boundedCandidates(candidates, maximum, perDomainLimit, excluded = new Set()) {
    const result = [];
    const seen = new Set(excluded);
    const domains = new Map();
    for (const candidate of candidates) {
        const canonical = (0, article_url_1.canonicalizeArticleUrl)(new URL(candidate.originalUrl));
        if (seen.has(canonical))
            continue;
        const count = domains.get(candidate.publisherHost) ?? 0;
        if (count >= perDomainLimit)
            continue;
        seen.add(canonical);
        domains.set(candidate.publisherHost, count + 1);
        result.push(candidate);
        if (result.length === maximum)
            break;
    }
    return result;
}
function boundedMetadata(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 100 ? value : null;
}
function seenTimestamp(value) {
    if (!value)
        return Number.NEGATIVE_INFINITY;
    const gdelt = /^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/.exec(value);
    if (gdelt)
        return Date.UTC(Number(gdelt[1]), Number(gdelt[2]) - 1, Number(gdelt[3]), Number(gdelt[4]), Number(gdelt[5]), Number(gdelt[6]));
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}
//# sourceMappingURL=gdelt.adapter.js.map