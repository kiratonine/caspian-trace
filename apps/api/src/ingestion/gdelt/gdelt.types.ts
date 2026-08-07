import type { SafeFetchMetadata } from '../../common/http/safe-fetch/safe-fetch.types'
import type { PublicArticleCandidate } from '../article/article.types'

export interface GdeltDiscoveryResult {
  candidates: PublicArticleCandidate[]
  discoveredCount: number
  invalidCandidateCount: number
  metadata: SafeFetchMetadata
  queryHash: string
}
