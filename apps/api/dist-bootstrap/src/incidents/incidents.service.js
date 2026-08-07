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
exports.IncidentsService = void 0;
const common_1 = require("@nestjs/common");
const incidents_errors_1 = require("./incidents.errors");
const incidents_mapper_1 = require("./incidents.mapper");
const incidents_repository_1 = require("./incidents.repository");
let IncidentsService = class IncidentsService {
    incidentsRepository;
    constructor(incidentsRepository) {
        this.incidentsRepository = incidentsRepository;
    }
    async list(filters) {
        const rows = await this.incidentsRepository.findMany(filters);
        try {
            return rows.map(incidents_mapper_1.mapIncidentSummary);
        }
        catch (error) {
            this.rethrowDataError(error);
        }
    }
    async getDetail(investigationId) {
        const row = await this.incidentsRepository.findDetail(investigationId);
        if (!row) {
            throw new common_1.NotFoundException({
                code: 'INVESTIGATION_NOT_FOUND',
                message: 'Investigation not found',
            });
        }
        try {
            return (0, incidents_mapper_1.mapIncidentDetail)(row);
        }
        catch (error) {
            this.rethrowDataError(error);
        }
    }
    rethrowDataError(error) {
        if (error instanceof incidents_errors_1.IncidentDataInvalidError) {
            throw new common_1.InternalServerErrorException({
                code: 'INCIDENT_DATA_INVALID',
                message: 'Incident data is inconsistent',
            });
        }
        throw error;
    }
};
exports.IncidentsService = IncidentsService;
exports.IncidentsService = IncidentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [incidents_repository_1.IncidentsRepository])
], IncidentsService);
//# sourceMappingURL=incidents.service.js.map