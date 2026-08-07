"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const adapter_pg_1 = require("@prisma/adapter-pg");
const prisma_constants_1 = require("./prisma.constants");
const prisma_connection_1 = require("./prisma-connection");
const prisma_service_1 = require("./prisma.service");
const prismaAdapterFactory = (databaseUrl, connectionTimeoutMillis) => new adapter_pg_1.PrismaPg({
    connectionString: (0, prisma_connection_1.normalizePgConnectionString)(databaseUrl),
    connectionTimeoutMillis,
});
let PrismaModule = class PrismaModule {
};
exports.PrismaModule = PrismaModule;
exports.PrismaModule = PrismaModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        providers: [
            prisma_service_1.PrismaService,
            { provide: prisma_constants_1.PRISMA_ADAPTER_FACTORY, useValue: prismaAdapterFactory },
        ],
        exports: [prisma_service_1.PrismaService],
    })
], PrismaModule);
//# sourceMappingURL=prisma.module.js.map