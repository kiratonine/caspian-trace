const TRACKING_PARAMETERS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid',
])

export function canonicalizeArticleUrl(input: URL): string {
  const url = new URL(input.toString())
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMETERS.has(key.toLowerCase())) url.searchParams.delete(key)
  }
  url.searchParams.sort()
  return url.toString()
}

export function parsePublicArticleUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' || url.username !== '' || url.password !== '' ||
      (url.port !== '' && url.port !== '443')
    ) return null
    url.hash = ''
    return url
  } catch {
    return null
  }
}
