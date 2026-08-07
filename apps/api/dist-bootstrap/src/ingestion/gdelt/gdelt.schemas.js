"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GdeltResponseSchema = exports.GdeltArticleSchema = void 0;
const zod_1 = require("zod");
exports.GdeltArticleSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    title: zod_1.z.string().optional(),
    seendate: zod_1.z.string().optional(),
    domain: zod_1.z.string().optional(),
    language: zod_1.z.string().optional(),
    sourcecountry: zod_1.z.string().optional(),
}).passthrough();
exports.GdeltResponseSchema = zod_1.z.object({
    articles: zod_1.z.array(zod_1.z.unknown()).max(100),
}).passthrough();
//# sourceMappingURL=gdelt.schemas.js.map