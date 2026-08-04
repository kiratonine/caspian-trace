import { z } from 'zod'

const postgresUrlSchema = z
  .string()
  .regex(/^postgres(?:ql)?:\/\/\S+$/)
  .pipe(z.url({ protocol: /^postgres(?:ql)?$/ }))

export const PlatformEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65_535).default(3000),
    API_PREFIX: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9-]*$/)
      .default('api'),
    WEB_ORIGIN: z.url({ protocol: /^https?$/ }),
    HTTP_BODY_LIMIT: z
      .string()
      .trim()
      .regex(/^\d+(?:kb|mb)$/i)
      .default('1mb'),
    DATABASE_URL: postgresUrlSchema,
    DB_READINESS_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(250)
      .max(10_000)
      .default(3_000),
  })

export const FutureIntegrationEnvironmentSchema = z
  .object({
    DATABASE_URL: postgresUrlSchema.optional(),
    DIRECT_URL: postgresUrlSchema.optional(),
    SUPABASE_URL: z.url({ protocol: /^https$/ }).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    SUPABASE_SOURCE_BUCKET: z.string().trim().min(1).optional(),
    INGESTION_TOKEN: z.string().min(32).optional(),
    HTTP_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    HTTP_MAX_BYTES: z.coerce.number().int().positive().optional(),
    GDELT_CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().optional(),
    LLM_PROVIDER: z.string().trim().min(1).optional(),
  })
  .strict()

const futureIntegrationEnvironmentKeys = [
  'DATABASE_URL',
  'DIRECT_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SOURCE_BUCKET',
  'INGESTION_TOKEN',
  'HTTP_TIMEOUT_MS',
  'HTTP_MAX_BYTES',
  'GDELT_CACHE_TTL_SECONDS',
  'LLM_PROVIDER',
] as const

export type PlatformEnvironment = z.infer<typeof PlatformEnvironmentSchema>
export type FutureIntegrationEnvironment = z.infer<
  typeof FutureIntegrationEnvironmentSchema
>

export function validatePlatformEnvironment(
  environment: Record<string, unknown>,
): PlatformEnvironment {
  const result = PlatformEnvironmentSchema.safeParse(environment)
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((issue) => issue.path[0]))]
      .filter((key): key is string => typeof key === 'string')
      .sort()
    throw new Error(`Invalid platform environment: ${keys.join(', ')}`)
  }
  return result.data
}

export function validateFutureIntegrationEnvironment(
  environment: Record<string, unknown>,
): FutureIntegrationEnvironment {
  const integrationEnvironment: Record<string, unknown> = {}
  for (const key of futureIntegrationEnvironmentKeys) {
    const value = environment[key]
    if (value !== undefined) integrationEnvironment[key] = value
  }

  return FutureIntegrationEnvironmentSchema.parse(integrationEnvironment)
}
