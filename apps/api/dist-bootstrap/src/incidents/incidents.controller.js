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
exports.IncidentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const list_incidents_dto_1 = require("./dto/list-incidents.dto");
const incidents_service_1 = require("./incidents.service");
const errorSchema = {
    type: 'object',
    required: ['code', 'message', 'requestId'],
    properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        requestId: { type: 'string' },
    },
};
const summarySchema = {
    type: 'object',
    required: [
        'id',
        'title',
        'region',
        'evidenceLevel',
        'indicator',
        'updatedAt',
        'period',
    ],
    properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        region: { type: 'string', enum: ['atyrau', 'mangystau'] },
        evidenceLevel: { type: 'string', enum: ['L0', 'L1', 'L2', 'L3'] },
        indicator: { type: 'string' },
        updatedAt: { type: 'string', format: 'date-time' },
        period: {
            type: 'string',
            pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
            nullable: true,
        },
    },
};
const detailSchema = {
    type: 'object',
    required: [
        'investigation',
        'region',
        'signals',
        'measurements',
        'stations',
        'candidateObjects',
        'sourceDocuments',
        'corridorBounds',
    ],
    properties: {
        investigation: { type: 'object' },
        region: { type: 'string', enum: ['atyrau', 'mangystau'] },
        signals: { type: 'array', items: { type: 'object' } },
        measurements: { type: 'array', items: { type: 'object' } },
        stations: { type: 'array', items: { type: 'object' } },
        candidateObjects: { type: 'array', items: { type: 'object' } },
        sourceDocuments: { type: 'array', items: { type: 'object' } },
        corridorBounds: { type: 'object', nullable: true },
    },
};
let IncidentsController = class IncidentsController {
    incidentsService;
    constructor(incidentsService) {
        this.incidentsService = incidentsService;
    }
    list(query) {
        return this.incidentsService.list((0, list_incidents_dto_1.toIncidentFilters)(query));
    }
    getOne(params) {
        return this.incidentsService.getDetail(params.id);
    }
};
exports.IncidentsController = IncidentsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List current incident investigations' }),
    (0, swagger_1.ApiOkResponse)({ schema: { type: 'array', items: summarySchema } }),
    (0, swagger_1.ApiBadRequestResponse)({ schema: errorSchema }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_incidents_dto_1.ListIncidentsDto]),
    __metadata("design:returntype", Promise)
], IncidentsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a current incident investigation' }),
    (0, swagger_1.ApiOkResponse)({ schema: detailSchema }),
    (0, swagger_1.ApiNotFoundResponse)({ schema: errorSchema }),
    (0, swagger_1.ApiInternalServerErrorResponse)({ schema: errorSchema }),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_incidents_dto_1.InvestigationIdDto]),
    __metadata("design:returntype", Promise)
], IncidentsController.prototype, "getOne", null);
exports.IncidentsController = IncidentsController = __decorate([
    (0, swagger_1.ApiTags)('incidents'),
    (0, common_1.Controller)('incidents'),
    __metadata("design:paramtypes", [incidents_service_1.IncidentsService])
], IncidentsController);
//# sourceMappingURL=incidents.controller.js.map