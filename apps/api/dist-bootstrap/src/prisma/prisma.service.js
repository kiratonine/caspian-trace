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
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("../generated/prisma/client");
const prisma_constants_1 = require("./prisma.constants");
let PrismaService = class PrismaService extends client_1.PrismaClient {
    constructor(config, adapterFactory) {
        super({
            adapter: adapterFactory(config.getOrThrow('DATABASE_URL'), config.getOrThrow('DB_READINESS_TIMEOUT_MS')),
        });
    }
    async checkReadiness(timeoutMs) {
        await this.$transaction(async (transaction) => {
            await transaction.$queryRaw `
          SELECT set_config('statement_timeout', ${`${timeoutMs}ms`}, true)
        `;
            await transaction.$queryRaw `SELECT 1`;
        }, { maxWait: timeoutMs, timeout: timeoutMs });
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(prisma_constants_1.PRISMA_ADAPTER_FACTORY)),
    __metadata("design:paramtypes", [config_1.ConfigService, Function])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map