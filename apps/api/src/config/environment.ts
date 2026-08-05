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
    SUPABASE_URL: z.url({ protocol: /^https$/ }),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    SUPABASE_SOURCE_BUCKET: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
    SOURCE_SIGNED_URL_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(30)
      .max(600)
      .default(120),
    HTTP_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(250)
      .max(30_000)
      .default(10_000),
    HTTP_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(15_728_640)
      .default(15_728_640),
    SAFE_FETCH_USER_AGENT: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[\x20-\x7e]+$/)
      .refine((value) => value.trim().length > 0)
      .default('caspian-trace/1.0'),
    SAFE_FETCH_CACHE_MAX_ENTRIES: z.coerce
      .number()
      .int()
      .min(1)
      .max(128)
      .default(32),
    SAFE_FETCH_CACHE_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1_048_576)
      .max(67_108_864)
      .default(33_554_432),
    SAFE_FETCH_RETRY_BASE_DELAY_MS: z.coerce
      .number()
      .int()
      .min(10)
      .max(2_000)
      .default(250),
    SAFE_FETCH_RETRY_MAX_DELAY_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(10_000)
      .default(5_000),
  })
  .superRefine((environment, context) => {
    if (
      environment.SAFE_FETCH_RETRY_MAX_DELAY_MS <
      environment.SAFE_FETCH_RETRY_BASE_DELAY_MS
    ) {
      context.addIssue({
        code: 'custom',
        path: ['SAFE_FETCH_RETRY_MAX_DELAY_MS'],
        message: 'Retry maximum must be at least the base delay',
      })
    }
  })

export const FutureIntegrationEnvironmentSchema = z
  .object({
    DATABASE_URL: postgresUrlSchema.optional(),
    DIRECT_URL: postgresUrlSchema.optional(),
    INGESTION_TOKEN: z.string().min(32).optional(),
    GDELT_CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().optional(),
    LLM_PROVIDER: z.string().trim().min(1).optional(),
  })
  .strict()

const futureIntegrationEnvironmentKeys = [
  'DATABASE_URL',
  'DIRECT_URL',
  'INGESTION_TOKEN',
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
