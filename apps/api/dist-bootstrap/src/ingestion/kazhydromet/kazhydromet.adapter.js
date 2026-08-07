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
exports.KazhydrometAdapter = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const safe_fetch_service_1 = require("../../common/http/safe-fetch/safe-fetch.service");
const ingestion_errors_1 = require("../ingestion.errors");
const kazhydromet_discovery_1 = require("./kazhydromet-discovery");
let KazhydrometAdapter = class KazhydrometAdapter {
    safeFetch;
    listingUrl;
    allowedHosts;
    timeoutMs;
    maxBytes;
    constructor(safeFetch, config) {
        this.safeFetch = safeFetch;
        this.listingUrl = config.getOrThrow('KAZHYDROMET_BULLETINS_URL');
        this.allowedHosts = config.getOrThrow('KAZHYDROMET_ALLOWED_HOSTS');
        this.timeoutMs = config.getOrThrow('HTTP_TIMEOUT_MS');
        this.maxBytes = config.getOrThrow('HTTP_MAX_BYTES');
    }
    async discover(request) {
        const listingUrls = [new URL(this.listingUrl), ...requestedYearUrls(this.listingUrl, request)];
        const candidates = new Map();
        let lastMetadata;
        let worstStatus = 'healthy';
        let firstError;
        for (const listingUrl of listingUrls) {
            try {
                const result = await this.fetchListing(listingUrl);
                lastMetadata = result.metadata;
                worstStatus = worseSourceStatus(worstStatus, result.metadata.sourceStatus);
                for (const candidate of (0, kazhydromet_discovery_1.discoverPdfCandidates)({
                    html: result.text,
                    listingFinalUrl: result.metadata.finalUrl,
                    allowedHosts: this.allowedHosts,
                    request: { ...request, maxDocuments: 10 },
                }))
                    candidates.set(candidate.canonicalUrl, candidate);
            }
            catch (error) {
                firstError ??= error;
                worstStatus = worseSourceStatus(worstStatus, 'degraded');
            }
        }
        if (!lastMetadata)
            throw firstError;
        return {
            candidates: [...candidates.values()]
                .sort((left, right) => (left.publishedPeriod ?? '').localeCompare(right.publishedPeriod ?? '') ||
                (left.regions[0] ?? '').localeCompare(right.regions[0] ?? '') ||
                right.confidence - left.confidence ||
                left.canonicalUrl.localeCompare(right.canonicalUrl))
                .slice(0, request.maxDocuments),
            metadata: { ...lastMetadata, sourceStatus: worstStatus },
        };
    }
    fetchListing(url) {
        return this.safeFetch.fetchText(url, {
            allowedHosts: this.allowedHosts,
            expectedContentTypes: ['text/html'],
            maxBytes: 2 * 1024 * 1024,
            timeoutMs: Math.min(10_000, this.timeoutMs),
            cache: { enabled: true, ttlMs: 15 * 60 * 1000, staleIfErrorMs: 6 * 60 * 60 * 1000 },
        });
    }
    async fetch(candidate) {
        const result = await this.safeFetch.fetchBuffer(new URL(candidate.canonicalUrl), {
            allowedHosts: this.allowedHosts,
            expectedContentTypes: ['application/pdf'],
            maxBytes: this.maxBytes,
            timeoutMs: Math.min(12_000, this.timeoutMs),
            cache: { enabled: false, ttlMs: 1, staleIfErrorMs: 0 },
        });
        if (!result.body.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
            throw (0, ingestion_errors_1.kazhydrometError)('KAZHYDROMET_PDF_INVALID', 'Kazhydromet response is not a PDF');
        }
        const finalUrl = new URL(result.metadata.finalUrl);
        finalUrl.hash = '';
        return {
            candidate,
            bytes: Buffer.from(result.body),
            fetchedAt: new Date(result.metadata.fetchedAt),
            httpStatus: result.metadata.statusCode,
            finalUrl: finalUrl.toString(),
            sha256: (0, node_crypto_1.createHash)('sha256').update(result.body).digest('hex'),
            sourceStatus: result.metadata.sourceStatus,
        };
    }
};
exports.KazhydrometAdapter = KazhydrometAdapter;
exports.KazhydrometAdapter = KazhydrometAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [safe_fetch_service_1.SafeFetchService,
        config_1.ConfigService])
], KazhydrometAdapter);
function requestedYearUrls(configuredUrl, request) {
    const firstYear = Number(request.from.slice(0, 4));
    const lastYear = Number(request.to.slice(0, 4));
    const base = new URL(configuredUrl);
    base.pathname = base.pathname.replace(/\/(?:20\d{2})\/?$/u, '').replace(/\/$/u, '');
    return Array.from({ length: lastYear - firstYear + 1 }, (_value, index) => {
        const url = new URL(base);
        url.pathname = `${base.pathname}/${firstYear + index}`;
        return url;
    });
}
function worseSourceStatus(left, right) {
    const rank = { healthy: 0, degraded: 1, rate_limited: 2 };
    return rank[right] > rank[left] ? right : left;
}
//# sourceMappingURL=kazhydromet.adapter.js.map