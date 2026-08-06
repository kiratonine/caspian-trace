"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAFE_FETCH_HTTPS_REQUEST = exports.SAFE_FETCH_RUNTIME = exports.SAFE_FETCH_TRANSPORT = exports.SAFE_FETCH_DNS_RESOLVER = exports.SAFE_FETCH_SUPPORTED_CONTENT_TYPES = exports.SAFE_FETCH_REDIRECT_STATUSES = exports.SAFE_FETCH_RETRYABLE_STATUSES = exports.SAFE_FETCH_MAX_RETRIES = exports.SAFE_FETCH_MAX_REDIRECTS = void 0;
exports.SAFE_FETCH_MAX_REDIRECTS = 3;
exports.SAFE_FETCH_MAX_RETRIES = 1;
exports.SAFE_FETCH_RETRYABLE_STATUSES = new Set([
    408, 429, 500, 502, 503, 504,
]);
exports.SAFE_FETCH_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
exports.SAFE_FETCH_SUPPORTED_CONTENT_TYPES = new Set([
    'application/pdf',
    'text/html',
    'application/json',
    'text/plain',
]);
exports.SAFE_FETCH_DNS_RESOLVER = Symbol('SAFE_FETCH_DNS_RESOLVER');
exports.SAFE_FETCH_TRANSPORT = Symbol('SAFE_FETCH_TRANSPORT');
exports.SAFE_FETCH_RUNTIME = Symbol('SAFE_FETCH_RUNTIME');
exports.SAFE_FETCH_HTTPS_REQUEST = Symbol('SAFE_FETCH_HTTPS_REQUEST');
//# sourceMappingURL=safe-fetch.constants.js.map