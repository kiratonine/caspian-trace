import { buildConclusion } from './conclusion'
import { classifyObjects, deriveCorridor } from './corridor'
import { deriveEvidenceLevel } from './evidence-level'
import { buildSupportedFacts, excludeDownstreamExplanations } from './exclusions'
import { calculateInputHash } from './hash'
import { evaluatePairedIntervals } from './intervals'
import { buildUnknowns } from './unknowns'
import type { InvestigationInput, InvestigationResult } from './types'

export const RULESET_VERSION = '1.0.0'

export function runInvestigation(input: InvestigationInput): InvestigationResult {
  const intervals = evaluatePairedIntervals(input)
  const supportedFacts = buildSupportedFacts(input, intervals)
  const contradictedHypotheses = excludeDownstreamExplanations(input, intervals)
  const corridorBounds = deriveCorridor(input, intervals, contradictedHypotheses)
  const evidenceLevel = deriveEvidenceLevel(
    input,
    corridorBounds,
    supportedFacts,
    contradictedHypotheses,
  )
  const partial = {
    evidenceLevel,
    corridorBounds,
    supportedFacts,
    contradictedHypotheses,
    objectDispositions: classifyObjects(input, corridorBounds, contradictedHypotheses),
    unknowns: buildUnknowns(input, corridorBounds),
  }
  return {
    ...partial,
    conclusion: buildConclusion(input, partial),
    inputHash: calculateInputHash(input),
    rulesetVersion: RULESET_VERSION,
  }
}
