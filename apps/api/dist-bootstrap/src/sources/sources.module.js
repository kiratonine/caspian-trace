"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourcesModule = void 0;
const common_1 = require("@nestjs/common");
const sources_controller_1 = require("./sources.controller");
const source_health_repository_1 = require("./source-health/source-health.repository");
const source_health_service_1 = require("./source-health/source-health.service");
const sources_repository_1 = require("./sources.repository");
const sources_service_1 = require("./sources.service");
const storage_constants_1 = require("./storage/storage.constants");
const supabase_storage_service_1 = require("./storage/supabase-storage.service");
let SourcesModule = class SourcesModule {
};
exports.SourcesModule = SourcesModule;
exports.SourcesModule = SourcesModule = __decorate([
    (0, common_1.Module)({
        controllers: [sources_controller_1.SourcesController],
        providers: [
            sources_repository_1.SourcesRepository,
            sources_service_1.SourcesService,
            source_health_repository_1.SourceHealthRepository,
            source_health_service_1.SourceHealthService,
            supabase_storage_service_1.SupabaseStorageService,
            {
                provide: storage_constants_1.SOURCE_STORAGE,
                useExisting: supabase_storage_service_1.SupabaseStorageService,
            },
        ],
        exports: [
            sources_service_1.SourcesService,
            source_health_service_1.SourceHealthService,
        ],
    })
], SourcesModule);
//# sourceMappingURL=sources.module.js.map