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
exports.IncidentsRepository = void 0;
const common_1 = require("@nestjs/common");
const enums_1 = require("../generated/prisma/enums");
const prisma_service_1 = require("../prisma/prisma.service");
const incidents_types_1 = require("./incidents.types");
let IncidentsRepository = class IncidentsRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findMany(filters) {
        const generatedAt = filters.generatedFrom || filters.generatedBefore
            ? {
                gte: filters.generatedFrom,
                lt: filters.generatedBefore,
            }
            : undefined;
        return this.prisma.investigation.findMany({
            where: {
                isCurrent: true,
                evidenceLevel: filters.status
                    ? mapEvidenceLevelFilter(filters.status)
                    : undefined,
                incident: filters.region
                    ? { region: mapRegionFilter(filters.region) }
                    : undefined,
                generatedAt,
            },
            orderBy: [{ generatedAt: 'desc' }, { id: 'asc' }],
            take: filters.limit,
            select: incidents_types_1.incidentSummarySelect,
        });
    }
    findDetail(investigationId) {
        return this.prisma.investigation.findFirst({
            where: {
                isCurrent: true,
                OR: [
                    { id: investigationId },
                    { incidentId: investigationId },
                ],
            },
            select: incidents_types_1.incidentDetailSelect,
        });
    }
};
exports.IncidentsRepository = IncidentsRepository;
exports.IncidentsRepository = IncidentsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IncidentsRepository);
function mapEvidenceLevelFilter(value) {
    switch (value) {
        case 'L0':
            return enums_1.EvidenceLevel.L0;
        case 'L1':
            return enums_1.EvidenceLevel.L1;
        case 'L2':
            return enums_1.EvidenceLevel.L2;
        case 'L3':
            return enums_1.EvidenceLevel.L3;
    }
}
function mapRegionFilter(value) {
    switch (value) {
        case 'atyrau':
            return enums_1.Region.ATYRAU;
        case 'mangystau':
            return enums_1.Region.MANGYSTAU;
    }
}
//# sourceMappingURL=incidents.repository.js.map