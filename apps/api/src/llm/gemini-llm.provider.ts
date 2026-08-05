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
import {
  DEFAULT_GEMINI_FREE_TIER_MODEL,
  GEMINI_MAX_INPUT_BYTES,
  GEMINI_MAX_OUTPUT_TOKENS,
  GeminiProcessQuota,
  isGeminiFreeTierEligibleModel,
} from './free-tier-policy'
import {
  GEMINI_RESPONSE_JSON_SCHEMAS,
  type GeminiResponseJsonSchema,
} from './gemini-response-schemas'

@Injectable()
export class GeminiLlmProvider implements LlmProvider {
  private readonly apiKey: string | undefined
  private readonly model: string
  private readonly timeoutMs: number
  private readonly quota = new GeminiProcessQuota()

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GEMINI_API_KEY')
    this.model = config.get<string>('GEMINI_MODEL') ?? DEFAULT_GEMINI_FREE_TIER_MODEL
    this.timeoutMs = config.get<number>('HTTP_TIMEOUT_MS') ?? 12_000
    if (!isGeminiFreeTierEligibleModel(this.model)) {
      throw new ServiceUnavailableException({
        code: 'LLM_MODEL_NOT_FREE_TIER_ELIGIBLE',
        message: 'Only explicitly allowlisted Gemini free-tier-eligible models are permitted',
      })
    }
  }

  extractIncidentSignal(input: SourceTextInput): Promise<ExtractedSignal | null> {
    return this.generate(
      LLM_PROMPTS.incidentSignal,
      input,
      ExtractedSignalSchema,
      GEMINI_RESPONSE_JSON_SCHEMAS.incidentSignal,
    )
  }

  extractMeasurementCandidates(input: SourceTextInput): Promise<MeasurementCandidate[]> {
    return this.generate(
      LLM_PROMPTS.measurementCandidates,
      input,
      MeasurementCandidatesSchema,
      GEMINI_RESPONSE_JSON_SCHEMAS.measurementCandidates,
    )
  }

  classifyPossibleDuplicate(input: DuplicateInput): Promise<DuplicateAssessment> {
    return this.generate(
      LLM_PROMPTS.duplicate,
      input,
      DuplicateAssessmentSchema,
      GEMINI_RESPONSE_JSON_SCHEMAS.duplicate,
    )
  }

  explainFacts(input: ExplanationInput): Promise<GeneratedExplanation | null> {
    return this.generate(
      LLM_PROMPTS.explanation,
      input,
      GeneratedExplanationSchema,
      GEMINI_RESPONSE_JSON_SCHEMAS.explanation,
    )
  }

  private async generate<T>(
    instruction: string,
    input: unknown,
    schema: { parse(value: unknown): T },
    responseJsonSchema: GeminiResponseJsonSchema,
  ): Promise<T> {
    if (this.apiKey === undefined || this.apiKey.length === 0) {
      throw new ServiceUnavailableException({
        code: 'LLM_NOT_CONFIGURED',
        message: 'GEMINI_API_KEY is required for the Gemini provider',
      })
    }
    const prompt = `${instruction}\nINPUT:\n${JSON.stringify(input)}`
    if (Buffer.byteLength(prompt, 'utf8') > GEMINI_MAX_INPUT_BYTES) {
      throw new Error('LLM_FREE_TIER_INPUT_LIMIT')
    }
    this.quota.consume()
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
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseJsonSchema,
              maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
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
