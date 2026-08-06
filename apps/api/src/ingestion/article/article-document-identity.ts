import { createHash } from 'node:crypto'

import type { DirectSourceRegistryEntry } from '../direct-sources/direct-source-registry'
import type { PublicArticleCandidate, PublicArticleIdentityInput } from './article.types'

export function buildArticleIdentity(input: {
  candidate: PublicArticleCandidate
  source: DirectSourceRegistryEntry
  canonicalUrl: string
  sha256: string
  runId: string
}): PublicArticleIdentityInput {
  const hostSlug = input.source.canonicalHost.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const id = `doc-article-${hostSlug}-${sha(input.canonicalUrl).slice(0, 12)}-${input.sha256.slice(0, 12)}`
  const article: Record<string, unknown> = {
    parserVersion: 1,
    discoveryModes: [input.candidate.discoveryMode],
    requestedRegions: input.candidate.requestedRegions,
    coverage: input.candidate.coverage,
    ingestionRunIds: [input.runId],
    parserStatus: 'pending',
  }
  if (input.candidate.discoveryTitle !== null) article.discoveryTitle = input.candidate.discoveryTitle
  if (input.candidate.gdeltSeenAt !== null) article.gdeltSeenAt = input.candidate.gdeltSeenAt
  if (input.candidate.gdeltLanguage !== null) article.gdeltLanguage = input.candidate.gdeltLanguage
  if (input.candidate.gdeltSourceCountry !== null) article.gdeltSourceCountry = input.candidate.gdeltSourceCountry
  return {
    id,
    originalUrl: input.candidate.originalUrl,
    canonicalUrl: input.canonicalUrl,
    publisher: input.source.publisher,
    title: input.candidate.discoveryTitle ?? `Публикация ${input.source.canonicalHost}`,
    sha256: input.sha256,
    metadata: { publicArticle: article },
  }
}

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
