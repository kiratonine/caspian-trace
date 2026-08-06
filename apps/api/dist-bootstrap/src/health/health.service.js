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
exports.HealthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
let HealthService = class HealthService {
    prisma;
    config;
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    async ready() {
        const configuredTimeout = this.config.get('DB_READINESS_TIMEOUT_MS');
        const timeoutMs = typeof configuredTimeout === 'number' ? configuredTimeout : 3_000;
        let timeout;
        try {
            await Promise.race([
                this.prisma.checkReadiness(timeoutMs),
                new Promise((_, reject) => {
                    timeout = setTimeout(() => reject(new Error('Database readiness timeout')), timeoutMs);
                }),
            ]);
        }
        catch {
            throw new common_1.ServiceUnavailableException({
                code: 'DATABASE_UNAVAILABLE',
                message: 'Database is unavailable',
            });
        }
        finally {
            if (timeout !== undefined)
                clearTimeout(timeout);
        }
        return {
            status: 'ok',
            service: 'caspian-trace-api',
            database: 'ready',
        };
    }
};
exports.HealthService = HealthService;
exports.HealthService = HealthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], HealthService);
//# sourceMappingURL=health.service.js.map