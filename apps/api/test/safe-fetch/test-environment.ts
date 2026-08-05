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
}

export function createSafeFetchConfig(
  overrides: Partial<PlatformEnvironment> = {},
): ConfigService<PlatformEnvironment, true> {
  return new ConfigService<PlatformEnvironment, true>({
    ...baseEnvironment,
    ...overrides,
  })
}
