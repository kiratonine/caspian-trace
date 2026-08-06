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
exports.PdfTextService = exports.loadPdfJs = exports.PDFJS_LOADER = void 0;
exports.reconstructText = reconstructText;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ingestion_errors_1 = require("../ingestion.errors");
exports.PDFJS_LOADER = Symbol('PDFJS_LOADER');
const importPdfJsModule = new Function('return import("pdfjs-dist/legacy/build/pdf.mjs")');
const loadPdfJs = () => importPdfJsModule();
exports.loadPdfJs = loadPdfJs;
let PdfTextService = class PdfTextService {
    loader;
    maxPages;
    maxTextChars;
    constructor(config, loader) {
        this.loader = loader;
        this.maxPages = config.getOrThrow('KAZHYDROMET_PDF_MAX_PAGES');
        this.maxTextChars = config.getOrThrow('KAZHYDROMET_PDF_MAX_TEXT_CHARS');
    }
    async extractPages(buffer) {
        if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
            throw (0, ingestion_errors_1.kazhydrometError)('KAZHYDROMET_PDF_INVALID', 'Kazhydromet response is not a PDF');
        }
        const pdfjs = await this.loader();
        const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(Buffer.from(buffer)),
            isEvalSupported: false,
            useWorkerFetch: false,
        });
        let document;
        try {
            document = await loadingTask.promise;
            if (document.numPages > this.maxPages) {
                throw (0, ingestion_errors_1.kazhydrometError)('KAZHYDROMET_PDF_TOO_MANY_PAGES', 'Kazhydromet PDF has too many pages');
            }
            const pages = [];
            let totalCharacters = 0;
            for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
                const page = await document.getPage(pageNumber);
                try {
                    const content = await page.getTextContent();
                    const text = reconstructText(content.items);
                    totalCharacters += text.length;
                    if (totalCharacters > this.maxTextChars) {
                        throw (0, ingestion_errors_1.kazhydrometError)('KAZHYDROMET_PDF_TEXT_TOO_LARGE', 'Extracted Kazhydromet text is too large');
                    }
                    pages.push({
                        pageNumber,
                        text,
                        textSha256: (0, node_crypto_1.createHash)('sha256').update(text).digest('hex'),
                    });
                }
                finally {
                    page.cleanup();
                }
            }
            if (!pages.some((page) => /\S/u.test(page.text))) {
                throw (0, ingestion_errors_1.kazhydrometError)('KAZHYDROMET_PDF_TEXT_EMPTY', 'Kazhydromet PDF contains no extractable text');
            }
            return pages;
        }
        finally {
            if (document)
                await document.destroy();
            else
                await loadingTask.destroy();
        }
    }
};
exports.PdfTextService = PdfTextService;
exports.PdfTextService = PdfTextService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(exports.PDFJS_LOADER)),
    __metadata("design:paramtypes", [config_1.ConfigService, Function])
], PdfTextService);
function reconstructText(items) {
    const lines = [];
    for (const item of items) {
        if (!isTextItem(item) || item.str.length === 0)
            continue;
        const x = item.transform[4] ?? 0;
        const y = item.transform[5] ?? 0;
        let line = lines.find((candidate) => Math.abs(candidate.y - y) <= 2);
        if (!line) {
            line = { y, items: [] };
            lines.push(line);
        }
        line.items.push({ x, str: item.str });
    }
    return lines
        .sort((left, right) => right.y - left.y)
        .map((line) => line.items.sort((left, right) => left.x - right.x).map((item) => item.str).join(' '))
        .join('\n')
        .replace(/[ \t]+\n/gu, '\n')
        .replace(/[\s\uFEFF]+$/u, '');
}
function isTextItem(value) {
    return typeof value === 'object' && value !== null &&
        'str' in value && typeof value.str === 'string' &&
        'transform' in value && Array.isArray(value.transform) &&
        value.transform.every((coordinate) => typeof coordinate === 'number');
}
//# sourceMappingURL=pdf-text.service.js.map