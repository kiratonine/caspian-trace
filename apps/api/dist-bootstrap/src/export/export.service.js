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
exports.ExportService = void 0;
const common_1 = require("@nestjs/common");
const investigations_service_1 = require("../investigations/investigations.service");
const dossier_mapper_1 = require("./dossier.mapper");
const html_renderer_1 = require("./html.renderer");
let ExportService = class ExportService {
    investigations;
    constructor(investigations) {
        this.investigations = investigations;
    }
    async buildDossierModel(id) {
        return (0, dossier_mapper_1.toDossier)(await this.investigations.getStored(id));
    }
    renderJson(model) {
        return `${JSON.stringify(model, null, 2)}\n`;
    }
    renderHtml(model) {
        return (0, html_renderer_1.renderDossierHtml)(model);
    }
};
exports.ExportService = ExportService;
exports.ExportService = ExportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [investigations_service_1.InvestigationsService])
], ExportService);
//# sourceMappingURL=export.service.js.map