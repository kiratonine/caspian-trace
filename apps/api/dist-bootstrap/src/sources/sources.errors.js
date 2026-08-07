"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourceDocumentNotFound = sourceDocumentNotFound;
exports.sourceSnapshotNotAvailable = sourceSnapshotNotAvailable;
exports.sourcePageNotSupported = sourcePageNotSupported;
exports.sourceMediaTypeUnsupported = sourceMediaTypeUnsupported;
exports.sourceSnapshotTooLarge = sourceSnapshotTooLarge;
exports.sourceSnapshotHashConflict = sourceSnapshotHashConflict;
exports.sourceCachePathConflict = sourceCachePathConflict;
exports.sourceDataInvalid = sourceDataInvalid;
exports.sourceInputInvalid = sourceInputInvalid;
const common_1 = require("@nestjs/common");
function sourceDocumentNotFound() {
    return new common_1.NotFoundException({
        code: 'SOURCE_DOCUMENT_NOT_FOUND',
        message: 'Source document not found',
    });
}
function sourceSnapshotNotAvailable() {
    return new common_1.NotFoundException({
        code: 'SOURCE_SNAPSHOT_NOT_AVAILABLE',
        message: 'Source snapshot is not available',
    });
}
function sourcePageNotSupported() {
    return new common_1.BadRequestException({
        code: 'SOURCE_PAGE_NOT_SUPPORTED',
        message: 'Page is supported only for PDF snapshots',
    });
}
function sourceMediaTypeUnsupported() {
    return new common_1.BadRequestException({
        code: 'SOURCE_MEDIA_TYPE_UNSUPPORTED',
        message: 'Source media type is unsupported',
    });
}
function sourceSnapshotTooLarge() {
    return new common_1.PayloadTooLargeException({
        code: 'SOURCE_SNAPSHOT_TOO_LARGE',
        message: 'Source snapshot is too large',
    });
}
function sourceSnapshotHashConflict() {
    return new common_1.ConflictException({
        code: 'SOURCE_SNAPSHOT_HASH_CONFLICT',
        message: 'Source document is already bound to another snapshot hash',
    });
}
function sourceCachePathConflict() {
    return new common_1.ConflictException({
        code: 'SOURCE_CACHE_PATH_CONFLICT',
        message: 'Source document is already bound to another cache path',
    });
}
function sourceDataInvalid() {
    return new common_1.InternalServerErrorException({
        code: 'SOURCE_DATA_INVALID',
        message: 'Stored source data is invalid',
    });
}
function sourceInputInvalid(code, message) {
    return new common_1.BadRequestException({ code, message });
}
//# sourceMappingURL=sources.errors.js.map