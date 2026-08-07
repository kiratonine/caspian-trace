"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicIngestionError = exports.KazhydrometIngestionError = void 0;
exports.kazhydrometError = kazhydrometError;
exports.publicIngestionError = publicIngestionError;
class KazhydrometIngestionError extends Error {
    code;
    safeMessage;
    rateLimited;
    constructor(code, safeMessage, rateLimited = false) {
        super(safeMessage);
        this.code = code;
        this.safeMessage = safeMessage;
        this.rateLimited = rateLimited;
        this.name = 'KazhydrometIngestionError';
    }
}
exports.KazhydrometIngestionError = KazhydrometIngestionError;
function kazhydrometError(code, safeMessage, rateLimited = false) {
    return new KazhydrometIngestionError(code, safeMessage, rateLimited);
}
class PublicIngestionError extends Error {
    code;
    safeMessage;
    rateLimited;
    constructor(code, safeMessage, rateLimited = false) {
        super(safeMessage);
        this.code = code;
        this.safeMessage = safeMessage;
        this.rateLimited = rateLimited;
        this.name = 'PublicIngestionError';
    }
}
exports.PublicIngestionError = PublicIngestionError;
function publicIngestionError(code, safeMessage, rateLimited = false) {
    return new PublicIngestionError(code, safeMessage, rateLimited);
}
//# sourceMappingURL=ingestion.errors.js.map