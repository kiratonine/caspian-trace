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
exports.SafeFetchResponseCache = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let SafeFetchResponseCache = class SafeFetchResponseCache {
    entries = new Map();
    maximumEntries;
    maximumBytes;
    totalBytes = 0;
    constructor(config) {
        this.maximumEntries = config.getOrThrow('SAFE_FETCH_CACHE_MAX_ENTRIES');
        this.maximumBytes = config.getOrThrow('SAFE_FETCH_CACHE_MAX_BYTES');
    }
    get(key, nowMs) {
        const entry = this.entries.get(key);
        if (!entry)
            return null;
        if (nowMs > entry.staleUntilMs) {
            this.delete(key, entry);
            return null;
        }
        this.entries.delete(key);
        this.entries.set(key, entry);
        return {
            body: Buffer.from(entry.body),
            metadata: { ...entry.metadata },
            state: nowMs <= entry.expiresAtMs ? 'fresh' : 'stale',
        };
    }
    set(input) {
        if (input.body.length > this.maximumBytes)
            return;
        const existing = this.entries.get(input.key);
        if (existing)
            this.delete(input.key, existing);
        const expiresAtMs = input.nowMs + input.ttlMs;
        const staleUntilMs = expiresAtMs + input.staleIfErrorMs;
        if (!Number.isSafeInteger(expiresAtMs) || !Number.isSafeInteger(staleUntilMs)) {
            return;
        }
        const entry = {
            body: Buffer.from(input.body),
            metadata: { ...input.metadata },
            expiresAtMs,
            staleUntilMs,
            sizeBytes: input.body.length,
        };
        this.entries.set(input.key, entry);
        this.totalBytes += entry.sizeBytes;
        this.evictToBounds();
    }
    evictToBounds() {
        while (this.entries.size > this.maximumEntries ||
            this.totalBytes > this.maximumBytes) {
            const oldest = this.entries.entries().next().value;
            if (oldest === undefined)
                return;
            this.delete(oldest[0], oldest[1]);
        }
    }
    delete(key, entry) {
        if (!this.entries.delete(key))
            return;
        this.totalBytes -= entry.sizeBytes;
    }
};
exports.SafeFetchResponseCache = SafeFetchResponseCache;
exports.SafeFetchResponseCache = SafeFetchResponseCache = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SafeFetchResponseCache);
//# sourceMappingURL=response-cache.js.map