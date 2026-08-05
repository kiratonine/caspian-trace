import { Module } from '@nestjs/common'

import {
  SAFE_FETCH_DNS_RESOLVER,
  SAFE_FETCH_HTTPS_REQUEST,
  SAFE_FETCH_RUNTIME,
  SAFE_FETCH_TRANSPORT,
} from './safe-fetch/safe-fetch.constants'
import { NodeDnsResolverService } from './safe-fetch/node-dns-resolver.service'
import {
  NodeHttpsTransportService,
  nodeHttpsRequestFactory,
} from './safe-fetch/node-https-transport.service'
import { SafeFetchResponseCache } from './safe-fetch/response-cache'
import { SystemSafeFetchRuntime } from './safe-fetch/safe-fetch.runtime'
import { SafeFetchService } from './safe-fetch/safe-fetch.service'

@Module({
  providers: [
    SafeFetchService,
    SafeFetchResponseCache,
    NodeDnsResolverService,
    NodeHttpsTransportService,
    SystemSafeFetchRuntime,
    { provide: SAFE_FETCH_DNS_RESOLVER, useExisting: NodeDnsResolverService },
    { provide: SAFE_FETCH_TRANSPORT, useExisting: NodeHttpsTransportService },
    { provide: SAFE_FETCH_RUNTIME, useExisting: SystemSafeFetchRuntime },
    { provide: SAFE_FETCH_HTTPS_REQUEST, useValue: nodeHttpsRequestFactory },
  ],
  exports: [SafeFetchService],
})
export class SafeFetchModule {}
