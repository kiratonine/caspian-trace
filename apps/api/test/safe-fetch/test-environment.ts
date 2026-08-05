import { ConfigService } from '@nestjs/config'

import type { PlatformEnvironment } from '../../src/config/environment'

const baseEnvironment: PlatformEnvironment = {
  NODE_ENV: 'test',
  PORT: 3000,
  API_PREFIX: 'api',
  WEB_ORIGIN: 'http://localhost:5173',
  HTTP_BODY_LIMIT: '1kb',
  DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/test',
  DB_READINESS_TIMEOUT_MS: 250,
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
  SUPABASE_SOURCE_BUCKET: 'source-documents',
  SOURCE_SIGNED_URL_TTL_SECONDS: 120,
  HTTP_TIMEOUT_MS: 1_000,
  HTTP_MAX_BYTES: 1_048_576,
  SAFE_FETCH_USER_AGENT: 'caspian-trace-test/1.0',
  SAFE_FETCH_CACHE_MAX_ENTRIES: 4,
  SAFE_FETCH_CACHE_MAX_BYTES: 1_048_576,
  SAFE_FETCH_RETRY_BASE_DELAY_MS: 10,
  SAFE_FETCH_RETRY_MAX_DELAY_MS: 100,
  INGESTION_TOKEN: 'test-ingestion-token-at-least-32-characters',
  KAZHYDROMET_BULLETINS_URL:
    'https://www.kazhydromet.kz/ru/ecology/ezhemesyachnyy-informacionnyy-byulleten-o-sostoyanii-okruzhayuschey-sredy',
  KAZHYDROMET_ALLOWED_HOSTS: ['kazhydromet.kz', 'www.kazhydromet.kz'],
  KAZHYDROMET_MAX_DOCUMENTS_PER_RUN: 3,
  KAZHYDROMET_PDF_MAX_PAGES: 300,
  KAZHYDROMET_PDF_MAX_TEXT_CHARS: 5_000_000,
  GDELT_ENDPOINT_URL: 'https://api.gdeltproject.org/api/v2/doc/doc',
  GDELT_ALLOWED_HOSTS: ['api.gdeltproject.org'],
  GDELT_CACHE_TTL_SECONDS: 1_800,
  GDELT_STALE_IF_ERROR_SECONDS: 86_400,
  GDELT_MAX_RECORDS: 25,
  GDELT_MAX_ARTICLES_PER_RUN: 10,
  GDELT_MAX_WINDOW_DAYS: 31,
  DIRECT_SOURCE_ALLOWED_HOSTS: ['azh.kz', 'www.azh.kz'],
  DIRECT_SOURCE_FALLBACK_URLS: ['https://azh.kz/ru/news/view/120575'],
  DIRECT_SOURCE_MAX_ARTICLES_PER_RUN: 10,
  DIRECT_SOURCE_MAX_ARTICLES_PER_DOMAIN: 2,
  DIRECT_SOURCE_HTML_MAX_BYTES: 1_048_576,
  DIRECT_SOURCE_TEXT_MAX_CHARS: 100_000,
}

export function createSafeFetchConfig(
  overrides: Partial<PlatformEnvironment> = {},
): ConfigService<PlatformEnvironment, true> {
  return new ConfigService<PlatformEnvironment, true>({
    ...baseEnvironment,
    ...overrides,
  })
}
