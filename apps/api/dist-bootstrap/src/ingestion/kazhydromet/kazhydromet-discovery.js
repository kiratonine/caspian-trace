"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverPdfCandidates = discoverPdfCandidates;
exports.parsePublishedPeriod = parsePublishedPeriod;
exports.detectRegions = detectRegions;
const cheerio_1 = require("cheerio");
const kazhydromet_types_1 = require("./kazhydromet.types");
const REGION_MARKERS = {
    atyrau: ['атырау', 'atyrau', 'atirau'],
    mangystau: ['мангистау', 'маңғыстау', 'mangystau', 'aktau', 'актау'],
};
const MONTHS = new Map([
    ['январь', '01'], ['января', '01'], ['january', '01'],
    ['февраль', '02'], ['февраля', '02'], ['february', '02'],
    ['март', '03'], ['марта', '03'], ['march', '03'],
    ['апрель', '04'], ['апреля', '04'], ['april', '04'],
    ['май', '05'], ['мая', '05'], ['may', '05'],
    ['июнь', '06'], ['июня', '06'], ['june', '06'],
    ['июль', '07'], ['июля', '07'], ['july', '07'],
    ['август', '08'], ['августа', '08'], ['august', '08'],
    ['сентябрь', '09'], ['сентября', '09'], ['september', '09'],
    ['октябрь', '10'], ['октября', '10'], ['october', '10'],
    ['ноябрь', '11'], ['ноября', '11'], ['november', '11'],
    ['декабрь', '12'], ['декабря', '12'], ['december', '12'],
    ['yanvar', '01'], ['fevral', '02'], ['mart', '03'], ['aprel', '04'],
    ['may', '05'], ['iyun', '06'], ['iyul', '07'], ['avgust', '08'],
    ['sentyabr', '09'], ['oktyabr', '10'], ['noyabr', '11'], ['dekabr', '12'],
]);
function discoverPdfCandidates(input) {
    const listingUrl = new URL(input.listingFinalUrl);
    const $ = (0, cheerio_1.load)(input.html);
    const discovered = [];
    $('a[href]').each((_index, element) => {
        const href = $(element).attr('href');
        if (!href)
            return;
        let url;
        try {
            url = new URL(href, listingUrl);
        }
        catch {
            return;
        }
        if (url.protocol !== 'https:' ||
            url.username !== '' ||
            url.password !== '' ||
            url.hash !== '' ||
            !input.allowedHosts.includes(url.hostname.toLowerCase()))
            return;
        const anchorText = normalizeDisplayText($(element).text());
        const contextElement = $(element).closest('li, article, section, div, p');
        const contextText = normalizeDisplayText(contextElement.length > 0 ? contextElement.first().text() : $(element).parent().text());
        const haystack = safeDecode(`${url.pathname} ${anchorText} ${contextText}`).toLowerCase();
        if (!url.pathname.toLowerCase().endsWith('.pdf') && !haystack.includes('pdf'))
            return;
        const publishedPeriod = parsePublishedPeriod(haystack);
        const regions = detectRegions(haystack)
            .filter((region) => input.request.regions.includes(region));
        if (publishedPeriod === null ||
            publishedPeriod < input.request.from ||
            publishedPeriod > input.request.to ||
            regions.length === 0)
            return;
        const language = detectLanguage(haystack);
        const candidate = kazhydromet_types_1.PdfCandidateSchema.safeParse({
            url,
            canonicalUrl: url.toString(),
            listingUrl: listingUrl.toString(),
            anchorText,
            contextText,
            publishedPeriod,
            regions,
            language,
            discoveryMode: 'listing',
            confidence: 2 + regions.length + (publishedPeriod === null ? 0 : 2) + (language === 'ru' ? 2 : 0),
        });
        if (candidate.success)
            discovered.push(candidate.data);
    });
    const deduplicated = new Map();
    for (const candidate of discovered) {
        const existing = deduplicated.get(candidate.canonicalUrl);
        if (!existing || comparePreference(candidate, existing) < 0) {
            deduplicated.set(candidate.canonicalUrl, candidate);
        }
    }
    const byRegionPeriod = new Map();
    for (const candidate of [...deduplicated.values()].sort(compareCandidate)) {
        for (const region of candidate.regions.filter((value) => input.request.regions.includes(value))) {
            const key = `${region}:${candidate.publishedPeriod}`;
            const existing = byRegionPeriod.get(key);
            if (!existing || comparePreference(candidate, existing) < 0) {
                byRegionPeriod.set(key, candidate);
            }
        }
    }
    return [...new Set(byRegionPeriod.values())]
        .sort(compareCandidate)
        .slice(0, input.request.maxDocuments);
}
function parsePublishedPeriod(value) {
    const numericMatches = [...value.matchAll(/(?<!\d)(\d{4})[-/.](0?[1-9]|1[0-2])(?!\d)|(?<!\d)(0?[1-9]|1[0-2])[-/.](\d{4})(?!\d)/g)]
        .map((match) => match[1] ? `${match[1]}-${match[2]?.padStart(2, '0')}` : `${match[4]}-${match[3]?.padStart(2, '0')}`);
    const wordMatches = [];
    for (const [word, month] of MONTHS) {
        const matches = [...value.matchAll(new RegExp(`(?:^|[^\\p{L}])${word}[^\\d]{0,20}(20\\d{2})(?!\\d)`, 'giu'))];
        for (const match of matches)
            wordMatches.push(`${match[1]}-${month}`);
    }
    const periods = [...new Set([...numericMatches, ...wordMatches])];
    return periods.length === 1 ? periods[0] ?? null : null;
}
function detectRegions(value) {
    const normalized = value.toLowerCase();
    return Object.keys(REGION_MARKERS).filter((region) => REGION_MARKERS[region].some((marker) => normalized.includes(marker)));
}
function detectLanguage(value) {
    if (/(?:russ|рус(?:ский)?)/iu.test(value))
        return 'ru';
    if (/(?:kaz|қазақ|казах)/iu.test(value))
        return 'kk';
    return 'unknown';
}
function comparePreference(left, right) {
    const languageRank = (candidate) => candidate.language === 'ru' ? 0 : candidate.language === 'unknown' ? 1 : 2;
    return languageRank(left) - languageRank(right) || right.confidence - left.confidence || left.canonicalUrl.localeCompare(right.canonicalUrl);
}
function compareCandidate(left, right) {
    return (left.publishedPeriod ?? '').localeCompare(right.publishedPeriod ?? '') ||
        (left.regions[0] ?? '').localeCompare(right.regions[0] ?? '') ||
        comparePreference(left, right);
}
function normalizeDisplayText(value) {
    return value.replace(/\s+/gu, ' ').trim();
}
function safeDecode(value) {
    try {
        return decodeURIComponent(value);
    }
    catch {
        return value;
    }
}
//# sourceMappingURL=kazhydromet-discovery.js.map