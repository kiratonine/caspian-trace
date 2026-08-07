"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nodeHttpsRequestFactory = exports.NodeHttpsTransportService = void 0;
exports.normalizeContentType = normalizeContentType;
const https = __importStar(require("node:https"));
const common_1 = require("@nestjs/common");
const safe_fetch_constants_1 = require("./safe-fetch.constants");
const safe_fetch_errors_1 = require("./safe-fetch.errors");
let NodeHttpsTransportService = class NodeHttpsTransportService {
    requestFactory;
    constructor(requestFactory) {
        this.requestFactory = requestFactory;
    }
    async request(input) {
        if (input.signal.aborted)
            throw timeoutError();
        const lookup = (_hostname, options, callback) => {
            if (options.all === true) {
                callback(null, [input.pinnedAddress]);
                return;
            }
            callback(null, input.pinnedAddress.address, input.pinnedAddress.family);
        };
        return await new Promise((resolve, reject) => {
            let settled = false;
            let response;
            let request;
            const cleanup = () => {
                input.signal.removeEventListener('abort', onAbort);
            };
            const resolveOnce = (value) => {
                if (settled)
                    return;
                settled = true;
                cleanup();
                resolve(value);
            };
            const rejectOnce = (error) => {
                if (settled)
                    return;
                settled = true;
                cleanup();
                reject(error);
            };
            const onAbort = () => {
                response?.destroy();
                request?.destroy();
                rejectOnce(timeoutError());
            };
            try {
                request = this.requestFactory({
                    protocol: 'https:',
                    hostname: input.url.hostname,
                    port: 443,
                    path: `${input.url.pathname}${input.url.search}`,
                    method: 'GET',
                    servername: input.url.hostname,
                    rejectUnauthorized: true,
                    lookup,
                    signal: input.signal,
                    headers: {
                        Host: input.url.hostname,
                        'User-Agent': input.userAgent,
                        Accept: input.expectedContentTypes.join(', '),
                        'Accept-Encoding': 'identity',
                        Connection: 'close',
                    },
                }, (incoming) => {
                    response = incoming;
                    this.handleResponse(incoming, input, request, resolveOnce, rejectOnce);
                });
            }
            catch (error) {
                rejectOnce(toError(error));
                return;
            }
            request.once('error', (error) => {
                rejectOnce(input.signal.aborted ? timeoutError() : error);
            });
            input.signal.addEventListener('abort', onAbort, { once: true });
            request.end();
        });
    }
    handleResponse(response, input, request, resolve, reject) {
        const statusCode = response.statusCode;
        if (statusCode === undefined || statusCode < 100 || statusCode > 599) {
            response.destroy();
            request?.destroy();
            reject((0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_NETWORK_ERROR', 'Source returned an invalid HTTP response', { retryable: true, sourceStatus: 'degraded' }));
            return;
        }
        const location = response.headers.location;
        const retryAfter = singleHeader(response.headers['retry-after']);
        if (safe_fetch_constants_1.SAFE_FETCH_REDIRECT_STATUSES.has(statusCode) || statusCode < 200 || statusCode > 299) {
            response.destroy();
            resolve({
                statusCode,
                location,
                retryAfter,
                body: Buffer.alloc(0),
            });
            return;
        }
        const rawContentType = singleHeader(response.headers['content-type']);
        const contentType = normalizeContentType(rawContentType);
        if (contentType === null ||
            !input.expectedContentTypes.includes(contentType)) {
            response.destroy();
            request?.destroy();
            reject((0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_CONTENT_TYPE_MISMATCH', 'Source content type does not match the expected type'));
            return;
        }
        const contentLength = parseContentLength(response.headers['content-length']);
        if (contentLength !== null && contentLength > input.maxBytes) {
            response.destroy();
            request?.destroy();
            reject(responseTooLarge());
            return;
        }
        const chunks = [];
        let receivedBytes = 0;
        response.on('data', (chunk) => {
            const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            receivedBytes += bytes.length;
            if (receivedBytes > input.maxBytes) {
                response.destroy();
                request?.destroy();
                reject(responseTooLarge());
                return;
            }
            chunks.push(bytes);
        });
        response.once('end', () => {
            resolve({
                statusCode,
                contentType,
                body: Buffer.concat(chunks, receivedBytes),
            });
        });
        response.once('error', (error) => {
            reject(input.signal.aborted ? timeoutError() : error);
        });
        response.once('aborted', () => {
            request?.destroy();
            reject((0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_NETWORK_ERROR', 'Source response stream was interrupted', { retryable: true, sourceStatus: 'degraded' }));
        });
    }
};
exports.NodeHttpsTransportService = NodeHttpsTransportService;
exports.NodeHttpsTransportService = NodeHttpsTransportService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(safe_fetch_constants_1.SAFE_FETCH_HTTPS_REQUEST)),
    __metadata("design:paramtypes", [Function])
], NodeHttpsTransportService);
const nodeHttpsRequestFactory = (options, onResponse) => https.request(options, onResponse);
exports.nodeHttpsRequestFactory = nodeHttpsRequestFactory;
function normalizeContentType(value) {
    if (value === undefined)
        return null;
    const mediaType = value.split(';', 1)[0]?.trim().toLowerCase();
    return mediaType && /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mediaType)
        ? mediaType
        : null;
}
function singleHeader(value) {
    return typeof value === 'string' ? value : undefined;
}
function parseContentLength(value) {
    const header = singleHeader(value);
    if (header === undefined || !/^\d+$/.test(header))
        return null;
    const parsed = Number(header);
    return Number.isSafeInteger(parsed) ? parsed : null;
}
function responseTooLarge() {
    return (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_RESPONSE_TOO_LARGE', 'Source response is too large');
}
function timeoutError() {
    return (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_TIMEOUT', 'Source request timed out', {
        retryable: true,
        sourceStatus: 'degraded',
    });
}
function toError(value) {
    return value instanceof Error
        ? value
        : new Error('Safe fetch transport failed');
}
//# sourceMappingURL=node-https-transport.service.js.map