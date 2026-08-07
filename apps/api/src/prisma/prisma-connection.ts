export function normalizePgConnectionString(databaseUrl: string): string {
  const parsed = new URL(databaseUrl)
  if (
    parsed.searchParams.get('sslmode') === 'require' &&
    !parsed.searchParams.has('uselibpqcompat')
  ) {
    // pg 8.22 defaults `require` to verify-full; Supabase connection strings use
    // libpq `require`, which encrypts transport without requiring a custom CA.
    parsed.searchParams.set('uselibpqcompat', 'true')
  }
  return parsed.toString()
}
