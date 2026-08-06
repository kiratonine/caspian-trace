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
exports.SourcesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const open_source_dto_1 = require("./dto/open-source.dto");
const sources_service_1 = require("./sources.service");
let SourcesController = class SourcesController {
    sourcesService;
    constructor(sourcesService) {
        this.sourcesService = sourcesService;
    }
    async open(params, query, response) {
        const result = await this.sourcesService.openSource(params.id, query.page);
        response.setHeader('Cache-Control', 'private, no-store');
        response.setHeader('Referrer-Policy', 'no-referrer');
        response.redirect(common_1.HttpStatus.FOUND, result.location);
    }
};
exports.SourcesController = SourcesController;
__decorate([
    (0, common_1.Get)(':id/open'),
    (0, swagger_1.ApiOperation)({ summary: 'Open an immutable cached source snapshot' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'SourceDocument.id' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number, minimum: 1 }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.FOUND,
        description: 'Redirect to a short-lived private signed URL',
    }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid page or unsupported page target' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Document or cached snapshot not found' }),
    (0, swagger_1.ApiInternalServerErrorResponse)({ description: 'Stored source data is invalid' }),
    (0, swagger_1.ApiServiceUnavailableResponse)({ description: 'Source storage unavailable' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [open_source_dto_1.OpenSourceParamsDto,
        open_source_dto_1.OpenSourceQueryDto, Object]),
    __metadata("design:returntype", Promise)
], SourcesController.prototype, "open", null);
exports.SourcesController = SourcesController = __decorate([
    (0, swagger_1.ApiTags)('source-documents'),
    (0, common_1.Controller)('source-documents'),
    __metadata("design:paramtypes", [sources_service_1.SourcesService])
], SourcesController);
//# sourceMappingURL=sources.controller.js.map