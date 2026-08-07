"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSafeFetchPolicy = validateSafeFetchPolicy;
exports.validateSafeFetchUrl = validateSafeFetchUrl;
exports.buildSafeFetchCacheKey = buildSafeFetchCacheKey;
const node_net_1 = require("node:net");
const safe_fetch_constants_1 = require("./safe-fetch.constants");
const safe_fetch_errors_1 = require("./safe-fetch.errors");
const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/;
function validateSafeFetchPolicy(policy, ceilings) {
    if (typeof policy !== 'object' ||
        policy === null ||
        !Array.isArray(policy.allowedHosts) ||
        policy.allowedHosts.length === 0 ||
        !Array.isArray(policy.expectedContentTypes) ||
        policy.expectedContentTypes.length === 0) {
        throw policyInvalid();
    }
    const allowedHosts = [...new Set(policy.allowedHosts)];
    if (allowedHosts.length !== policy.allowedHosts.length ||
        allowedHosts.some((hostname) => typeof hostname !== 'string' ||
            hostname !== hostname.toLowerCase() ||
            hostname.endsWith('.') ||
            isIpLiteral(hostname) ||
            !HOSTNAME_PATTERN.test(hostname))) {
        throw policyInvalid();
    }
    const expectedContentTypes = [...new Set(policy.expectedContentTypes)];
    if (expectedContentTypes.length !== policy.expectedContentTypes.length ||
        expectedContentTypes.some((contentType) => typeof contentType !== 'string' ||
            !safe_fetch_constants_1.SAFE_FETCH_SUPPORTED_CONTENT_TYPES.has(contentType))) {
        throw policyInvalid();
    }
    const maxBytes = policy.maxBytes ?? ceilings.maxBytes;
    const timeoutMs = policy.timeoutMs ?? ceilings.timeoutMs;
    if (!Number.isSafeInteger(maxBytes) ||
        maxBytes < 1 ||
        maxBytes > ceilings.maxBytes ||
        !Number.isSafeInteger(timeoutMs) ||
        timeoutMs < 1 ||
        timeoutMs > ceilings.timeoutMs) {
        throw policyInvalid();
    }
    const cache = policy.cache ?? {
        enabled: false,
        ttlMs: 1,
        staleIfErrorMs: 0,
    };
    if (typeof cache !== 'object' ||
        cache === null ||
        typeof cache.enabled !== 'boolean' ||
        !Number.isSafeInteger(cache.ttlMs) ||
        cache.ttlMs < 1 ||
        !Number.isSafeInteger(cache.staleIfErrorMs) ||
        cache.staleIfErrorMs < 0) {
        throw policyInvalid();
    }
    return {
        allowedHosts: allowedHosts.sort(),
        expectedContentTypes: expectedContentTypes.sort(),
        maxBytes,
        timeoutMs,
        cache: { ...cache },
    };
}
function validateSafeFetchUrl(input, allowedHosts) {
    if (!(input instanceof URL)) {
        throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_URL_INVALID', 'Source URL is invalid');
    }
    const url = new URL(input.toString());
    if (url.protocol !== 'https:') {
        throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_HTTPS_REQUIRED', 'Source URL must use HTTPS');
    }
    if (url.username !== '' || url.password !== '') {
        throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_CREDENTIALS_NOT_ALLOWED', 'Source URL credentials are not allowed');
    }
    if (url.port !== '' && url.port !== '443') {
        throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_PORT_NOT_ALLOWED', 'Source URL port is not allowed');
    }
    if (url.hash !== '' || url.hostname === '') {
        throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_URL_INVALID', 'Source URL is invalid');
    }
    if (isIpLiteral(url.hostname)) {
        throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_IP_LITERAL_NOT_ALLOWED', 'Source URL IP literals are not allowed');
    }
    if (url.hostname.endsWith('.')) {
        throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_HOST_NOT_ALLOWED', 'Source hostname is not allowed');
    }
    if (!allowedHosts.includes(url.hostname)) {
        throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_HOST_NOT_ALLOWED', 'Source hostname is not allowed');
    }
    return url;
}
function buildSafeFetchCacheKey(url, policy, representation) {
    return JSON.stringify({
        url: url.toString(),
        allowedHosts: policy.allowedHosts,
        expectedContentTypes: policy.expectedContentTypes,
        maxBytes: policy.maxBytes,
        representation,
    });
}
function isIpLiteral(hostname) {
    const unwrapped = hostname.startsWith('[') && hostname.endsWith(']')
        ? hostname.slice(1, -1)
        : hostname;
    return (0, node_net_1.isIP)(unwrapped) !== 0;
}
function policyInvalid() {
    return (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_POLICY_INVALID', 'Safe fetch policy is invalid');
}
//# sourceMappingURL=safe-url.js.map