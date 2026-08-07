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
exports.SourceHealthRepository = void 0;
const common_1 = require("@nestjs/common");
const enums_1 = require("../../generated/prisma/enums");
const prisma_service_1 = require("../../prisma/prisma.service");
const sourceHealthSelect = {
    sourceId: true,
    status: true,
    lastSuccessAt: true,
    cacheAvailable: true,
};
let SourceHealthRepository = class SourceHealthRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async startAttempt(input) {
        await this.prisma.sourceHealth.upsert({
            where: {
                sourceId: input.sourceId,
            },
            create: {
                sourceId: input.sourceId,
                displayName: input.displayName,
                status: enums_1.SourceHealthStatus.NEVER_RUN,
                lastAttemptAt: input.at,
            },
            update: {
                displayName: input.displayName,
                lastAttemptAt: input.at,
            },
            select: {
                sourceId: true,
            },
        });
    }
    async transition(input) {
        await this.prisma.$transaction(async (transaction) => {
            const current = await transaction.sourceHealth.findUnique({
                where: {
                    sourceId: input.sourceId,
                },
                select: {
                    metadata: true,
                    consecutiveErrors: true,
                },
            });
            const metadata = {
                ...jsonObject(current?.metadata),
                ...input.metadata,
            };
            let consecutiveErrors = current?.consecutiveErrors ?? 0;
            if (input.actualError) {
                consecutiveErrors += 1;
            }
            else if (input.success) {
                consecutiveErrors = 0;
            }
            await transaction.sourceHealth.upsert({
                where: {
                    sourceId: input.sourceId,
                },
                create: {
                    sourceId: input.sourceId,
                    displayName: input.displayName,
                    status: input.status,
                    lastAttemptAt: input.at,
                    lastSuccessAt: input.success
                        ? input.at
                        : null,
                    lastHttpStatus: input.lastHttpStatus,
                    cacheAvailable: input.cacheAvailable,
                    consecutiveErrors,
                    detail: input.detail,
                    metadata,
                },
                update: {
                    displayName: input.displayName,
                    status: input.status,
                    lastAttemptAt: input.at,
                    ...(input.success
                        ? {
                            lastSuccessAt: input.at,
                        }
                        : {}),
                    lastHttpStatus: input.lastHttpStatus,
                    cacheAvailable: input.cacheAvailable,
                    consecutiveErrors,
                    detail: input.detail,
                    metadata,
                },
                select: {
                    sourceId: true,
                },
            });
        });
    }
    findAll(sourceIds) {
        return this.prisma.sourceHealth.findMany({
            where: {
                sourceId: {
                    in: [...sourceIds],
                },
            },
            select: sourceHealthSelect,
        });
    }
};
exports.SourceHealthRepository = SourceHealthRepository;
exports.SourceHealthRepository = SourceHealthRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SourceHealthRepository);
function jsonObject(value) {
    if (typeof value !== 'object' ||
        value === null ||
        Array.isArray(value)) {
        return {};
    }
    const result = {};
    for (const [key, item] of Object.entries(value)) {
        if (item !== null && item !== undefined) {
            result[key] = item;
        }
    }
    return result;
}
//# sourceMappingURL=source-health.repository.js.map