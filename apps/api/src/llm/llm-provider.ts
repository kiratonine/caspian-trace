import type {
  DuplicateAssessment,
  ExtractedSignal,
  GeneratedExplanation,
  MeasurementCandidate,
} from './schemas/llm.schemas'

export const LLM_PROVIDER = Symbol('LLM_PROVIDER')

export type SourceTextInput = { sourceText: string }
export type DuplicateInput = { firstText: string; secondText: string }
export type ExplanationInput = { facts: string[]; unknowns: string[] }

export interface LlmProvider {
  extractIncidentSignal(input: SourceTextInput): Promise<ExtractedSignal | null>
  extractMeasurementCandidates(input: SourceTextInput): Promise<MeasurementCandidate[]>
  classifyPossibleDuplicate(input: DuplicateInput): Promise<DuplicateAssessment>
  explainFacts(input: ExplanationInput): Promise<GeneratedExplanation | null>
}
