import { Injectable, ServiceUnavailableException } from '@nestjs/common'

import type {
  DuplicateInput,
  ExplanationInput,
  LlmProvider,
  SourceTextInput,
} from './llm-provider'
import {
  DuplicateAssessmentSchema,
  ExtractedSignalSchema,
  GeneratedExplanationSchema,
  MeasurementCandidatesSchema,
  type DuplicateAssessment,
  type ExtractedSignal,
  type GeneratedExplanation,
  type MeasurementCandidate,
} from './schemas/llm.schemas'

@Injectable()
export class GeminiLlmProvider implements LlmProvider {
  private readonly apiKey = process.env.GEMINI_API_KEY
  private readonly model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'

  extractIncidentSignal(input: SourceTextInput): Promise<ExtractedSignal | null> {
    return this.generate('Extract one incident signal as JSON. Do not infer absent fields.', input, ExtractedSignalSchema)
  }

  extractMeasurementCandidates(input: SourceTextInput): Promise<MeasurementCandidate[]> {
    return this.generate('Extract only explicitly quoted measurement candidates as a JSON array.', input, MeasurementCandidatesSchema)
  }

  classifyPossibleDuplicate(input: DuplicateInput): Promise<DuplicateAssessment> {
    return this.generate('Assess possible duplication as JSON. Quote only exact input text.', input, DuplicateAssessmentSchema)
  }

  explainFacts(input: ExplanationInput): Promise<GeneratedExplanation | null> {
    return this.generate('Explain only the supplied facts and unknowns as JSON. Add no numbers or blame.', input, GeneratedExplanationSchema)
  }

  private async generate<T>(
    instruction: string,
    input: unknown,
    schema: { parse(value: unknown): T },
  ): Promise<T> {
    if (this.apiKey === undefined || this.apiKey.length === 0) {
      throw new ServiceUnavailableException({
        code: 'LLM_NOT_CONFIGURED',
        message: 'GEMINI_API_KEY is required for the Gemini provider',
      })
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${instruction}\nINPUT:\n${JSON.stringify(input)}` }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0 },
        }),
      },
    )
    if (!response.ok) {
      throw new ServiceUnavailableException({
        code: 'LLM_PROVIDER_FAILED',
        message: `Gemini request failed with status ${response.status}`,
      })
    }
    const payload = await response.json() as GeminiResponse
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text
    if (text === undefined) throw new Error('LLM_EMPTY_RESPONSE')
    return schema.parse(JSON.parse(text) as unknown)
  }
}

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
}
