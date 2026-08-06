"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionModule = void 0;
const common_1 = require("@nestjs/common");
const safe_fetch_module_1 = require("../common/http/safe-fetch.module");
const sources_module_1 = require("../sources/sources.module");
const ingestion_controller_1 = require("./ingestion.controller");
const ingestion_repository_1 = require("./ingestion.repository");
const ingestion_token_guard_1 = require("./ingestion-token.guard");
const ingestion_constants_1 = require("./ingestion.constants");
const article_ingestion_service_1 = require("./article/article-ingestion.service");
const article_text_service_1 = require("./article/article-text.service");
const direct_source_adapter_1 = require("./direct-sources/direct-source.adapter");
const direct_source_service_1 = require("./direct-sources/direct-source.service");
const gdelt_adapter_1 = require("./gdelt/gdelt.adapter");
const gdelt_ingestion_service_1 = require("./gdelt/gdelt-ingestion.service");
const kazhydromet_adapter_1 = require("./kazhydromet/kazhydromet.adapter");
const kazhydromet_ingestion_service_1 = require("./kazhydromet/kazhydromet-ingestion.service");
const pdf_text_service_1 = require("./kazhydromet/pdf-text.service");
const llm_module_1 = require("../llm/llm.module");
const article_signal_enricher_service_1 = require("./article/article-signal-enricher.service");
const article_signal_enrichment_runner_service_1 = require("./article/article-signal-enrichment-runner.service");
let IngestionModule = class IngestionModule {
};
exports.IngestionModule = IngestionModule;
exports.IngestionModule = IngestionModule = __decorate([
    (0, common_1.Module)({
        imports: [
            safe_fetch_module_1.SafeFetchModule,
            sources_module_1.SourcesModule,
            llm_module_1.LlmModule,
        ],
        controllers: [ingestion_controller_1.IngestionController],
        providers: [
            ingestion_token_guard_1.IngestionTokenGuard,
            ingestion_repository_1.IngestionRepository,
            kazhydromet_adapter_1.KazhydrometAdapter,
            kazhydromet_ingestion_service_1.KazhydrometIngestionService,
            article_text_service_1.ArticleTextService,
            article_ingestion_service_1.ArticleIngestionService,
            article_signal_enricher_service_1.ArticleSignalEnricher,
            article_signal_enrichment_runner_service_1.ArticleSignalEnrichmentRunner,
            direct_source_adapter_1.DirectSourceAdapter,
            direct_source_service_1.DirectSourceService,
            gdelt_adapter_1.GdeltAdapter,
            gdelt_ingestion_service_1.GdeltIngestionService,
            { provide: ingestion_constants_1.INGESTION_CLOCK, useValue: ingestion_constants_1.systemIngestionClock },
            pdf_text_service_1.PdfTextService,
            { provide: pdf_text_service_1.PDFJS_LOADER, useValue: pdf_text_service_1.loadPdfJs },
        ],
        exports: [
            ingestion_token_guard_1.IngestionTokenGuard,
            kazhydromet_ingestion_service_1.KazhydrometIngestionService,
            gdelt_ingestion_service_1.GdeltIngestionService,
            article_signal_enricher_service_1.ArticleSignalEnricher,
        ],
    })
], IngestionModule);
//# sourceMappingURL=ingestion.module.js.map