"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FutureIntegrationEnvironmentSchema = exports.PlatformEnvironmentSchema = void 0;
exports.validatePlatformEnvironment = validatePlatformEnvironment;
exports.validateFutureIntegrationEnvironment = validateFutureIntegrationEnvironment;
const zod_1 = require("zod");
const direct_source_registry_1 = require("../ingestion/direct-sources/direct-source-registry");
const postgresUrlSchema = zod_1.z
    .string()
    .regex(/^postgres(?:ql)?:\/\/\S+$/)
    .pipe(zod_1.z.url({ protocol: /^postgres(?:ql)?$/ }));
const exactHostnameSchema = zod_1.z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/)
    .refine((value) => !value.includes('..') && !value.includes('*'));
const kazhydrometAllowedHostsSchema = zod_1.z
    .string()
    .superRefine((value, context) => {
    const hosts = value.split(',');
    if (hosts.length < 1 || hosts.length > 5 || hosts.some((host) => host === '')) {
        context.addIssue({ code: 'custom', message: 'Expected 1..5 exact hostnames' });
        return;
    }
    for (const host of hosts) {
        if (host !== host.toLowerCase() || !exactHostnameSchema.safeParse(host).success) {
            context.addIssue({ code: 'custom', message: 'Invalid exact hostname' });
        }
    }
    if (new Set(hosts).size !== hosts.length) {
        context.addIssue({ code: 'custom', message: 'Hostnames must be unique' });
    }
})
    .transform((value) => value.split(','));
const kazhydrometListingUrlSchema = zod_1.z
    .string()
    .url()
    .superRefine((value, context) => {
    const url = new URL(value);
    if (url.protocol !== 'https:' ||
        url.username !== '' ||
        url.password !== '' ||
        url.hash !== '') {
        context.addIssue({ code: 'custom', message: 'Expected a credential-free HTTPS URL without fragment' });
    }
});
function exactHostsSchema(minimum, maximum) {
    return zod_1.z.string().superRefine((value, context) => {
        const hosts = value.split(',');
        if (hosts.length < minimum || hosts.length > maximum || hosts.some((host) => host === '')) {
            context.addIssue({ code: 'custom', message: `Expected ${minimum}..${maximum} exact hostnames` });
            return;
        }
        for (const host of hosts) {
            if (host !== host.toLowerCase() || !exactHostnameSchema.safeParse(host).success) {
                context.addIssue({ code: 'custom', message: 'Invalid exact hostname' });
            }
        }
        if (new Set(hosts).size !== hosts.length) {
            context.addIssue({ code: 'custom', message: 'Hostnames must be unique' });
        }
    }).transform((value) => value.split(','));
}
const gdeltEndpointSchema = zod_1.z.string().url().superRefine((value, context) => {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' ||
        url.hash !== '' || url.port !== '' || url.pathname !== '/api/v2/doc/doc' ||
        url.search !== '')
        context.addIssue({ code: 'custom', message: 'Invalid fixed GDELT endpoint' });
});
const directFallbackUrlsSchema = zod_1.z.string().superRefine((value, context) => {
    const values = value === '' ? [] : value.split(',');
    if (values.length > 20 || values.some((item) => item === '')) {
        context.addIssue({ code: 'custom', message: 'Expected at most 20 direct fallback URLs' });
        return;
    }
    const canonical = new Set();
    for (const item of values) {
        try {
            const url = new URL(item);
            if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' ||
                url.hash !== '' || (url.port !== '' && url.port !== '443'))
                throw new Error('invalid');
            url.searchParams.sort();
            if (canonical.has(url.toString()))
                throw new Error('duplicate');
            canonical.add(url.toString());
        }
        catch {
            context.addIssue({ code: 'custom', message: 'Invalid or duplicate direct fallback URL' });
        }
    }
}).transform((value) => value === '' ? [] : value.split(','));
const defaultDirectHosts = [
    'kazhydromet.kz', 'www.kazhydromet.kz', 'inform.kz', 'www.inform.kz',
    'gov.kz', 'www.gov.kz', 'azh.kz', 'www.azh.kz', 'atpress.kz', 'www.atpress.kz',
    'lada.kz', 'www.lada.kz', 'inaktau.kz', 'www.inaktau.kz', 'tumba.kz', 'www.tumba.kz',
    'mangystaumedia.kz', 'www.mangystaumedia.kz', 'uralskweek.kz', 'www.uralskweek.kz',
    'mgorod.kz', 'www.mgorod.kz', 'diapazon.kz', 'www.diapazon.kz', 'zakon.kz', 'www.zakon.kz',
];
const defaultDirectFallbackUrls = [
    'https://www.zakon.kz/obshestvo/6490267-v-atyrau-zelenaya-voda-v-reke-okazalas-sledom-neftyanogo-zagryazneniya.html',
    'https://www.inform.kz/ru/v-stochnih-vodah-atirau-obnaruzheni-ostatki-nefteproduktov-adef40',
    'https://azh.kz/ru/news/view/120575',
];
exports.PlatformEnvironmentSchema = zod_1.z
    .object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().positive().max(65_535).default(3000),
    API_PREFIX: zod_1.z
        .string()
        .trim()
        .regex(/^[a-z][a-z0-9-]*$/)
        .default('api'),
    WEB_ORIGIN: zod_1.z.url({ protocol: /^https?$/ }),
    HTTP_BODY_LIMIT: zod_1.z
        .string()
        .trim()
        .regex(/^\d+(?:kb|mb)$/i)
        .default('1mb'),
    DATABASE_URL: postgresUrlSchema,
    DB_READINESS_TIMEOUT_MS: zod_1.z.coerce
        .number()
        .int()
        .min(250)
        .max(10_000)
        .default(3_000),
    SUPABASE_URL: zod_1.z.url({ protocol: /^https$/ }),
    SUPABASE_SERVICE_ROLE_KEY: zod_1.z.string().min(1),
    SUPABASE_SOURCE_BUCKET: zod_1.z
        .string()
        .regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
    SOURCE_SIGNED_URL_TTL_SECONDS: zod_1.z.coerce
        .number()
        .int()
        .min(30)
        .max(600)
        .default(120),
    HTTP_TIMEOUT_MS: zod_1.z.coerce
        .number()
        .int()
        .min(250)
        .max(30_000)
        .default(10_000),
    HTTP_MAX_BYTES: zod_1.z.coerce
        .number()
        .int()
        .min(1)
        .max(15_728_640)
        .default(15_728_640),
    SAFE_FETCH_USER_AGENT: zod_1.z
        .string()
        .min(1)
        .max(160)
        .regex(/^[\x20-\x7e]+$/)
        .refine((value) => value.trim().length > 0)
        .default('caspian-trace/1.0'),
    SAFE_FETCH_CACHE_MAX_ENTRIES: zod_1.z.coerce
        .number()
        .int()
        .min(1)
        .max(128)
        .default(32),
    SAFE_FETCH_CACHE_MAX_BYTES: zod_1.z.coerce
        .number()
        .int()
        .min(1_048_576)
        .max(67_108_864)
        .default(33_554_432),
    SAFE_FETCH_RETRY_BASE_DELAY_MS: zod_1.z.coerce
        .number()
        .int()
        .min(10)
        .max(2_000)
        .default(250),
    SAFE_FETCH_RETRY_MAX_DELAY_MS: zod_1.z.coerce
        .number()
        .int()
        .min(100)
        .max(10_000)
        .default(5_000),
    INGESTION_TOKEN: zod_1.z
        .string()
        .min(32)
        .refine((value) => value.trim() === value && !/[\r\n]/.test(value)),
    KAZHYDROMET_BULLETINS_URL: kazhydrometListingUrlSchema.default('https://www.kazhydromet.kz/ru/ecology/ezhemesyachnyy-informacionnyy-byulleten-o-sostoyanii-okruzhayuschey-sredy'),
    KAZHYDROMET_ALLOWED_HOSTS: kazhydrometAllowedHostsSchema.default([
        'kazhydromet.kz',
        'www.kazhydromet.kz',
    ]),
    KAZHYDROMET_MAX_DOCUMENTS_PER_RUN: zod_1.z.coerce
        .number()
        .int()
        .min(1)
        .max(10)
        .default(3),
    KAZHYDROMET_PDF_MAX_PAGES: zod_1.z.coerce
        .number()
        .int()
        .min(1)
        .max(500)
        .default(300),
    KAZHYDROMET_PDF_MAX_TEXT_CHARS: zod_1.z.coerce
        .number()
        .int()
        .min(100_000)
        .max(10_000_000)
        .default(5_000_000),
    GDELT_ENDPOINT_URL: gdeltEndpointSchema.default('https://api.gdeltproject.org/api/v2/doc/doc'),
    GDELT_ALLOWED_HOSTS: exactHostsSchema(1, 3).default(['api.gdeltproject.org']),
    GDELT_CACHE_TTL_SECONDS: zod_1.z.coerce.number().int().min(1_800).max(86_400).default(1_800),
    GDELT_STALE_IF_ERROR_SECONDS: zod_1.z.coerce.number().int().min(1_800).max(604_800).default(86_400),
    GDELT_MAX_RECORDS: zod_1.z.coerce.number().int().min(1).max(25).default(25),
    GDELT_MAX_ARTICLES_PER_RUN: zod_1.z.coerce.number().int().min(1).max(10).default(10),
    GDELT_MAX_WINDOW_DAYS: zod_1.z.coerce.number().int().min(1).max(31).default(31),
    DIRECT_SOURCE_ALLOWED_HOSTS: exactHostsSchema(1, 40).default(defaultDirectHosts),
    DIRECT_SOURCE_FALLBACK_URLS: directFallbackUrlsSchema.default(defaultDirectFallbackUrls),
    DIRECT_SOURCE_MAX_ARTICLES_PER_RUN: zod_1.z.coerce.number().int().min(1).max(15).default(10),
    DIRECT_SOURCE_MAX_ARTICLES_PER_DOMAIN: zod_1.z.coerce.number().int().min(1).max(3).default(2),
    DIRECT_SOURCE_HTML_MAX_BYTES: zod_1.z.coerce.number().int().min(131_072).max(5_242_880).default(2_097_152),
    DIRECT_SOURCE_TEXT_MAX_CHARS: zod_1.z.coerce.number().int().min(1_000).max(500_000).default(100_000),
    LLM_PROVIDER: zod_1.z.literal('disabled').default('disabled'),
})
    .superRefine((environment, context) => {
    if (environment.SAFE_FETCH_RETRY_MAX_DELAY_MS <
        environment.SAFE_FETCH_RETRY_BASE_DELAY_MS) {
        context.addIssue({
            code: 'custom',
            path: ['SAFE_FETCH_RETRY_MAX_DELAY_MS'],
            message: 'Retry maximum must be at least the base delay',
        });
    }
    const listingHost = new URL(environment.KAZHYDROMET_BULLETINS_URL).hostname;
    if (!environment.KAZHYDROMET_ALLOWED_HOSTS.includes(listingHost)) {
        context.addIssue({
            code: 'custom',
            path: ['KAZHYDROMET_BULLETINS_URL'],
            message: 'Listing host must be in KAZHYDROMET_ALLOWED_HOSTS',
        });
    }
    const gdeltHost = new URL(environment.GDELT_ENDPOINT_URL).hostname;
    if (!environment.GDELT_ALLOWED_HOSTS.includes(gdeltHost)) {
        context.addIssue({ code: 'custom', path: ['GDELT_ENDPOINT_URL'], message: 'GDELT endpoint host is not allowed' });
    }
    if (environment.GDELT_STALE_IF_ERROR_SECONDS < environment.GDELT_CACHE_TTL_SECONDS) {
        context.addIssue({ code: 'custom', path: ['GDELT_STALE_IF_ERROR_SECONDS'], message: 'Stale window must cover TTL' });
    }
    for (const host of environment.DIRECT_SOURCE_ALLOWED_HOSTS) {
        if (!(0, direct_source_registry_1.findDirectSource)(host)) {
            context.addIssue({ code: 'custom', path: ['DIRECT_SOURCE_ALLOWED_HOSTS'], message: 'Unknown direct source host' });
        }
    }
    for (const value of environment.DIRECT_SOURCE_FALLBACK_URLS) {
        let hostname;
        try {
            hostname = new URL(value).hostname;
        }
        catch {
            continue;
        }
        if (!environment.DIRECT_SOURCE_ALLOWED_HOSTS.includes(hostname)) {
            context.addIssue({ code: 'custom', path: ['DIRECT_SOURCE_FALLBACK_URLS'], message: 'Fallback host is not allowed' });
        }
    }
    if (environment.DIRECT_SOURCE_MAX_ARTICLES_PER_DOMAIN > environment.DIRECT_SOURCE_MAX_ARTICLES_PER_RUN) {
        context.addIssue({ code: 'custom', path: ['DIRECT_SOURCE_MAX_ARTICLES_PER_DOMAIN'], message: 'Per-domain limit exceeds run limit' });
    }
    if (environment.DIRECT_SOURCE_HTML_MAX_BYTES > environment.HTTP_MAX_BYTES) {
        context.addIssue({ code: 'custom', path: ['DIRECT_SOURCE_HTML_MAX_BYTES'], message: 'Article limit exceeds HTTP maximum' });
    }
});
exports.FutureIntegrationEnvironmentSchema = zod_1.z
    .object({
    DATABASE_URL: postgresUrlSchema.optional(),
    DIRECT_URL: postgresUrlSchema.optional(),
    LLM_PROVIDER: zod_1.z.literal('disabled').optional(),
})
    .strict();
const futureIntegrationEnvironmentKeys = [
    'DATABASE_URL',
    'DIRECT_URL',
    'LLM_PROVIDER',
];
function validatePlatformEnvironment(environment) {
    const result = exports.PlatformEnvironmentSchema.safeParse(environment);
    if (!result.success) {
        const keys = [...new Set(result.error.issues.map((issue) => issue.path[0]))]
            .filter((key) => typeof key === 'string')
            .sort();
        throw new Error(`Invalid platform environment: ${keys.join(', ')}`);
    }
    return result.data;
}
function validateFutureIntegrationEnvironment(environment) {
    const integrationEnvironment = {};
    for (const key of futureIntegrationEnvironmentKeys) {
        const value = environment[key];
        if (value !== undefined)
            integrationEnvironment[key] = value;
    }
    return exports.FutureIntegrationEnvironmentSchema.parse(integrationEnvironment);
}
//# sourceMappingURL=environment.js.map