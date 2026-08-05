import {
  validateFutureIntegrationEnvironment,
  validatePlatformEnvironment,
} from '../src/config/environment'

describe('platform environment validation', () => {
  const requiredEnvironment = {
    WEB_ORIGIN: 'http://localhost:5173',
    DATABASE_URL: 'postgresql://api:secret@localhost:5432/caspian',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-placeholder',
    SUPABASE_SOURCE_BUCKET: 'source-documents',
    INGESTION_TOKEN: 'test-ingestion-token-at-least-32-characters',
  }

  it('normalizes valid platform values', () => {
    expect(
      validatePlatformEnvironment({
        NODE_ENV: 'test',
        PORT: '3100',
        API_PREFIX: 'api',
        ...requiredEnvironment,
        HTTP_BODY_LIMIT: '2mb',
        DB_READINESS_TIMEOUT_MS: '1250',
      }),
    ).toMatchObject({
      NODE_ENV: 'test',
      PORT: 3100,
      API_PREFIX: 'api',
      WEB_ORIGIN: 'http://localhost:5173',
      HTTP_BODY_LIMIT: '2mb',
      DATABASE_URL: requiredEnvironment.DATABASE_URL,
      DB_READINESS_TIMEOUT_MS: 1250,
      SUPABASE_URL: requiredEnvironment.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY:
        requiredEnvironment.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_SOURCE_BUCKET: 'source-documents',
      SOURCE_SIGNED_URL_TTL_SECONDS: 120,
      HTTP_TIMEOUT_MS: 10_000,
      HTTP_MAX_BYTES: 15_728_640,
      SAFE_FETCH_USER_AGENT: 'caspian-trace/1.0',
      SAFE_FETCH_CACHE_MAX_ENTRIES: 32,
      SAFE_FETCH_CACHE_MAX_BYTES: 33_554_432,
      SAFE_FETCH_RETRY_BASE_DELAY_MS: 250,
      SAFE_FETCH_RETRY_MAX_DELAY_MS: 5_000,
      INGESTION_TOKEN: requiredEnvironment.INGESTION_TOKEN,
      KAZHYDROMET_BULLETINS_URL:
        'https://www.kazhydromet.kz/ru/ecology/ezhemesyachnyy-informacionnyy-byulleten-o-sostoyanii-okruzhayuschey-sredy',
      KAZHYDROMET_ALLOWED_HOSTS: ['kazhydromet.kz', 'www.kazhydromet.kz'],
      KAZHYDROMET_MAX_DOCUMENTS_PER_RUN: 3,
      KAZHYDROMET_PDF_MAX_PAGES: 300,
      KAZHYDROMET_PDF_MAX_TEXT_CHARS: 5_000_000,
    })
  })

  it('fails predictably for an invalid critical origin', () => {
    expect(() =>
      validatePlatformEnvironment({
        ...requiredEnvironment,
        WEB_ORIGIN: 'not-a-url',
      }),
    ).toThrow()
  })

  it('requires DATABASE_URL but does not require DIRECT_URL at runtime', () => {
    expect(validatePlatformEnvironment(requiredEnvironment)).not.toHaveProperty(
      'DIRECT_URL',
    )
    expect(() =>
      validatePlatformEnvironment({ WEB_ORIGIN: requiredEnvironment.WEB_ORIGIN }),
    ).toThrow('DATABASE_URL')
  })

  it.each(['', 'mysql://localhost/caspian'])(
    'rejects invalid runtime DATABASE_URL %j',
    (value) => {
      expect(() =>
        validatePlatformEnvironment({
          ...requiredEnvironment,
          DATABASE_URL: value,
        }),
      ).toThrow('DATABASE_URL')
    },
  )

  it('applies the readiness timeout default and strips system keys', () => {
    expect(
      validatePlatformEnvironment({
        ...requiredEnvironment,
        PATH: '/usr/bin',
        HOME: '/home/api',
        USER: 'api',
        WSL_DISTRO_NAME: 'Ubuntu',
      }),
    ).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      API_PREFIX: 'api',
      WEB_ORIGIN: requiredEnvironment.WEB_ORIGIN,
      HTTP_BODY_LIMIT: '1mb',
      DATABASE_URL: requiredEnvironment.DATABASE_URL,
      DB_READINESS_TIMEOUT_MS: 3000,
      SUPABASE_URL: requiredEnvironment.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY:
        requiredEnvironment.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_SOURCE_BUCKET: 'source-documents',
      SOURCE_SIGNED_URL_TTL_SECONDS: 120,
      HTTP_TIMEOUT_MS: 10_000,
      HTTP_MAX_BYTES: 15_728_640,
      SAFE_FETCH_USER_AGENT: 'caspian-trace/1.0',
      SAFE_FETCH_CACHE_MAX_ENTRIES: 32,
      SAFE_FETCH_CACHE_MAX_BYTES: 33_554_432,
      SAFE_FETCH_RETRY_BASE_DELAY_MS: 250,
      SAFE_FETCH_RETRY_MAX_DELAY_MS: 5_000,
      INGESTION_TOKEN: requiredEnvironment.INGESTION_TOKEN,
      KAZHYDROMET_BULLETINS_URL:
        'https://www.kazhydromet.kz/ru/ecology/ezhemesyachnyy-informacionnyy-byulleten-o-sostoyanii-okruzhayuschey-sredy',
      KAZHYDROMET_ALLOWED_HOSTS: ['kazhydromet.kz', 'www.kazhydromet.kz'],
      KAZHYDROMET_MAX_DOCUMENTS_PER_RUN: 3,
      KAZHYDROMET_PDF_MAX_PAGES: 300,
      KAZHYDROMET_PDF_MAX_TEXT_CHARS: 5_000_000,
    })
  })

  it('does not expose an invalid connection string in validation errors', () => {
    const secret = 'postgresql://api:do-not-log@localhost:5432/caspian'
    expect(() =>
      validatePlatformEnvironment({
        ...requiredEnvironment,
        DATABASE_URL: `${secret} broken`,
      }),
    ).toThrow('DATABASE_URL')
    try {
      validatePlatformEnvironment({
        ...requiredEnvironment,
        DATABASE_URL: `${secret} broken`,
      })
    } catch (error) {
      expect(String(error)).not.toContain('do-not-log')
    }
  })

  it.each(['249', '10001'])('rejects readiness timeout %s', (value) => {
    expect(() =>
      validatePlatformEnvironment({
        ...requiredEnvironment,
        DB_READINESS_TIMEOUT_MS: value,
      }),
    ).toThrow('DB_READINESS_TIMEOUT_MS')
  })

  it('requires and normalizes Storage runtime settings', () => {
    expect(
      validatePlatformEnvironment({
        ...requiredEnvironment,
        SOURCE_SIGNED_URL_TTL_SECONDS: '30',
        HTTP_MAX_BYTES: '1',
      }),
    ).toMatchObject({
      SUPABASE_URL: requiredEnvironment.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY:
        requiredEnvironment.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_SOURCE_BUCKET: 'source-documents',
      SOURCE_SIGNED_URL_TTL_SECONDS: 30,
      HTTP_MAX_BYTES: 1,
    })
  })

  it.each([
    ['SUPABASE_URL', undefined],
    ['SUPABASE_SERVICE_ROLE_KEY', undefined],
    ['SUPABASE_SOURCE_BUCKET', undefined],
    ['SUPABASE_SOURCE_BUCKET', 'Source_Documents'],
    ['SOURCE_SIGNED_URL_TTL_SECONDS', '29'],
    ['SOURCE_SIGNED_URL_TTL_SECONDS', '601'],
    ['HTTP_MAX_BYTES', '15728641'],
  ])('rejects invalid Storage setting %s=%j', (key, value) => {
    const environment: Record<string, unknown> = { ...requiredEnvironment }
    if (value === undefined) delete environment[key]
    else environment[key] = value
    expect(() => validatePlatformEnvironment(environment)).toThrow(key)
  })

  it('validates future integration values separately from API startup', () => {
    expect(
      validateFutureIntegrationEnvironment({
        GDELT_CACHE_TTL_SECONDS: '1800',
      }),
    ).toEqual({
      GDELT_CACHE_TTL_SECONDS: 1800,
    })
  })

  it('ignores standard process environment keys', () => {
    expect(
      validateFutureIntegrationEnvironment({
        PATH: '/usr/local/bin:/usr/bin',
        HOME: '/home/api',
        USER: 'api',
        WSL_DISTRO_NAME: 'Ubuntu',
        WSL_INTEROP: '/run/WSL/interop',
        GDELT_CACHE_TTL_SECONDS: '1200',
      }),
    ).toEqual({ GDELT_CACHE_TTL_SECONDS: 1200 })
  })

  it('normalizes SafeFetch platform settings', () => {
    expect(
      validatePlatformEnvironment({
        ...requiredEnvironment,
        HTTP_TIMEOUT_MS: '250',
        SAFE_FETCH_USER_AGENT: 'caspian-trace-test/1.0',
        SAFE_FETCH_CACHE_MAX_ENTRIES: '8',
        SAFE_FETCH_CACHE_MAX_BYTES: '1048576',
        SAFE_FETCH_RETRY_BASE_DELAY_MS: '100',
        SAFE_FETCH_RETRY_MAX_DELAY_MS: '250',
      }),
    ).toMatchObject({
      HTTP_TIMEOUT_MS: 250,
      SAFE_FETCH_USER_AGENT: 'caspian-trace-test/1.0',
      SAFE_FETCH_CACHE_MAX_ENTRIES: 8,
      SAFE_FETCH_CACHE_MAX_BYTES: 1_048_576,
      SAFE_FETCH_RETRY_BASE_DELAY_MS: 100,
      SAFE_FETCH_RETRY_MAX_DELAY_MS: 250,
    })
  })

  it.each([
    ['HTTP_TIMEOUT_MS', '249'],
    ['HTTP_TIMEOUT_MS', '30001'],
    ['SAFE_FETCH_USER_AGENT', 'bad\nagent'],
    ['SAFE_FETCH_CACHE_MAX_ENTRIES', '129'],
    ['SAFE_FETCH_CACHE_MAX_BYTES', '1048575'],
    ['SAFE_FETCH_RETRY_BASE_DELAY_MS', '9'],
    ['SAFE_FETCH_RETRY_MAX_DELAY_MS', '99'],
  ])('rejects invalid SafeFetch setting %s=%j', (key, value) => {
    expect(() =>
      validatePlatformEnvironment({ ...requiredEnvironment, [key]: value }),
    ).toThrow(key)
  })

  it('requires retry maximum delay to cover the base delay', () => {
    expect(() =>
      validatePlatformEnvironment({
        ...requiredEnvironment,
        SAFE_FETCH_RETRY_BASE_DELAY_MS: '1000',
        SAFE_FETCH_RETRY_MAX_DELAY_MS: '500',
      }),
    ).toThrow('SAFE_FETCH_RETRY_MAX_DELAY_MS')
  })

  it('validates Kazhydromet runtime configuration without exposing the token', () => {
    expect(
      validatePlatformEnvironment({
        ...requiredEnvironment,
        KAZHYDROMET_MAX_DOCUMENTS_PER_RUN: '2',
        KAZHYDROMET_PDF_MAX_PAGES: '200',
        KAZHYDROMET_PDF_MAX_TEXT_CHARS: '100000',
      }),
    ).toMatchObject({
      KAZHYDROMET_ALLOWED_HOSTS: ['kazhydromet.kz', 'www.kazhydromet.kz'],
      KAZHYDROMET_MAX_DOCUMENTS_PER_RUN: 2,
      KAZHYDROMET_PDF_MAX_PAGES: 200,
      KAZHYDROMET_PDF_MAX_TEXT_CHARS: 100_000,
    })
    const secret = 'x'.repeat(31)
    try {
      validatePlatformEnvironment({ ...requiredEnvironment, INGESTION_TOKEN: secret })
    } catch (error) {
      expect(String(error)).toBe('Error: Invalid platform environment: INGESTION_TOKEN')
      expect(String(error)).not.toContain(secret)
    }
  })

  it.each([
    ['KAZHYDROMET_BULLETINS_URL', 'https://evil.example/bulletins'],
    ['KAZHYDROMET_ALLOWED_HOSTS', 'www.kazhydromet.kz,evil.example:443'],
    ['KAZHYDROMET_ALLOWED_HOSTS', 'www.kazhydromet.kz,,kazhydromet.kz'],
    ['KAZHYDROMET_MAX_DOCUMENTS_PER_RUN', '11'],
    ['KAZHYDROMET_PDF_MAX_PAGES', '501'],
    ['KAZHYDROMET_PDF_MAX_TEXT_CHARS', '99999'],
  ])('rejects invalid Kazhydromet setting %s', (key, value) => {
    expect(() => validatePlatformEnvironment({ ...requiredEnvironment, [key]: value })).toThrow(key)
  })

  it.each([
    ['DATABASE_URL', 'mysql://localhost/caspian'],
    ['DIRECT_URL', 'https://database.example.com'],
  ])('rejects an invalid %s', (key, value) => {
    expect(() =>
      validateFutureIntegrationEnvironment({ [key]: value }),
    ).toThrow()
  })
})
