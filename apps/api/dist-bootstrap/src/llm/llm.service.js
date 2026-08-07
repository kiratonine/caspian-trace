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
exports.LlmService = void 0;
exports.validateQuotes = validateQuotes;
exports.validateNoNewNumbers = validateNoNewNumbers;
const common_1 = require("@nestjs/common");
const llm_provider_1 = require("./llm-provider");
const llm_schemas_1 = require("./schemas/llm.schemas");
const FORBIDDEN_BLAME = /(винов(?:ен|на|ны)|нарушител|доказан(?:о|а)?|причинил(?:а|и)?|ответствен(?:ен|на|ны)|(?<!не\s)источник\s+установлен|объект\s+не\s+причастен)/iu;
const NUMBER = /[-+]?\d+(?:[.,]\d+)?/gu;
let LlmService = class LlmService {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    async extractIncidentSignal(input) {
        const raw = await this.provider.extractIncidentSignal(input);
        if (raw === null)
            return null;
        const result = llm_schemas_1.ExtractedSignalSchema.parse(raw);
        validateQuotes(input.sourceText, result.evidenceQuotes);
        if (!input.sourceText.includes(result.excerpt)) {
            throw new Error('LLM_EXCERPT_NOT_FOUND');
        }
        if (!result.evidenceQuotes.some((quote) => result.excerpt.includes(quote))) {
            throw new Error('LLM_EXCERPT_NOT_SUPPORTED_BY_QUOTE');
        }
        validateTemporalPrecision(input.sourceText, result.observedAt, result.observedPeriod);
        return result;
    }
    async extractMeasurementCandidates(input) {
        const result = llm_schemas_1.MeasurementCandidatesSchema.parse(await this.provider.extractMeasurementCandidates(input));
        validateQuotes(input.sourceText, result.map(({ evidenceQuote }) => evidenceQuote));
        for (const item of result) {
            validateNoNewNumbers(item.evidenceQuote, `${item.rawValueText} ${item.unit}`);
        }
        return result;
    }
    async classifyPossibleDuplicate(input) {
        const result = llm_schemas_1.DuplicateAssessmentSchema.parse(await this.provider.classifyPossibleDuplicate(input));
        validateQuotes(`${input.firstText}\n${input.secondText}`, result.evidenceQuotes);
        return result;
    }
    async explainFacts(input) {
        const raw = await this.provider.explainFacts(input);
        if (raw === null)
            return null;
        const result = llm_schemas_1.GeneratedExplanationSchema.parse(raw);
        const allowed = [...input.facts, ...input.unknowns].join('\n');
        validateNoNewNumbers(allowed, result.text);
        if (FORBIDDEN_BLAME.test(result.text))
            throw new Error('LLM_FORBIDDEN_BLAME');
        return result;
    }
};
exports.LlmService = LlmService;
exports.LlmService = LlmService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(llm_provider_1.LLM_PROVIDER)),
    __metadata("design:paramtypes", [Object])
], LlmService);
function validateQuotes(sourceText, quotes) {
    if (quotes.some((quote) => !sourceText.includes(quote))) {
        throw new Error('LLM_QUOTE_NOT_FOUND');
    }
}
function validateNoNewNumbers(allowedText, generatedText) {
    const allowed = new Set(numbers(allowedText));
    if (numbers(generatedText).some((number) => !allowed.has(number))) {
        throw new Error('LLM_NUMBER_MUTATION');
    }
}
function numbers(value) {
    return [...value.matchAll(NUMBER)].map(([number]) => number.replace(',', '.'));
}
function validateTemporalPrecision(sourceText, observedAt, observedPeriod) {
    if (observedAt !== null) {
        const [year, month, day] = observedAt.slice(0, 10).split('-');
        if (year === undefined || month === undefined || day === undefined ||
            (!sourceText.includes(`${year}-${month}-${day}`) &&
                !sourceText.includes(`${day}.${month}.${year}`))) {
            throw new Error('LLM_DATE_PRECISION_UNSUPPORTED');
        }
    }
    if (observedPeriod !== null) {
        const [year, month] = observedPeriod.split('-');
        const monthPattern = month === undefined ? undefined : RUSSIAN_MONTH_PATTERNS[month];
        if (year === undefined || month === undefined ||
            (!sourceText.includes(observedPeriod) &&
                !sourceText.includes(`${month}.${year}`) &&
                (monthPattern === undefined ||
                    !new RegExp(`${monthPattern}\\s+${year}`, 'iu').test(sourceText)))) {
            throw new Error('LLM_DATE_PRECISION_UNSUPPORTED');
        }
    }
}
const RUSSIAN_MONTH_PATTERNS = {
    '01': 'январ\\p{L}*',
    '02': 'феврал\\p{L}*',
    '03': 'март\\p{L}*',
    '04': 'апрел\\p{L}*',
    '05': 'ма(?:й|я|е|ю)',
    '06': 'июн\\p{L}*',
    '07': 'июл\\p{L}*',
    '08': 'август\\p{L}*',
    '09': 'сентябр\\p{L}*',
    '10': 'октябр\\p{L}*',
    '11': 'ноябр\\p{L}*',
    '12': 'декабр\\p{L}*',
};
//# sourceMappingURL=llm.service.js.map