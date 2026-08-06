if (
  process.env.SUPABASE_READINESS_REQUIRED === 'true' &&
  (!process.env.DATABASE_URL || !process.env.DIRECT_URL)
) {
  throw new Error(
    'DATABASE_URL and DIRECT_URL are required for the Supabase readiness smoke test',
  )
}

process.env.NODE_ENV = 'test'
process.env.LLM_PROVIDER = 'disabled'
process.env.PORT = '3000'
process.env.API_PREFIX = 'api'
process.env.WEB_ORIGIN = 'http://localhost:5173'
process.env.HTTP_BODY_LIMIT = '1kb'
process.env.DATABASE_URL ??=
  process.env.DATABASE_E2E_URL ??
  'postgresql://caspian_test:caspian_test@127.0.0.1:5432/caspian_test'
process.env.DB_READINESS_TIMEOUT_MS ??= '250'
process.env.SUPABASE_URL ??= 'https://test-project.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'
process.env.SUPABASE_SOURCE_BUCKET ??= 'source-documents'
process.env.SOURCE_SIGNED_URL_TTL_SECONDS ??= '120'
process.env.HTTP_MAX_BYTES ??= '15728640'
process.env.HTTP_TIMEOUT_MS ??= '10000'
process.env.SAFE_FETCH_USER_AGENT ??= 'caspian-trace-test/1.0'
process.env.SAFE_FETCH_CACHE_MAX_ENTRIES ??= '4'
process.env.SAFE_FETCH_CACHE_MAX_BYTES ??= '1048576'
process.env.SAFE_FETCH_RETRY_BASE_DELAY_MS ??= '10'
process.env.SAFE_FETCH_RETRY_MAX_DELAY_MS ??= '100'
process.env.INGESTION_TOKEN ??= 'test-ingestion-token-at-least-32-characters'
process.env.KAZHYDROMET_BULLETINS_URL ??=
  'https://www.kazhydromet.kz/ru/ecology/ezhemesyachnyy-informacionnyy-byulleten-o-sostoyanii-okruzhayuschey-sredy'
process.env.KAZHYDROMET_ALLOWED_HOSTS ??= 'kazhydromet.kz,www.kazhydromet.kz'
process.env.KAZHYDROMET_MAX_DOCUMENTS_PER_RUN ??= '3'
process.env.KAZHYDROMET_PDF_MAX_PAGES ??= '300'
process.env.KAZHYDROMET_PDF_MAX_TEXT_CHARS ??= '5000000'
process.env.GDELT_ENDPOINT_URL ??= 'https://api.gdeltproject.org/api/v2/doc/doc'
process.env.GDELT_ALLOWED_HOSTS ??= 'api.gdeltproject.org'
process.env.GDELT_CACHE_TTL_SECONDS ??= '1800'
process.env.GDELT_STALE_IF_ERROR_SECONDS ??= '86400'
process.env.GDELT_MAX_RECORDS ??= '25'
process.env.GDELT_MAX_ARTICLES_PER_RUN ??= '10'
process.env.GDELT_MAX_WINDOW_DAYS ??= '31'
process.env.DIRECT_SOURCE_ALLOWED_HOSTS ??= 'kazhydromet.kz,www.kazhydromet.kz,inform.kz,www.inform.kz,gov.kz,www.gov.kz,azh.kz,www.azh.kz,atpress.kz,www.atpress.kz,lada.kz,www.lada.kz,inaktau.kz,www.inaktau.kz,tumba.kz,www.tumba.kz,mangystaumedia.kz,www.mangystaumedia.kz,uralskweek.kz,www.uralskweek.kz,mgorod.kz,www.mgorod.kz,diapazon.kz,www.diapazon.kz,zakon.kz,www.zakon.kz'
process.env.DIRECT_SOURCE_FALLBACK_URLS ??= 'https://www.zakon.kz/obshestvo/6490267-v-atyrau-zelenaya-voda-v-reke-okazalas-sledom-neftyanogo-zagryazneniya.html,https://www.inform.kz/ru/v-stochnih-vodah-atirau-obnaruzheni-ostatki-nefteproduktov-adef40,https://azh.kz/ru/news/view/120575'
process.env.DIRECT_SOURCE_MAX_ARTICLES_PER_RUN ??= '10'
process.env.DIRECT_SOURCE_MAX_ARTICLES_PER_DOMAIN ??= '2'
process.env.DIRECT_SOURCE_HTML_MAX_BYTES ??= '2097152'
process.env.DIRECT_SOURCE_TEXT_MAX_CHARS ??= '100000'
