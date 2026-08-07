"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafeFetchModule = void 0;
const common_1 = require("@nestjs/common");
const safe_fetch_constants_1 = require("./safe-fetch/safe-fetch.constants");
const node_dns_resolver_service_1 = require("./safe-fetch/node-dns-resolver.service");
const node_https_transport_service_1 = require("./safe-fetch/node-https-transport.service");
const response_cache_1 = require("./safe-fetch/response-cache");
const safe_fetch_runtime_1 = require("./safe-fetch/safe-fetch.runtime");
const safe_fetch_service_1 = require("./safe-fetch/safe-fetch.service");
let SafeFetchModule = class SafeFetchModule {
};
exports.SafeFetchModule = SafeFetchModule;
exports.SafeFetchModule = SafeFetchModule = __decorate([
    (0, common_1.Module)({
        providers: [
            safe_fetch_service_1.SafeFetchService,
            response_cache_1.SafeFetchResponseCache,
            node_dns_resolver_service_1.NodeDnsResolverService,
            node_https_transport_service_1.NodeHttpsTransportService,
            safe_fetch_runtime_1.SystemSafeFetchRuntime,
            { provide: safe_fetch_constants_1.SAFE_FETCH_DNS_RESOLVER, useExisting: node_dns_resolver_service_1.NodeDnsResolverService },
            { provide: safe_fetch_constants_1.SAFE_FETCH_TRANSPORT, useExisting: node_https_transport_service_1.NodeHttpsTransportService },
            { provide: safe_fetch_constants_1.SAFE_FETCH_RUNTIME, useExisting: safe_fetch_runtime_1.SystemSafeFetchRuntime },
            { provide: safe_fetch_constants_1.SAFE_FETCH_HTTPS_REQUEST, useValue: node_https_transport_service_1.nodeHttpsRequestFactory },
        ],
        exports: [safe_fetch_service_1.SafeFetchService],
    })
], SafeFetchModule);
//# sourceMappingURL=safe-fetch.module.js.map