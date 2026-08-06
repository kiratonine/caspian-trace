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
exports.DirectSourceAdapter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const article_url_1 = require("../article/article-url");
const gdelt_adapter_1 = require("../gdelt/gdelt.adapter");
const direct_source_registry_1 = require("./direct-source-registry");
let DirectSourceAdapter = class DirectSourceAdapter {
    fallbackUrls;
    allowedHosts;
    maximumPerDomain;
    maximumPerRun;
    constructor(config) {
        this.fallbackUrls = config.getOrThrow('DIRECT_SOURCE_FALLBACK_URLS');
        this.allowedHosts = config.getOrThrow('DIRECT_SOURCE_ALLOWED_HOSTS');
        this.maximumPerDomain = config.getOrThrow('DIRECT_SOURCE_MAX_ARTICLES_PER_DOMAIN');
        this.maximumPerRun = config.getOrThrow('DIRECT_SOURCE_MAX_ARTICLES_PER_RUN');
    }
    candidates(request, remaining, excludedCanonicalUrls) {
        const candidates = [];
        for (const value of this.fallbackUrls) {
            const url = (0, article_url_1.parsePublicArticleUrl)(value);
            if (!url || !this.allowedHosts.includes(url.hostname))
                continue;
            const source = (0, direct_source_registry_1.findDirectSource)(url.hostname);
            if (!source)
                continue;
            const requestedRegions = request.regions.filter((region) => source.requestRegions.includes(region));
            if (requestedRegions.length === 0)
                continue;
            candidates.push({
                discoveryMode: 'direct_fallback',
                originalUrl: url.toString(),
                discoveryTitle: null,
                gdeltSeenAt: null,
                gdeltLanguage: null,
                gdeltSourceCountry: null,
                requestedRegions,
                publisherHost: url.hostname,
                coverage: source.coverage,
            });
        }
        return (0, gdelt_adapter_1.boundedCandidates)(candidates, Math.min(remaining, this.maximumPerRun), this.maximumPerDomain, new Set(excludedCanonicalUrls));
    }
};
exports.DirectSourceAdapter = DirectSourceAdapter;
exports.DirectSourceAdapter = DirectSourceAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], DirectSourceAdapter);
//# sourceMappingURL=direct-source.adapter.js.map