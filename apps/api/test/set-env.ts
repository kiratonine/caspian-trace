if (
  process.env.SUPABASE_READINESS_REQUIRED === 'true' &&
  (!process.env.DATABASE_URL || !process.env.DIRECT_URL)
) {
  throw new Error(
    'DATABASE_URL and DIRECT_URL are required for the Supabase readiness smoke test',
  )
}

process.env.NODE_ENV = 'test'
process.env.PORT = '3000'
process.env.API_PREFIX = 'api'
process.env.WEB_ORIGIN = 'http://localhost:5173'
process.env.HTTP_BODY_LIMIT = '1kb'
process.env.DATABASE_URL ??=
  process.env.DATABASE_E2E_URL ??
  'postgresql://caspian_test:caspian_test@127.0.0.1:5432/caspian_test'
process.env.DB_READINESS_TIMEOUT_MS ??= '250'
