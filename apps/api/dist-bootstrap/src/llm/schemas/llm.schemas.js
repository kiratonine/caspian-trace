"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneratedExplanationSchema = exports.DuplicateAssessmentSchema = exports.MeasurementCandidatesSchema = exports.MeasurementCandidateSchema = exports.ExtractedSignalSchema = void 0;
const zod_1 = require("zod");
const quote = zod_1.z.string().trim().min(1);
exports.ExtractedSignalSchema = zod_1.z.object({
    observedAt: zod_1.z.string().datetime({ offset: true }).nullable(),
    observedPeriod: zod_1.z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable(),
    locationText: zod_1.z.string().trim().min(1),
    phenomenon: zod_1.z.enum([
        'oil_film',
        'color_change',
        'odor',
        'fish_kill',
        'wastewater',
        'other',
    ]),
    excerpt: zod_1.z.string().trim().min(1),
    evidenceQuotes: zod_1.z.array(quote).min(1).max(3),
    confidence: zod_1.z.number().min(0).max(1),
}).strict();
exports.MeasurementCandidateSchema = zod_1.z.object({
    indicator: zod_1.z.string().trim().min(1),
    rawValueText: zod_1.z.string().trim().min(1),
    unit: zod_1.z.string().trim().min(1),
    evidenceQuote: quote,
    confidence: zod_1.z.number().min(0).max(1),
}).strict();
exports.MeasurementCandidatesSchema = zod_1.z.array(exports.MeasurementCandidateSchema);
exports.DuplicateAssessmentSchema = zod_1.z.object({
    isDuplicate: zod_1.z.boolean(),
    confidence: zod_1.z.number().min(0).max(1),
    rationale: zod_1.z.string().trim().min(1),
    evidenceQuotes: zod_1.z.array(quote).max(3),
}).strict().refine(({ isDuplicate, evidenceQuotes }) => !isDuplicate || evidenceQuotes.length > 0, { message: 'A duplicate decision requires at least one evidence quote' });
exports.GeneratedExplanationSchema = zod_1.z.object({
    text: zod_1.z.string().trim().min(1),
}).strict();
//# sourceMappingURL=llm.schemas.js.map