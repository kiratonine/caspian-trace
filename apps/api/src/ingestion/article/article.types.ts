import type { SourceCoverageTag } from '../direct-sources/direct-source-registry'
import type { KazhydrometRegion } from '../ingestion.types'

export type ArticleDiscoveryMode = 'gdelt' | 'direct_fallback'

export interface PublicArticleCandidate {
  discoveryMode: ArticleDiscoveryMode
  originalUrl: string
  discoveryTitle: string | null
  gdeltSeenAt: string | null
  gdeltLanguage: string | null
  gdeltSourceCountry: string | null
  requestedRegions: KazhydrometRegion[]
  publisherHost: string
  coverage: SourceCoverageTag[]
}

export interface ArticleExtractionResult {
  title: string | null
  publishedAt: string | null
  text: string
  textSha256: string
  textChars: number
  titleMode: 'og_title' | 'twitter_title' | 'document_title' | 'discovery' | 'none'
  publishedAtMode: 'article_published_time' | 'json_ld' | 'time_datetime' | 'none'
  matchedGeographyKeywords: string[]
  matchedRequestedRegions: KazhydrometRegion[]
  matchedPollutionKeywords: string[]
  relevant: boolean
}

export interface ArticleDocumentResult {
  sourceDocumentId: string
  discoveryMode: ArticleDiscoveryMode
  publisher: string
  title: string
  canonicalUrl: string
  publishedAt: string | null
  sha256: string
  cachePath: string
  parserStatus: 'succeeded' | 'failed'
  relevant: boolean | null
  matchedRequestedRegions: KazhydrometRegion[] | null
  coverage: SourceCoverageTag[]
}

export interface PublicArticleIdentityInput {
  id: string
  originalUrl: string
  canonicalUrl: string
  publisher: string
  title: string
  sha256: string
  metadata: Record<string, unknown>
}

export interface PublicArticleDocument {
  id: string
  canonicalUrl: string
  publisher: string
  title: string
  publishedAt: Date | null
  sha256: string | null
  cachePath: string | null
}
