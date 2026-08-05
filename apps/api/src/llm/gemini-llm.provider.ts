import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

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
import { LLM_PROMPTS } from './prompts/llm.prompts'

@Injectable()
export class GeminiLlmProvider implements LlmProvider {
  private readonly apiKey: string | undefined
  private readonly model: string
  private readonly timeoutMs: number

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GEMINI_API_KEY')
    this.model = config.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash'
    this.timeoutMs = config.get<number>('HTTP_TIMEOUT_MS') ?? 12_000
  }

  extractIncidentSignal(input: SourceTextInput): Promise<ExtractedSignal | null> {
    return this.generate(LLM_PROMPTS.incidentSignal, input, ExtractedSignalSchema)
  }

  extractMeasurementCandidates(input: SourceTextInput): Promise<MeasurementCandidate[]> {
    return this.generate(
      LLM_PROMPTS.measurementCandidates,
      input,
      MeasurementCandidatesSchema,
    )
  }

  classifyPossibleDuplicate(input: DuplicateInput): Promise<DuplicateAssessment> {
    return this.generate(LLM_PROMPTS.duplicate, input, DuplicateAssessmentSchema)
  }

  explainFacts(input: ExplanationInput): Promise<GeneratedExplanation | null> {
    return this.generate(LLM_PROMPTS.explanation, input, GeneratedExplanationSchema)
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
    let response: Response
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${instruction}\nINPUT:\n${JSON.stringify(input)}` },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0,
            },
          }),
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      )
    } catch {
      throw new ServiceUnavailableException({
        code: 'LLM_PROVIDER_FAILED',
        message: 'Gemini request failed before a response was received',
      })
    }
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
