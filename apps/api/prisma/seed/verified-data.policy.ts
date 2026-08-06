import type {
  RelationBasis,
  VerifiedStationRelation,
} from './verified-data.schemas'
import type { HumanReviewSummary } from './verified-seed.types'
import { VerifiedSeedError } from './verified-seed.errors'

const NON_HUMAN_REVIEWERS = new Set([
  'automated',
  'automation',
  'bot',
  'placeholder',
  'service',
  'system',
  'unknown',
  'agent',
  'codex',
  'test',
  'testing',
])

const GITHUB_LIKE_REVIEWER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/
const DENIED_PREFIX = /^(?:bot|codex|agent|automat|service|system|test)/

export function isHumanReviewer(value: string): boolean {
  const normalized = value.toLowerCase()
  const tokens = normalized.split('-')
  return (
    GITHUB_LIKE_REVIEWER.test(value) &&
    !value.includes('--') &&
    !DENIED_PREFIX.test(normalized) &&
    !normalized.endsWith('bot') &&
    !tokens.some(
      (token) =>
        NON_HUMAN_REVIEWERS.has(token) || DENIED_PREFIX.test(token),
    )
  )
}

export function calculateHumanReview(
  checkedBy: string[][],
  required: number,
): HumanReviewSummary {
  const completed = checkedBy.reduce(
    (minimum, reviewers) =>
      Math.min(
        minimum,
        new Set(
          reviewers
            .filter(isHumanReviewer)
            .map((reviewer) => reviewer.toLowerCase()),
        ).size,
      ),
    Number.POSITIVE_INFINITY,
  )
  const finiteCompleted = Number.isFinite(completed) ? completed : 0
  return {
    required,
    completed: finiteCompleted,
    complete: finiteCompleted >= required,
  }
}

export function assertManifestReviewMatches(
  manifest: {
    reviewPolicy: {
      completedHumanReviewers: number
      requiredHumanReviewers: number
      status: 'pending' | 'complete'
    }
  },
  computed: HumanReviewSummary,
): void {
  const expectedStatus = computed.complete ? 'complete' : 'pending'
  if (
    manifest.reviewPolicy.completedHumanReviewers !== computed.completed ||
    manifest.reviewPolicy.status !== expectedStatus
  ) {
    throw new VerifiedSeedError(
      'VERIFIED_DATA_HUMAN_REVIEW_INVALID',
      'Manifest human review fields do not match evidence item reviewers',
    )
  }
}

export function assertHumanReviewComplete(review: HumanReviewSummary): void {
  if (!review.complete) {
    throw new VerifiedSeedError(
      'VERIFIED_DATA_HUMAN_REVIEW_INCOMPLETE',
      `Human verification is incomplete: ${review.completed}/${review.required}`,
    )
  }
}

export function relationCanBeVerified(
  relation: VerifiedStationRelation,
  review: HumanReviewSummary,
  stationLabels: ReadonlyMap<string, string>,
): boolean {
  if (!review.complete || relation.basis !== 'official_paired_above_below_labels') {
    return false
  }
  const upstream = stationLabels.get(relation.upstreamStationId)?.toLowerCase()
  const downstream = stationLabels.get(relation.downstreamStationId)?.toLowerCase()
  return Boolean(
    upstream?.includes('выше') &&
      downstream?.includes('ниже') &&
      sharedDischargeLabel(upstream, downstream),
  )
}

function sharedDischargeLabel(upstream: string, downstream: string): boolean {
  const marker = 'сброса '
  const upstreamIndex = upstream.indexOf(marker)
  const downstreamIndex = downstream.indexOf(marker)
  return (
    upstreamIndex >= 0 &&
    downstreamIndex >= 0 &&
    upstream.slice(upstreamIndex + marker.length) ===
      downstream.slice(downstreamIndex + marker.length)
  )
}

export function relationStatusForBasis(
  basis: RelationBasis,
  eligible: boolean,
): 'OFFICIAL' | 'UNVERIFIED' {
  return basis === 'official_paired_above_below_labels' && eligible
    ? 'OFFICIAL'
    : 'UNVERIFIED'
}
