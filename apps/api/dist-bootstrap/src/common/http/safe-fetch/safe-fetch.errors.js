"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafeFetchError = void 0;
exports.safeFetchError = safeFetchError;
class SafeFetchError extends Error {
    code;
    safeMessage;
    statusCode;
    retryable;
    sourceStatus;
    retryAfter;
    constructor(input) {
        super(input.safeMessage);
        this.name = 'SafeFetchError';
        this.code = input.code;
        this.safeMessage = input.safeMessage;
        this.statusCode = input.statusCode;
        this.retryable = input.retryable ?? false;
        this.sourceStatus = input.sourceStatus;
        this.retryAfter = input.retryAfter;
    }
}
exports.SafeFetchError = SafeFetchError;
function safeFetchError(code, safeMessage, options = {}) {
    return new SafeFetchError({ code, safeMessage, ...options });
}
//# sourceMappingURL=safe-fetch.errors.js.map