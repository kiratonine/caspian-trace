"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const environment_1 = require("./config/environment");
const health_module_1 = require("./health/health.module");
const incidents_module_1 = require("./incidents/incidents.module");
const prisma_module_1 = require("./prisma/prisma.module");
const safe_fetch_module_1 = require("./common/http/safe-fetch.module");
const sources_module_1 = require("./sources/sources.module");
const ingestion_module_1 = require("./ingestion/ingestion.module");
const live_module_1 = require("./live/live.module");
const export_module_1 = require("./export/export.module");
const investigations_module_1 = require("./investigations/investigations.module");
const llm_module_1 = require("./llm/llm.module");
const replays_module_1 = require("./replays/replays.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                cache: true,
                validate: environment_1.validatePlatformEnvironment,
            }),
            prisma_module_1.PrismaModule,
            health_module_1.HealthModule,
            incidents_module_1.IncidentsModule,
            sources_module_1.SourcesModule,
            safe_fetch_module_1.SafeFetchModule,
            ingestion_module_1.IngestionModule,
            live_module_1.LiveModule,
            llm_module_1.LlmModule,
            investigations_module_1.InvestigationsModule,
            replays_module_1.ReplaysModule,
            export_module_1.ExportModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map