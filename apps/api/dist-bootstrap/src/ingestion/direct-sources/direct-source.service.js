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
exports.DirectSourceService = void 0;
const common_1 = require("@nestjs/common");
const article_ingestion_service_1 = require("../article/article-ingestion.service");
const article_signal_enrichment_runner_service_1 = require("../article/article-signal-enrichment-runner.service");
let DirectSourceService = class DirectSourceService {
    articles;
    signalEnrichment;
    constructor(articles, signalEnrichment) {
        this.articles = articles;
        this.signalEnrichment = signalEnrichment;
    }
    async process(candidates, runId, window) {
        const accepted = [];
        const signalCandidates = [];
        let enrichmentAttemptedCount = 0;
        let enrichmentCandidateCount = 0;
        let enrichmentFailedCount = 0;
        let rejectedCount = 0;
        let rateLimitedCount = 0;
        let regionMismatchCount = 0;
        let irrelevantCount = 0;
        let temporalMismatchCount = 0;
        let temporalUnknownCount = 0;
        let parserFailureCount = 0;
        let degradedCount = 0;
        let successfulFetchCount = 0;
        let lastHttpStatus = null;
        for (const candidate of candidates) {
            try {
                const processed = await this.articles.process(candidate, runId);
                successfulFetchCount += 1;
                lastHttpStatus = processed.httpStatus;
                if (processed.sourceStatus !== 'healthy') {
                    degradedCount += 1;
                }
                if (processed.parserFailed) {
                    parserFailureCount += 1;
                    continue;
                }
                const temporalMatch = classifyPublicationTime(processed.document.publishedAt, window);
                if (temporalMatch === 'mismatch') {
                    temporalMismatchCount += 1;
                }
                if (temporalMatch === 'unknown') {
                    temporalUnknownCount += 1;
                }
                if (processed.requestedRegionMatched !== true) {
                    regionMismatchCount += 1;
                    continue;
                }
                if (processed.document.relevant !== true) {
                    irrelevantCount += 1;
                    continue;
                }
                if (temporalMatch !== 'matched') {
                    continue;
                }
                accepted.push(processed);
                enrichmentAttemptedCount += 1;
                if (typeof processed.sourceText !== 'string') {
                    enrichmentFailedCount += 1;
                    continue;
                }
                const enrichment = await this.signalEnrichment.run({
                    sourceDocumentId: processed.document.sourceDocumentId,
                    sourceText: processed.sourceText,
                });
                if (enrichment.failed) {
                    enrichmentFailedCount += 1;
                }
                else if (enrichment.candidate !== null) {
                    signalCandidates.push(enrichment.candidate);
                    enrichmentCandidateCount += 1;
                }
            }
            catch (error) {
                rejectedCount += 1;
                if (isRateLimited(error))
                    rateLimitedCount += 1;
            }
        }
        return {
            accepted,
            rejectedCount,
            rateLimitedCount,
            regionMismatchCount,
            irrelevantCount,
            temporalMismatchCount,
            temporalUnknownCount,
            parserFailureCount,
            degradedCount,
            successfulFetchCount,
            lastHttpStatus,
            signalCandidates,
            enrichmentAttemptedCount,
            enrichmentCandidateCount,
            enrichmentFailedCount,
        };
    }
};
exports.DirectSourceService = DirectSourceService;
exports.DirectSourceService = DirectSourceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [article_ingestion_service_1.ArticleIngestionService,
        article_signal_enrichment_runner_service_1.ArticleSignalEnrichmentRunner])
], DirectSourceService);
function classifyPublicationTime(publishedAt, window) {
    if (publishedAt === null)
        return 'unknown';
    const timestamp = new Date(publishedAt).getTime();
    if (!Number.isFinite(timestamp))
        return 'unknown';
    return timestamp >= window.from.getTime() && timestamp <= window.to.getTime()
        ? 'matched'
        : 'mismatch';
}
function isRateLimited(error) {
    return typeof error === 'object' && error !== null &&
        (('sourceStatus' in error && error.sourceStatus === 'rate_limited') ||
            ('rateLimited' in error && error.rateLimited === true));
}
//# sourceMappingURL=direct-source.service.js.map