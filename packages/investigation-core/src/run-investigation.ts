import { buildConclusion } from './conclusion'
import { classifyObjects, deriveCorridor } from './corridor'
import { deriveEvidenceLevel } from './evidence-level'
import { buildSupportedFacts, excludeDownstreamExplanations } from './exclusions'
import { calculateInputHash, canonicalizeInvestigationInput } from './hash'
import { evaluatePairedIntervals } from './intervals'
import { buildUnknowns } from './unknowns'
import type { InvestigationInput, InvestigationResult } from './types'

export const RULESET_VERSION = '1.2.0'

export function runInvestigation(input: InvestigationInput): InvestigationResult {
  const canonicalInput = canonicalizeInvestigationInput(input)
  const intervals = evaluatePairedIntervals(canonicalInput)
  const supportedFacts = buildSupportedFacts(canonicalInput, intervals).map(
    (statement, sortOrder) => ({ ...statement, sortOrder }),
  )
  const contradictedHypotheses = excludeDownstreamExplanations(
    canonicalInput,
    intervals,
  ).map((statement, index) => ({
    ...statement,
    sortOrder: supportedFacts.length + index,
  }))
  const corridorBounds = deriveCorridor(
    canonicalInput,
    intervals,
    contradictedHypotheses,
  )
  const evidenceLevel = deriveEvidenceLevel(
    canonicalInput,
    corridorBounds,
    supportedFacts,
    contradictedHypotheses,
  )
  const partial = {
    evidenceLevel,
    corridorBounds,
    supportedFacts,
    contradictedHypotheses,
    objectDispositions: classifyObjects(
      canonicalInput,
      corridorBounds,
      contradictedHypotheses,
    ),
    unknowns: buildUnknowns(canonicalInput, corridorBounds),
  }
  return {
    ...partial,
    conclusion: buildConclusion(canonicalInput, partial),
    inputHash: calculateInputHash(canonicalInput),
    rulesetVersion: RULESET_VERSION,
  }
}
