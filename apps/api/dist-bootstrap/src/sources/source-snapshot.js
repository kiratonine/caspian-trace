"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSourceMediaType = normalizeSourceMediaType;
exports.prepareSourceSnapshot = prepareSourceSnapshot;
exports.assertPersistedCachePath = assertPersistedCachePath;
exports.normalizePersistedMediaType = normalizePersistedMediaType;
const node_crypto_1 = require("node:crypto");
const sources_errors_1 = require("./sources.errors");
const storage_constants_1 = require("./storage/storage.constants");
const SOURCE_TYPE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const PERIOD_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const SHA_PATTERN = /^[0-9a-f]{64}$/;
function normalizeSourceMediaType(mediaType) {
    const normalized = mediaType.split(';', 1)[0]?.trim().toLowerCase();
    if (normalized === undefined ||
        !Object.hasOwn(storage_constants_1.SOURCE_MEDIA_EXTENSIONS, normalized)) {
        throw (0, sources_errors_1.sourceMediaTypeUnsupported)();
    }
    return normalized;
}
function prepareSourceSnapshot(input) {
    if (input.bytes.length === 0)
        throw (0, sources_errors_1.sourceDataInvalid)();
    if (input.bytes.length > input.maxBytes)
        throw (0, sources_errors_1.sourceSnapshotTooLarge)();
    if (!SOURCE_TYPE_PATTERN.test(input.sourceType)) {
        throw (0, sources_errors_1.sourceInputInvalid)('SOURCE_TYPE_PATH_INVALID', 'Source type cannot be used in a storage path');
    }
    if (!Number.isFinite(input.fetchedAt.getTime()))
        throw (0, sources_errors_1.sourceDataInvalid)();
    const mediaType = normalizeSourceMediaType(input.mediaType);
    if (mediaType === 'application/pdf' &&
        !input.bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
        throw (0, sources_errors_1.sourceInputInvalid)('SOURCE_PDF_SIGNATURE_INVALID', 'Source PDF signature is invalid');
    }
    const [year, month] = resolveYearMonth(input.publishedPeriod, input.fetchedAt);
    const sha256 = (0, node_crypto_1.createHash)('sha256').update(input.bytes).digest('hex');
    const extension = storage_constants_1.SOURCE_MEDIA_EXTENSIONS[mediaType];
    return {
        bytes: input.bytes,
        mediaType,
        sha256,
        cachePath: `${input.sourceType}/${year}/${month}/${sha256}.${extension}`,
    };
}
function assertPersistedCachePath(input) {
    if (!SHA_PATTERN.test(input.sha256))
        throw (0, sources_errors_1.sourceDataInvalid)();
    const mediaType = normalizePersistedMediaType(input.mediaType);
    const extension = storage_constants_1.SOURCE_MEDIA_EXTENSIONS[mediaType];
    const pathPattern = new RegExp(`^[a-z0-9][a-z0-9_-]{0,63}/\\d{4}/(?:0[1-9]|1[0-2])/${input.sha256}\\.${extension}$`);
    if (!pathPattern.test(input.cachePath))
        throw (0, sources_errors_1.sourceDataInvalid)();
    return mediaType;
}
function normalizePersistedMediaType(mediaType) {
    try {
        return normalizeSourceMediaType(mediaType);
    }
    catch {
        throw (0, sources_errors_1.sourceDataInvalid)();
    }
}
function resolveYearMonth(publishedPeriod, fetchedAt) {
    if (publishedPeriod !== null) {
        const match = PERIOD_PATTERN.exec(publishedPeriod);
        if (!match?.[1] || !match[2])
            throw (0, sources_errors_1.sourceDataInvalid)();
        return [match[1], match[2]];
    }
    return [
        String(fetchedAt.getUTCFullYear()).padStart(4, '0'),
        String(fetchedAt.getUTCMonth() + 1).padStart(2, '0'),
    ];
}
//# sourceMappingURL=source-snapshot.js.map