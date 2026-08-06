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
exports.SupabaseStorageService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const supabase_js_1 = require("@supabase/supabase-js");
const storage_errors_1 = require("./storage.errors");
const DUPLICATE_ERROR_CODES = new Set([
    'Duplicate',
    'ResourceAlreadyExists',
    'KeyAlreadyExists',
    'already_exists',
]);
const NOT_FOUND_ERROR_CODES = new Set([
    'NotFound',
    'ResourceNotFound',
    'ObjectNotFound',
    'KeyNotFound',
    'NoSuchKey',
    'not_found',
]);
let SupabaseStorageService = class SupabaseStorageService {
    client;
    bucket;
    constructor(config) {
        this.bucket = config.getOrThrow('SUPABASE_SOURCE_BUCKET');
        this.client = (0, supabase_js_1.createClient)(config.getOrThrow('SUPABASE_URL'), config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'), {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        });
    }
    async uploadImmutableSnapshot(input) {
        const { error } = await this.client.storage.from(this.bucket).upload(input.path, input.bytes, {
            contentType: input.mediaType,
            upsert: false,
            cacheControl: '31536000',
            metadata: {
                sha256: input.sha256,
                sourceDocumentId: input.sourceDocumentId,
            },
        });
        if (!error) {
            return { path: input.path, sha256: input.sha256, created: true };
        }
        if (!isDuplicateError(error))
            throw (0, storage_errors_1.storageUnavailable)();
        const existing = await this.download(input.path);
        const actualSha = (0, node_crypto_1.createHash)('sha256').update(existing).digest('hex');
        if (actualSha !== input.sha256)
            throw (0, storage_errors_1.storageImmutabilityViolation)();
        return { path: input.path, sha256: input.sha256, created: false };
    }
    async createSignedReadUrl(path, expiresInSeconds) {
        const { data, error } = await this.client.storage
            .from(this.bucket)
            .createSignedUrl(path, expiresInSeconds);
        if (error || !data?.signedUrl)
            throw (0, storage_errors_1.storageUnavailable)();
        let parsed;
        try {
            parsed = new URL(data.signedUrl);
        }
        catch {
            throw (0, storage_errors_1.storageUnavailable)();
        }
        if (parsed.protocol !== 'https:')
            throw (0, storage_errors_1.storageUnavailable)();
        return parsed.toString();
    }
    async exists(path) {
        const { error } = await this.client.storage.from(this.bucket).download(path);
        if (!error)
            return true;
        if (isNotFoundError(error))
            return false;
        throw (0, storage_errors_1.storageUnavailable)();
    }
    async download(path) {
        const { data, error } = await this.client.storage
            .from(this.bucket)
            .download(path);
        if (error || !data)
            throw (0, storage_errors_1.storageUnavailable)();
        try {
            return Buffer.from(await data.arrayBuffer());
        }
        catch {
            throw (0, storage_errors_1.storageUnavailable)();
        }
    }
};
exports.SupabaseStorageService = SupabaseStorageService;
exports.SupabaseStorageService = SupabaseStorageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SupabaseStorageService);
function isDuplicateError(error) {
    return hasHttpStatus(error, 409) || hasErrorCode(error, DUPLICATE_ERROR_CODES);
}
function isNotFoundError(error) {
    return hasHttpStatus(error, 404) || hasErrorCode(error, NOT_FOUND_ERROR_CODES);
}
function hasHttpStatus(error, expected) {
    return [error.status, error.statusCode].some((value) => value === expected ||
        (typeof value === 'string' && value === String(expected)));
}
function hasErrorCode(error, expectedCodes) {
    return [error.error, error.code, error.status, error.statusCode].some((value) => typeof value === 'string' && expectedCodes.has(value));
}
//# sourceMappingURL=supabase-storage.service.js.map