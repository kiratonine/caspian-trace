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
exports.ArticleSignalEnricher = void 0;
const common_1 = require("@nestjs/common");
const llm_service_1 = require("../../llm/llm.service");
let ArticleSignalEnricher = class ArticleSignalEnricher {
    llm;
    constructor(llm) {
        this.llm = llm;
    }
    async enrich(input) {
        const sourceText = input.sourceText.trim();
        if (sourceText.length === 0) {
            return null;
        }
        const signal = await this.llm.extractIncidentSignal({
            sourceText,
        });
        if (signal === null) {
            return null;
        }
        return {
            sourceDocumentId: input.sourceDocumentId,
            extractionMode: 'llm_candidate',
            verificationStatus: 'unverified',
            signal,
        };
    }
};
exports.ArticleSignalEnricher = ArticleSignalEnricher;
exports.ArticleSignalEnricher = ArticleSignalEnricher = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [llm_service_1.LlmService])
], ArticleSignalEnricher);
//# sourceMappingURL=article-signal-enricher.service.js.map