"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfCandidateSchema = void 0;
const zod_1 = require("zod");
const ingestion_types_1 = require("../ingestion.types");
exports.PdfCandidateSchema = zod_1.z.object({
    url: zod_1.z.instanceof(URL),
    canonicalUrl: zod_1.z.url({ protocol: /^https$/ }),
    listingUrl: zod_1.z.url({ protocol: /^https$/ }),
    anchorText: zod_1.z.string(),
    contextText: zod_1.z.string(),
    publishedPeriod: zod_1.z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/).nullable(),
    regions: zod_1.z.array(zod_1.z.enum(ingestion_types_1.KAZHYDROMET_REGIONS)).min(1),
    language: zod_1.z.enum(['ru', 'kk', 'unknown']),
    discoveryMode: zod_1.z.literal('listing'),
    confidence: zod_1.z.number().int().nonnegative(),
});
//# sourceMappingURL=kazhydromet.types.js.map