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
exports.ExportController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const export_service_1 = require("./export.service");
let ExportController = class ExportController {
    exporter;
    constructor(exporter) {
        this.exporter = exporter;
    }
    async export(id, format, response) {
        if (format !== 'json' && format !== 'html') {
            throw new common_1.BadRequestException({
                code: 'EXPORT_FORMAT_INVALID',
                message: 'format must be json or html',
            });
        }
        const model = await this.exporter.buildDossierModel(id);
        const body = format === 'json'
            ? this.exporter.renderJson(model)
            : this.exporter.renderHtml(model);
        response.setHeader('Content-Type', format === 'json'
            ? 'application/json; charset=utf-8'
            : 'text/html; charset=utf-8');
        response.setHeader('Content-Disposition', `attachment; filename="${safeFilename(id)}.${format}"`);
        if (format === 'html') {
            response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
            response.setHeader('X-Content-Type-Options', 'nosniff');
        }
        response.send(body);
    }
};
exports.ExportController = ExportController;
__decorate([
    (0, common_1.Get)(':id/export'),
    (0, swagger_1.ApiOperation)({ summary: 'Download a reproducible investigation dossier' }),
    (0, swagger_1.ApiQuery)({ name: 'format', enum: ['json', 'html'] }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('format')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "export", null);
exports.ExportController = ExportController = __decorate([
    (0, swagger_1.ApiTags)('investigation export'),
    (0, common_1.Controller)('investigations'),
    __metadata("design:paramtypes", [export_service_1.ExportService])
], ExportController);
function safeFilename(id) {
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
    return safe.length === 0 ? 'investigation' : safe;
}
//# sourceMappingURL=export.controller.js.map