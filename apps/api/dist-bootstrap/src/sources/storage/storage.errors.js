"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageUnavailable = storageUnavailable;
exports.storageImmutabilityViolation = storageImmutabilityViolation;
const common_1 = require("@nestjs/common");
function storageUnavailable() {
    return new common_1.ServiceUnavailableException({
        code: 'SOURCE_STORAGE_UNAVAILABLE',
        message: 'Source storage is unavailable',
    });
}
function storageImmutabilityViolation() {
    return new common_1.ServiceUnavailableException({
        code: 'STORAGE_IMMUTABILITY_VIOLATION',
        message: 'Stored source snapshot failed integrity verification',
    });
}
//# sourceMappingURL=storage.errors.js.map