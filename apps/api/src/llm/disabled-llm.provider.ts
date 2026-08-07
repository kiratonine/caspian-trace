import { Injectable } from '@nestjs/common'

import type { LlmProvider } from './llm-provider'
import type {
  DuplicateAssessment,
  ExtractedSignal,
  GeneratedExplanation,
  MeasurementCandidate,
} from './schemas/llm.schemas'

@Injectable()
export class DisabledLlmProvider implements LlmProvider {
  extractIncidentSignal(): Promise<ExtractedSignal | null> {
    return Promise.resolve(null)
  }

  extractMeasurementCandidates(): Promise<MeasurementCandidate[]> {
    return Promise.resolve([])
  }

  classifyPossibleDuplicate(): Promise<DuplicateAssessment> {
    return Promise.resolve({
      isDuplicate: false,
      confidence: 0,
      rationale: 'LLM provider is disabled; no duplicate decision was made.',
      evidenceQuotes: [],
    })
  }

  explainFacts(): Promise<GeneratedExplanation | null> {
    return Promise.resolve(null)
  }
}
