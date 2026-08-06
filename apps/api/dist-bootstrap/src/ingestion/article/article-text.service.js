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
exports.ArticleTextService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const cheerio_1 = require("cheerio");
const ingestion_errors_1 = require("../ingestion.errors");
const gdelt_query_1 = require("../gdelt/gdelt-query");
const REMOVED_ELEMENTS = 'script,style,noscript,svg,canvas,form,nav,header,footer,aside,iframe';
const BODY_SELECTORS = ['[itemprop="articleBody"]', 'article', 'main', 'body'];
const MINIMUM_TEXT_CHARS = 20;
let ArticleTextService = class ArticleTextService {
    maximumTextChars;
    constructor(config) {
        this.maximumTextChars = config.getOrThrow('DIRECT_SOURCE_TEXT_MAX_CHARS');
    }
    extract(bytes, discoveryTitle, requestedRegions, now) {
        let html;
        try {
            html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        }
        catch {
            throw (0, ingestion_errors_1.publicIngestionError)('PUBLIC_ARTICLE_TEXT_INVALID', 'Public article is not valid UTF-8');
        }
        const $ = (0, cheerio_1.load)(html);
        const title = extractTitle($, discoveryTitle);
        const publication = extractPublishedAt($, now);
        $(REMOVED_ELEMENTS).remove();
        const text = extractBody($);
        if (text.length < MINIMUM_TEXT_CHARS) {
            throw (0, ingestion_errors_1.publicIngestionError)('PUBLIC_ARTICLE_TEXT_EMPTY', 'Public article text is empty');
        }
        if (text.length > this.maximumTextChars) {
            throw (0, ingestion_errors_1.publicIngestionError)('PUBLIC_ARTICLE_TEXT_TOO_LARGE', 'Public article text exceeds the configured limit');
        }
        const searchable = `${title.value ?? ''}\n${text}`.toLocaleLowerCase('ru');
        const geography = uniqueMatches(searchable, [...gdelt_query_1.ATYRAU_GEOGRAPHY_TERMS, ...gdelt_query_1.MANGYSTAU_GEOGRAPHY_TERMS]);
        const matchedRequestedRegions = requestedRegions.filter((region) => uniqueMatches(searchable, region === 'atyrau' ? gdelt_query_1.ATYRAU_REGION_MARKERS : gdelt_query_1.MANGYSTAU_REGION_MARKERS).length > 0);
        const pollution = uniqueMatches(searchable, gdelt_query_1.POLLUTION_TERMS);
        return {
            title: title.value,
            publishedAt: publication.value,
            text,
            textSha256: (0, node_crypto_1.createHash)('sha256').update(text).digest('hex'),
            textChars: text.length,
            titleMode: title.mode,
            publishedAtMode: publication.mode,
            matchedGeographyKeywords: geography,
            matchedRequestedRegions,
            matchedPollutionKeywords: pollution,
            relevant: matchedRequestedRegions.length > 0 && pollution.length > 0,
        };
    }
};
exports.ArticleTextService = ArticleTextService;
exports.ArticleTextService = ArticleTextService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ArticleTextService);
function extractTitle($, discoveryTitle) {
    const candidates = [
        ['og_title', $('meta[property="og:title"]').first().attr('content')],
        ['twitter_title', $('meta[name="twitter:title"]').first().attr('content')],
        ['document_title', $('title').first().text()],
        ['discovery', discoveryTitle ?? undefined],
    ];
    for (const [mode, value] of candidates) {
        const normalized = normalizeSingleLine(value ?? '');
        if (normalized.length > 0 && normalized.length <= 500)
            return { value: normalized, mode };
    }
    return { value: null, mode: 'none' };
}
function extractPublishedAt($, now) {
    const groups = [
        ['article_published_time', $('meta[property="article:published_time"]').map((_index, element) => $(element).attr('content') ?? '').get()],
        ['json_ld', jsonLdDates($)],
        ['time_datetime', $('article time[datetime], [itemprop="articleBody"] time[datetime], main time[datetime]').map((_index, element) => $(element).attr('datetime') ?? '').get()],
    ];
    for (const [mode, values] of groups) {
        const accepted = [...new Set(values.map((value) => exactIso(value, now)).filter((value) => value !== null))];
        if (accepted.length === 1)
            return { value: accepted[0], mode };
        if (accepted.length > 1)
            return { value: null, mode: 'none' };
    }
    return { value: null, mode: 'none' };
}
function jsonLdDates($) {
    const dates = [];
    $('script[type="application/ld+json"]').each((_index, element) => {
        try {
            collectDatePublished(JSON.parse($(element).text()), dates, 0);
        }
        catch {
        }
    });
    return dates;
}
function collectDatePublished(value, output, depth) {
    if (depth > 5 || value === null || typeof value !== 'object')
        return;
    if (Array.isArray(value)) {
        for (const item of value.slice(0, 50))
            collectDatePublished(item, output, depth + 1);
        return;
    }
    for (const [key, item] of Object.entries(value)) {
        if (key === 'datePublished' && typeof item === 'string')
            output.push(item);
        else
            collectDatePublished(item, output, depth + 1);
    }
}
function exactIso(value, now) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))
        return null;
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime()) || parsed.getTime() > now.getTime() + 86_400_000)
        return null;
    return parsed.toISOString();
}
function extractBody($) {
    for (const selector of BODY_SELECTORS) {
        const element = $(selector).first();
        if (element.length === 0)
            continue;
        const blocks = element.find('p,h1,h2,h3,h4,li,blockquote').map((_index, child) => normalizeSingleLine($(child).text())).get().filter(Boolean);
        const text = normalizeParagraphs(blocks.length > 0 ? blocks.join('\n') : element.text());
        if (text.length >= MINIMUM_TEXT_CHARS)
            return text;
    }
    return '';
}
function normalizeSingleLine(value) {
    return value.replace(/[\t\f\v\u00a0 ]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim();
}
function normalizeParagraphs(value) {
    return value.split(/\r?\n/).map(normalizeSingleLine).filter(Boolean).join('\n').trim();
}
function uniqueMatches(haystack, terms) {
    return [...new Set(terms.filter((term) => haystack.includes(term.toLocaleLowerCase('ru'))))];
}
//# sourceMappingURL=article-text.service.js.map