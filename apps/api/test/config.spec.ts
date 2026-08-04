import {
  validateFutureIntegrationEnvironment,
  validatePlatformEnvironment,
} from '../src/config/environment'

describe('platform environment validation', () => {
  it('normalizes valid platform values', () => {
    expect(
      validatePlatformEnvironment({
        NODE_ENV: 'test',
        PORT: '3100',
        API_PREFIX: 'api',
        WEB_ORIGIN: 'http://localhost:5173',
        HTTP_BODY_LIMIT: '2mb',
      }),
    ).toMatchObject({
      NODE_ENV: 'test',
      PORT: 3100,
      API_PREFIX: 'api',
      WEB_ORIGIN: 'http://localhost:5173',
      HTTP_BODY_LIMIT: '2mb',
    })
  })

  it('fails predictably for an invalid critical origin', () => {
    expect(() =>
      validatePlatformEnvironment({ WEB_ORIGIN: 'not-a-url' }),
    ).toThrow()
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
})
