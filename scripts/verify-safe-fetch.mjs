import { createRequire } from 'node:module'

const requireFromScript = createRequire(import.meta.url)
const requireFromApi = createRequire(
  new URL('../apps/api/package.json', import.meta.url),
)

const { ConfigService } = requireFromApi('@nestjs/config')
const { NodeDnsResolverService } = requireFromScript(
  '../apps/api/dist/common/http/safe-fetch/node-dns-resolver.service.js',
)
const {
  NodeHttpsTransportService,
  nodeHttpsRequestFactory,
} = requireFromScript(
  '../apps/api/dist/common/http/safe-fetch/node-https-transport.service.js',
)
const { SafeFetchResponseCache } = requireFromScript(
  '../apps/api/dist/common/http/safe-fetch/response-cache.js',
)
const { SystemSafeFetchRuntime } = requireFromScript(
  '../apps/api/dist/common/http/safe-fetch/safe-fetch.runtime.js',
)
const { SafeFetchService } = requireFromScript(
  '../apps/api/dist/common/http/safe-fetch/safe-fetch.service.js',
)

const config = new ConfigService({
  HTTP_MAX_BYTES: 15_728_640,
  HTTP_TIMEOUT_MS: 10_000,
  SAFE_FETCH_USER_AGENT: 'caspian-trace-safe-fetch-smoke/1.0',
  SAFE_FETCH_CACHE_MAX_ENTRIES: 1,
  SAFE_FETCH_CACHE_MAX_BYTES: 1_048_576,
  SAFE_FETCH_RETRY_BASE_DELAY_MS: 250,
  SAFE_FETCH_RETRY_MAX_DELAY_MS: 5_000,
})
const service = new SafeFetchService(
  config,
  new NodeDnsResolverService(),
  new NodeHttpsTransportService(nodeHttpsRequestFactory),
  new SafeFetchResponseCache(config),
  new SystemSafeFetchRuntime(),
)

const result = await service.fetchText(
  new URL(
    'https://www.kazhydromet.kz/ru/ecology/ezhemesyachnyy-informacionnyy-byulleten-o-sostoyanii-okruzhayuschey-sredy',
  ),
  {
    allowedHosts: ['www.kazhydromet.kz', 'kazhydromet.kz'],
    expectedContentTypes: ['text/html'],
    maxBytes: 2 * 1024 * 1024,
    timeoutMs: 10_000,
    cache: { enabled: false, ttlMs: 1, staleIfErrorMs: 0 },
  },
)

if (result.text.length === 0 || result.metadata.statusCode < 200 || result.metadata.statusCode > 299) {
  throw new Error('Kazhydromet SafeFetch smoke returned an invalid response')
}

console.log(
  `Kazhydromet SafeFetch HTML smoke passed (${result.metadata.statusCode}, ${Buffer.byteLength(result.text)} bytes)`,
)
