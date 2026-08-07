const SUPABASE_HOST_SUFFIXES = ['.supabase.co', '.pooler.supabase.com']

export function assertDisposableDatabaseTarget({
  databaseUrl,
  directUrl,
  explicitlyDisposable,
}) {
  if (explicitlyDisposable !== true) {
    throw new Error('Explicit disposable database confirmation is required')
  }
  assertSafePostgresUrl(databaseUrl, 'runtime')
  assertSafePostgresUrl(directUrl, 'direct')
}

function assertSafePostgresUrl(value, label) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`Disposable ${label} database URL is invalid`)
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`Disposable ${label} database must use PostgreSQL`)
  }
  const hostname = parsed.hostname.toLowerCase()
  if (
    hostname === 'supabase.co' ||
    hostname === 'pooler.supabase.com' ||
    SUPABASE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new Error('Supabase targets are forbidden for destructive DB tests')
  }
}
