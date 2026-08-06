"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeDnsResolverService = void 0;
const promises_1 = require("node:dns/promises");
const node_net_1 = require("node:net");
const common_1 = require("@nestjs/common");
const safe_fetch_errors_1 = require("./safe-fetch.errors");
let NodeDnsResolverService = class NodeDnsResolverService {
    async resolveAll(hostname) {
        let records;
        try {
            records = await (0, promises_1.lookup)(hostname, { all: true, verbatim: true });
        }
        catch {
            throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_DNS_RESOLUTION_FAILED', 'Source hostname could not be resolved');
        }
        if (records.length === 0) {
            throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_DNS_RESOLUTION_FAILED', 'Source hostname could not be resolved');
        }
        return records.map((record) => {
            const family = (0, node_net_1.isIP)(record.address);
            if ((family !== 4 && family !== 6) || family !== record.family) {
                throw (0, safe_fetch_errors_1.safeFetchError)('SAFE_FETCH_DNS_RESOLUTION_FAILED', 'Source hostname returned an invalid address');
            }
            return { address: record.address, family };
        });
    }
};
exports.NodeDnsResolverService = NodeDnsResolverService;
exports.NodeDnsResolverService = NodeDnsResolverService = __decorate([
    (0, common_1.Injectable)()
], NodeDnsResolverService);
//# sourceMappingURL=node-dns-resolver.service.js.map