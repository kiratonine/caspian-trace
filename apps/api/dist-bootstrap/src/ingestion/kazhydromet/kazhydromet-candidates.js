"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findRelevantPages = findRelevantPages;
exports.extractMeasurementCandidates = extractMeasurementCandidates;
exports.validateCandidateAgainstText = validateCandidateAgainstText;
exports.normalizeDecimal = normalizeDecimal;
const INDICATOR_PATTERN = /нефтепродукт(?:ы|ов|ами|ах)?/iu;
const UNIT_PATTERN = /(?:мг\s*\/\s*дм\s*(?:3|³)|mg\s*\/\s*dm\s*3)/iu;
const DECIMAL_PATTERN = /(?<![\d,.])\d+[,.]\d+(?![\d,.])/gu;
const KEYWORDS = [
    'нефтепродукт', 'нефтепродукты',
    'атырау', 'жайык', 'жайық', 'урал',
    'мангистау', 'маңғыстау', 'актау', 'каспий',
];
function findRelevantPages(pages) {
    const results = [];
    for (const page of pages) {
        const lower = page.text.toLowerCase();
        const matches = KEYWORDS.filter((keyword) => lower.includes(keyword));
        const hasIndicator = matches.some((keyword) => keyword.startsWith('нефтепродукт'));
        const hasLocation = matches.some((keyword) => !keyword.startsWith('нефтепродукт'));
        if (hasIndicator && hasLocation) {
            results.push({ pageNumber: page.pageNumber, matchedKeywords: [...matches], score: matches.length });
        }
    }
    return results.sort((left, right) => right.score - left.score || left.pageNumber - right.pageNumber);
}
function extractMeasurementCandidates(page) {
    const candidates = [];
    const lines = page.text.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? '';
        const nextLine = lines[index + 1];
        const sourceExcerpt = nextLine !== undefined && /^(?:3|³)$/u.test(nextLine)
            ? `${line}\n${nextLine}`
            : line;
        if (!INDICATOR_PATTERN.test(sourceExcerpt) || !UNIT_PATTERN.test(sourceExcerpt))
            continue;
        for (const match of sourceExcerpt.matchAll(DECIMAL_PATTERN)) {
            const rawValueText = match[0];
            const normalizedValue = normalizeDecimal(rawValueText);
            if (normalizedValue === null)
                continue;
            candidates.push({
                pageNumber: page.pageNumber,
                indicator: 'нефтепродукты',
                stationLabel: null,
                rawValueText,
                normalizedValue,
                unit: 'mg/dm3',
                sourceExcerpt,
            });
        }
    }
    return candidates;
}
function validateCandidateAgainstText(candidate, page) {
    if (candidate.pageNumber !== page.pageNumber || !page.text.includes(candidate.rawValueText)) {
        return { valid: false, reason: 'VALUE_NOT_IN_PAGE' };
    }
    if (!page.text.includes(candidate.sourceExcerpt))
        return { valid: false, reason: 'EXCERPT_NOT_IN_PAGE' };
    if (!INDICATOR_PATTERN.test(candidate.sourceExcerpt))
        return { valid: false, reason: 'INDICATOR_NOT_IN_EXCERPT' };
    if (!UNIT_PATTERN.test(candidate.sourceExcerpt))
        return { valid: false, reason: 'UNIT_NOT_IN_EXCERPT' };
    const normalized = normalizeDecimal(candidate.rawValueText);
    if (normalized === null || normalized !== candidate.normalizedValue) {
        return { valid: false, reason: 'DECIMAL_INVALID' };
    }
    if (candidate.stationLabel !== null && !candidate.sourceExcerpt.includes(candidate.stationLabel)) {
        return { valid: false, reason: 'STATION_LABEL_AMBIGUOUS' };
    }
    return { valid: true };
}
function normalizeDecimal(value) {
    if (!/^\d+[,.]\d+$/u.test(value))
        return null;
    return value.replace(',', '.');
}
//# sourceMappingURL=kazhydromet-candidates.js.map