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
exports.SafeFetchService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const safe_fetch_constants_1 = require("./safe-fetch.constants");
const safe_fetch_errors_1 = require("./safe-fetch.errors");
const public_ip_1 = require("./public-ip");
const response_cache_1 = require("./response-cache");
const retry_policy_1 = require("./retry-policy");
const safe_url_1 = require("./safe-url");
let SafeFetchService = class SafeFetchService {
    dnsResolver;
    transport;
    cache;
    runtime;
    maximumBytes;
    maximumTimeoutMs;
    userAgent;
    retryBaseDelayMs;
    retryMaximumDelayMs;
    constructor(config, dnsResolver, transport, cache, runtime) {
        this.dnsResolver = dnsResolver;
        this.transport = transport;
        this.cache = cache;
        this.runtime = runtime;
        this.maximumBytes = config.getOrThrow('HTTP_MAX_BYTES');
        this.maximumTimeoutMs = config.getOrThrow('HTTP_TIMEOUT_MS');
        this.userAgent = config.getOrThrow('SAFE_FETCH_USER_AGENT');
        this.retryBaseDelayMs = config.getOrThrow('SAFE_FETCH_RETRY_BASE_DELAY_MS');
        this.retryMaximumDelayMs = config.getOrThrow('SAFE_FETCH_RETRY_MAX_DELAY_MS');
    }
    async fetchBuffer(url, policy) {
        const result = await this.fetchRepresentation(url, policy, 'buffer', (body) => Buffer.from(body));
        return { body: result.value, metadata: result.metadata };
    }
    async fetchText(url, policy) {
        const result = await this.fetchRepresentation(url, policy, 'text', decodeUtf8);
        return { text: result.value, metadata: result.metadata };
    }
    async fetchJson(url, schema, policy) {
        const result = await this.fetchRepresentation(url, policy, 'json', (body) => decodeAndValidateJson(body, schema));
        return { data: result.value, metadata: result.metadata };
    }
    async fetchRepresentation(inputUrl, inputPolicy, representation, validate) {
        const policy = (0, safe_url_1.validateSafeFetchPolicy)(inputPolicy, {
            maxBytes: this.maximumBytes,
            timeoutMs: this.maximumTimeoutMs,
        });
        const requestedUrl = (0, safe_url_1.validateSafeFetchUrl)(inputUrl, policy.allowedHosts);
        const cacheKey = (0, safe_url_1.buildSafeFetchCacheKey)(requestedUrl, policy, representation);
        if (policy.cache.enabled) {
            const cached = this.cache.get(cacheKey, this.runtime.now());
            if (cached?.state === 'fresh') {
                return {
                    value: validate(cached.body),
                    metadata: {
                        ...cached.metadata,
                        cacheStatus: 'fresh',
                        sourceStatus: 'healthy',
                    },
                };
            }
        }
        try {
            const network = await this.fetchWithRetry(requestedUrl, policy);
            const value = validate(network.body);
            if (policy.cache.enabled) {
                this.cache.set({
                    key: cacheKey,
                    body: network.body,
                    metadata: network.metadata,
                    nowMs: this.runtime.now(),
                    ttlMs: policy.cache.ttlMs,
                    staleIfErrorMs: policy.cache.staleIfErrorMs,
                });
            }
            return {
                value,
                metadata: {
                    ...network.metadata,
                    cacheStatus: 'miss',
                    sourceStatus: 'healthy',
                },
            };
        }
        catch (error) {
            const normalized = normalizeNetworkError(error);
            if (policy.cache.enabled && normalized.retryable) {
                const cached = this.cache.get(cacheKey, this.runtime.now());
                if (cached?.state === 'stale') {
                    return {
                        value: validate(cached.body),
                        metadata: {
                            ...cached.metadata,
                            cacheStatus: 'stale',
                            sourceStatus: normalized.sourceStatus === 'rate_limited'
                                ? 'rate_limited'
                                : 'degraded',
                        },
                    };
                }
            }
            throw normalized;
        }
    }
    async fetchWithRetry(requestedUrl, policy) {
        let lastError;
        for (let retryIndex = 0; retryIndex <= safe_fetch_constants_1.SAFE_FETCH_MAX_RETRIES; retryIndex += 1) {
            try {
                const result = await this.fetchAttempt(requestedUrl, policy);
                return {
                    body: result.body,
                    metadata: {
                        requestedUrl: requestedUrl.toString(),
                        finalUrl: result.finalUrl.toString(),
                        statusCode: result.statusCode,
                        contentType: result.contentType,
                        fetchedAt: new Date(this.runtime.now()).toISOString(),
                        redirects: result.redirects,
                        attempts: retryIndex + 1,
                    },
                };
            }
            catch (error) {
                const normalized = normalizeNetworkError(error);
                lastError = normalized;
                if (!normalized.retryable || retryIndex === safe_fetch_constants_1.SAFE_FETCH_MAX_RETRIES) {
                    throw normalized;
                }
                const retryAfter = normalized.code === 'SAFE_FETCH_RATE_LIMITED'
                    ? (0, retry_policy_1.parseRetryAfterMilliseconds)(normalized.retryAfter, this.runtime.now(), this.retryMaximumDelayMs)
                    : null;
                const delayMs = retryAfter ??
                    (0, retry_policy_1.calculateBackoffMilliseconds)({
                        retryIndex,
                        baseDelayMs: this.retryBaseDelayMs,
                        maximumDelayMs: this.retryMaximumDelayMs,
                        random: this.runtime.random(),
                    });
                await this.runtime.sleep(delayMs);
            }
        }
        throw lastError ?? networkError();
    }
    async fetchAttempt(requestedUrl, policy) {
        let currentUrl = requestedUrl;
        let redirects = 0;
        while (true) {
            currentUrl = (0, safe_url_1.validateSafeFetchUrl)(currentUrl, policy.allowedHosts);
            const response = await this.resolveAndRequestWithTimeout(currentUrl, policy);
            if (safe_fetch_constants_1.SAFE_FETCH_REDIRECT_STATUSES.has(response.statusCode)) {
                if (redirects === safe_fetch_constants_1.SAFE_FETCH_MAX_REDIRECTS) {
                    throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_TOO_MANY_REDIRECTS', 'Source returned too many redirects');
                }
                if (typeof response.location !== 'string' || response.location === '') {
                    throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_REDIRECT_INVALID', 'Source redirect is invalid');
                }
                try {
                    currentUrl = new URL(response.location, currentUrl);
                }
                catch {
                    throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_REDIRECT_INVALID', 'Source redirect is invalid');
                }
                redirects += 1;
                continue;
            }
            if (response.statusCode < 200 || response.statusCode > 299) {
                throw statusError(response);
            }
            if (response.contentType === undefined) {
                throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_CONTENT_TYPE_MISMATCH', 'Source content type does not match the expected type');
            }
            return {
                body: response.body,
                finalUrl: currentUrl,
                statusCode: response.statusCode,
                contentType: response.contentType,
                redirects,
            };
        }
    }
    async resolveAndPin(hostname) {
        const addresses = await this.dnsResolver.resolveAll(hostname);
        if (addresses.length === 0) {
            throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_DNS_RESOLUTION_FAILED', 'Source hostname could not be resolved');
        }
        if (addresses.some(({ address }) => !(0, public_ip_1.isPublicIpAddress)(address))) {
            throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_PRIVATE_ADDRESS_BLOCKED', 'Source hostname resolves to a blocked address');
        }
        const selected = addresses[0];
        if (selected === undefined) {
            throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_DNS_RESOLUTION_FAILED', 'Source hostname could not be resolved');
        }
        return selected;
    }
    async resolveAndRequestWithTimeout(url, policy) {
        const controller = new AbortController();
        let timer;
        const timeout = new Promise((_resolve, reject) => {
            timer = setTimeout(() => {
                controller.abort();
                reject(timeoutError());
            }, policy.timeoutMs);
        });
        const request = async () => {
            const pinnedAddress = await this.resolveAndPin(url.hostname);
            if (controller.signal.aborted)
                throw timeoutError();
            return await this.transport.request({
                url,
                pinnedAddress,
                signal: controller.signal,
                userAgent: this.userAgent,
                expectedContentTypes: policy.expectedContentTypes,
                maxBytes: policy.maxBytes,
            });
        };
        try {
            return await Promise.race([request(), timeout]);
        }
        catch (error) {
            if (controller.signal.aborted)
                throw timeoutError();
            throw normalizeNetworkError(error);
        }
        finally {
            if (timer !== undefined)
                clearTimeout(timer);
        }
    }
};
exports.SafeFetchService = SafeFetchService;
exports.SafeFetchService = SafeFetchService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(safe_fetch_constants_1.SAFE_FETCH_DNS_RESOLVER)),
    __param(2, (0, common_1.Inject)(safe_fetch_constants_1.SAFE_FETCH_TRANSPORT)),
    __param(4, (0, common_1.Inject)(safe_fetch_constants_1.SAFE_FETCH_RUNTIME)),
    __metadata("design:paramtypes", [config_1.ConfigService, Object, Object, response_cache_1.SafeFetchResponseCache, Object])
], SafeFetchService);
function timeoutError() {
    return (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_TIMEOUT', 'Source request timed out', {
        retryable: true,
        sourceStatus: 'degraded',
    });
}
function decodeUtf8(body) {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(body);
    }
    catch {
        throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_TEXT_DECODING_FAILED', 'Source response is not valid UTF-8 text');
    }
}
function decodeAndValidateJson(body, schema) {
    let json;
    try {
        json = JSON.parse(decodeUtf8(body));
    }
    catch (error) {
        if (error instanceof safe_fetch_errors_1.SafeFetchError)
            throw error;
        throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_JSON_INVALID', 'Source response is not valid JSON');
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
        throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_RESPONSE_SCHEMA_INVALID', 'Source response does not match the expected schema');
    }
    return parsed.data;
}
function statusError(response) {
    if (response.statusCode === 429) {
        return (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_RATE_LIMITED', 'Source rate limit was reached', {
            statusCode: 429,
            retryable: true,
            sourceStatus: 'rate_limited',
            retryAfter: response.retryAfter,
        });
    }
    const retryable = safe_fetch_constants_1.SAFE_FETCH_RETRYABLE_STATUSES.has(response.statusCode);
    return (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_HTTP_ERROR', 'Source returned an HTTP error', {
        statusCode: response.statusCode,
        retryable,
        sourceStatus: retryable ? 'degraded' : undefined,
    });
}
function normalizeNetworkError(error) {
    if (error instanceof safe_fetch_errors_1.SafeFetchError)
        return error;
    if (isTlsError(error)) {
        return (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_TLS_ERROR', 'Source TLS verification failed');
    }
    return networkError();
}
function networkError() {
    return (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_NETWORK_ERROR', 'Source network request failed', { retryable: true, sourceStatus: 'degraded' });
}
function isTlsError(error) {
    if (!(error instanceof Error) || !('code' in error))
        return false;
    const code = error.code;
    return (typeof code === 'string' &&
        (code.startsWith('ERR_TLS_') ||
            code.startsWith('CERT_') ||
            code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
            code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
            code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
            code === 'ERR_TLS_CERT_ALTNAME_INVALID'));
}
//# sourceMappingURL=safe-fetch.service.js.map