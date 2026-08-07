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
exports.SourcesService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const source_snapshot_1 = require("./source-snapshot");
const sources_errors_1 = require("./sources.errors");
const sources_repository_1 = require("./sources.repository");
const storage_constants_1 = require("./storage/storage.constants");
const storage_errors_1 = require("./storage/storage.errors");
let SourcesService = class SourcesService {
    repository;
    storage;
    maxBytes;
    signedUrlTtlSeconds;
    constructor(repository, storage, config) {
        this.repository = repository;
        this.storage = storage;
        this.maxBytes = config.getOrThrow('HTTP_MAX_BYTES');
        this.signedUrlTtlSeconds = config.getOrThrow('SOURCE_SIGNED_URL_TTL_SECONDS');
    }
    async cacheExistingSourceSnapshot(input) {
        assertCacheInput(input);
        const document = await this.repository.findForCache(input.sourceDocumentId);
        if (!document)
            throw (0, sources_errors_1.sourceDocumentNotFound)();
        const requestedMediaType = (0, source_snapshot_1.normalizeSourceMediaType)(input.mediaType);
        if ((0, source_snapshot_1.normalizePersistedMediaType)(document.mediaType) !== requestedMediaType) {
            throw (0, sources_errors_1.sourceDataInvalid)();
        }
        const preparedSnapshot = (0, source_snapshot_1.prepareSourceSnapshot)({
            bytes: input.bytes,
            mediaType: requestedMediaType,
            sourceType: document.sourceType,
            publishedPeriod: document.publishedPeriod,
            fetchedAt: input.fetchedAt,
            maxBytes: this.maxBytes,
        });
        if (document.sha256 !== null && document.sha256 !== preparedSnapshot.sha256) {
            throw (0, sources_errors_1.sourceSnapshotHashConflict)();
        }
        let cachePath = preparedSnapshot.cachePath;
        if (document.cachePath !== null && document.sha256 !== null) {
            if (!document.cachePath.startsWith(`${document.sourceType}/`)) {
                throw (0, sources_errors_1.sourceCachePathConflict)();
            }
            let persistedMediaType;
            try {
                persistedMediaType = (0, source_snapshot_1.assertPersistedCachePath)({
                    cachePath: document.cachePath,
                    sha256: document.sha256,
                    mediaType: document.mediaType,
                });
            }
            catch {
                throw (0, sources_errors_1.sourceCachePathConflict)();
            }
            if (persistedMediaType !== requestedMediaType)
                throw (0, sources_errors_1.sourceDataInvalid)();
            cachePath = document.cachePath;
        }
        const stored = await this.storage.uploadImmutableSnapshot({
            path: cachePath,
            bytes: preparedSnapshot.bytes,
            mediaType: preparedSnapshot.mediaType,
            sha256: preparedSnapshot.sha256,
            sourceDocumentId: input.sourceDocumentId,
        });
        if (stored.path !== cachePath ||
            stored.sha256 !== preparedSnapshot.sha256) {
            throw (0, sources_errors_1.sourceDataInvalid)();
        }
        const attached = await this.repository.attachSnapshot({
            sourceDocumentId: input.sourceDocumentId,
            sha256: preparedSnapshot.sha256,
            cachePath,
            fetchedAt: input.fetchedAt,
            httpStatus: input.httpStatus,
        });
        return {
            sourceDocumentId: attached.document.id,
            sha256: preparedSnapshot.sha256,
            cachePath,
            created: stored.created,
            attached: attached.attached,
            status: attached.document.status,
        };
    }
    async openSource(id, page) {
        const document = await this.repository.findForOpen(id);
        if (!document)
            throw (0, sources_errors_1.sourceDocumentNotFound)();
        if (document.cachePath === null || document.sha256 === null) {
            throw (0, sources_errors_1.sourceSnapshotNotAvailable)();
        }
        const mediaType = (0, source_snapshot_1.assertPersistedCachePath)({
            cachePath: document.cachePath,
            sha256: document.sha256,
            mediaType: document.mediaType,
        });
        if (page !== undefined && mediaType !== 'application/pdf') {
            throw (0, sources_errors_1.sourcePageNotSupported)();
        }
        const signedUrl = await this.storage.createSignedReadUrl(document.cachePath, this.signedUrlTtlSeconds);
        let location;
        try {
            location = new URL(signedUrl);
        }
        catch {
            throw (0, sources_errors_1.sourceDataInvalid)();
        }
        if (location.protocol !== 'https:')
            throw (0, sources_errors_1.sourceDataInvalid)();
        if (page !== undefined)
            location.hash = `page=${page}`;
        return { location: location.toString() };
    }
    async readCachedSourceSnapshot(sourceDocumentId) {
        const document = await this.repository.findForCache(sourceDocumentId);
        if (!document)
            throw (0, sources_errors_1.sourceDocumentNotFound)();
        if (document.cachePath === null || document.sha256 === null) {
            throw (0, sources_errors_1.sourceSnapshotNotAvailable)();
        }
        const mediaType = (0, source_snapshot_1.assertPersistedCachePath)({
            cachePath: document.cachePath,
            sha256: document.sha256,
            mediaType: document.mediaType,
        });
        const downloaded = await this.storage.download(document.cachePath);
        if (downloaded.byteLength > this.maxBytes)
            throw (0, sources_errors_1.sourceSnapshotTooLarge)();
        const bytes = Buffer.from(downloaded);
        const sha256 = (0, node_crypto_1.createHash)('sha256').update(bytes).digest('hex');
        if (sha256 !== document.sha256)
            throw (0, storage_errors_1.storageImmutabilityViolation)();
        return {
            bytes,
            mediaType,
            sha256,
            cachePath: document.cachePath,
        };
    }
};
exports.SourcesService = SourcesService;
exports.SourcesService = SourcesService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(storage_constants_1.SOURCE_STORAGE)),
    __metadata("design:paramtypes", [sources_repository_1.SourcesRepository, Object, config_1.ConfigService])
], SourcesService);
function assertCacheInput(input) {
    if (input.sourceDocumentId.length === 0 ||
        input.sourceDocumentId.trim() !== input.sourceDocumentId ||
        !Number.isInteger(input.httpStatus) ||
        input.httpStatus < 100 ||
        input.httpStatus > 599 ||
        !Number.isFinite(input.fetchedAt.getTime())) {
        throw (0, sources_errors_1.sourceDataInvalid)();
    }
}
//# sourceMappingURL=sources.service.js.map