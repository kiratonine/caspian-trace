"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvestigationsModule = void 0;
const common_1 = require("@nestjs/common");
const ingestion_module_1 = require("../ingestion/ingestion.module");
const admin_investigations_controller_1 = require("./admin-investigations.controller");
const investigation_ports_1 = require("./investigation.ports");
const investigations_controller_1 = require("./investigations.controller");
const investigations_service_1 = require("./investigations.service");
const prisma_investigation_repository_1 = require("./prisma-investigation.repository");
let InvestigationsModule = class InvestigationsModule {
};
exports.InvestigationsModule = InvestigationsModule;
exports.InvestigationsModule = InvestigationsModule = __decorate([
    (0, common_1.Module)({
        imports: [ingestion_module_1.IngestionModule],
        controllers: [investigations_controller_1.InvestigationsController, admin_investigations_controller_1.AdminInvestigationsController],
        providers: [
            prisma_investigation_repository_1.PrismaInvestigationRepository,
            {
                provide: investigation_ports_1.INVESTIGATION_INPUT_READER,
                useExisting: prisma_investigation_repository_1.PrismaInvestigationRepository,
            },
            {
                provide: investigation_ports_1.INVESTIGATION_RESULT_WRITER,
                useExisting: prisma_investigation_repository_1.PrismaInvestigationRepository,
            },
            investigations_service_1.InvestigationsService,
        ],
        exports: [investigations_service_1.InvestigationsService],
    })
], InvestigationsModule);
//# sourceMappingURL=investigations.module.js.map