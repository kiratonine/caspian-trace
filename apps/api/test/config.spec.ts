import {
  validateApplicationEnvironment,
  validateFutureIntegrationEnvironment,
  validatePlatformEnvironment,
} from '../src/config/environment'

describe('platform environment validation', () => {
  const requiredEnvironment = {
    WEB_ORIGIN: 'http://localhost:5173',
    DATABASE_URL: 'postgresql://api:secret@localhost:5432/caspian',
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

  it('validates future integration values separately from API startup', () => {
    expect(
      validateFutureIntegrationEnvironment({
        HTTP_TIMEOUT_MS: '12000',
        HTTP_MAX_BYTES: '15728640',
        GDELT_CACHE_TTL_SECONDS: '1800',
      }),
    ).toEqual({
      HTTP_TIMEOUT_MS: 12000,
      HTTP_MAX_BYTES: 15728640,
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
        HTTP_TIMEOUT_MS: '12000',
      }),
    ).toEqual({ HTTP_TIMEOUT_MS: 12000 })
  })

  it.each([
    ['DATABASE_URL', 'mysql://localhost/caspian'],
    ['DIRECT_URL', 'https://database.example.com'],
  ])('rejects an invalid %s', (key, value) => {
    expect(() =>
      validateFutureIntegrationEnvironment({ [key]: value }),
    ).toThrow()
  })

  it('requires a Gemini key only when the Gemini provider is enabled', () => {
    expect(() =>
      validateFutureIntegrationEnvironment({ LLM_PROVIDER: 'gemini' }),
    ).toThrow()
    expect(
      validateFutureIntegrationEnvironment({ LLM_PROVIDER: 'disabled' }),
    ).toEqual({ LLM_PROVIDER: 'disabled' })
    expect(
      validateFutureIntegrationEnvironment({
        LLM_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'test-key',
        GEMINI_MODEL: 'gemini-test-model',
      }),
    ).toEqual({
      LLM_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'test-key',
      GEMINI_MODEL: 'gemini-test-model',
    })
  })

  it('applies integration validation during application startup', () => {
    expect(() =>
      validateApplicationEnvironment({
        WEB_ORIGIN: 'http://localhost:5173',
        DATABASE_URL: 'postgresql://api:secret@localhost:5432/caspian',
        INGESTION_TOKEN: 'too-short',
      }),
    ).toThrow()
    expect(() =>
      validateApplicationEnvironment({
        WEB_ORIGIN: 'http://localhost:5173',
        DATABASE_URL: 'postgresql://api:secret@localhost:5432/caspian',
        LLM_PROVIDER: 'gemini',
      }),
    ).toThrow()
    expect(
      validateApplicationEnvironment({
        WEB_ORIGIN: 'http://localhost:5173',
        DATABASE_URL: 'postgresql://api:secret@localhost:5432/caspian',
        LLM_PROVIDER: 'disabled',
        GEMINI_API_KEY: '',
      }),
    ).toMatchObject({ LLM_PROVIDER: 'disabled' })
  })
})
