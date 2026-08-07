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
exports.SourcesRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("../generated/prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const sources_errors_1 = require("./sources.errors");
const sourceForCacheSelect = {
    id: true,
    sourceType: true,
    mediaType: true,
    publishedPeriod: true,
    fetchedAt: true,
    sha256: true,
    cachePath: true,
    httpStatus: true,
    status: true,
};
const sourceForOpenSelect = {
    id: true,
    mediaType: true,
    sha256: true,
    cachePath: true,
    status: true,
};
let SourcesRepository = class SourcesRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findForCache(id) {
        return this.prisma.sourceDocument.findUnique({
            where: { id },
            select: sourceForCacheSelect,
        });
    }
    findForOpen(id) {
        return this.prisma.sourceDocument.findUnique({
            where: { id },
            select: sourceForOpenSelect,
        });
    }
    attachSnapshot(input) {
        return this.prisma.$transaction(async (transaction) => {
            const current = await transaction.sourceDocument.findUnique({
                where: { id: input.sourceDocumentId },
                select: sourceForCacheSelect,
            });
            if (!current)
                throw (0, sources_errors_1.sourceDocumentNotFound)();
            assertImmutableSnapshot(current, input);
            if (current.sha256 === input.sha256 &&
                current.cachePath === input.cachePath) {
                return { document: current, attached: false };
            }
            const updated = await transaction.sourceDocument.updateMany({
                where: {
                    id: input.sourceDocumentId,
                    sha256: current.sha256,
                    cachePath: current.cachePath,
                },
                data: {
                    sha256: input.sha256,
                    cachePath: input.cachePath,
                    fetchedAt: input.fetchedAt,
                    httpStatus: input.httpStatus,
                },
            });
            if (updated.count !== 1) {
                const raced = await transaction.sourceDocument.findUnique({
                    where: { id: input.sourceDocumentId },
                    select: sourceForCacheSelect,
                });
                if (!raced)
                    throw (0, sources_errors_1.sourceDocumentNotFound)();
                assertImmutableSnapshot(raced, input);
                if (raced.sha256 === input.sha256 &&
                    raced.cachePath === input.cachePath) {
                    return { document: raced, attached: false };
                }
                throw (0, sources_errors_1.sourceCachePathConflict)();
            }
            const document = await transaction.sourceDocument.findUnique({
                where: { id: input.sourceDocumentId },
                select: sourceForCacheSelect,
            });
            if (!document)
                throw (0, sources_errors_1.sourceDocumentNotFound)();
            return { document, attached: true };
        }, {
            maxWait: 5_000,
            timeout: 10_000,
            isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable,
        });
    }
};
exports.SourcesRepository = SourcesRepository;
exports.SourcesRepository = SourcesRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SourcesRepository);
function assertImmutableSnapshot(current, expected) {
    if (current.sha256 !== null && current.sha256 !== expected.sha256) {
        throw (0, sources_errors_1.sourceSnapshotHashConflict)();
    }
    if (current.cachePath !== null && current.cachePath !== expected.cachePath) {
        throw (0, sources_errors_1.sourceCachePathConflict)();
    }
}
//# sourceMappingURL=sources.repository.js.map