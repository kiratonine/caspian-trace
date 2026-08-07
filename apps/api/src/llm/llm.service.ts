import { Inject, Injectable } from '@nestjs/common'

import {
  LLM_PROVIDER,
  type DuplicateInput,
  type ExplanationInput,
  type LlmProvider,
  type SourceTextInput,
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

const FORBIDDEN_BLAME =
  /(винов(?:ен|на|ны)|нарушител|доказан(?:о|а)?|причинил(?:а|и)?|ответствен(?:ен|на|ны)|(?<!не\s)источник\s+установлен|объект\s+не\s+причастен)/iu
const NUMBER = /[-+]?\d+(?:[.,]\d+)?/gu

@Injectable()
export class LlmService {
  constructor(@Inject(LLM_PROVIDER) private readonly provider: LlmProvider) {}

  async extractIncidentSignal(input: SourceTextInput): Promise<ExtractedSignal | null> {
    const raw = await this.provider.extractIncidentSignal(input)
    if (raw === null) return null
    const result = ExtractedSignalSchema.parse(raw)
    validateQuotes(input.sourceText, result.evidenceQuotes)
    if (!input.sourceText.includes(result.excerpt)) {
      throw new Error('LLM_EXCERPT_NOT_FOUND')
    }
    if (!result.evidenceQuotes.some((quote) => result.excerpt.includes(quote))) {
      throw new Error('LLM_EXCERPT_NOT_SUPPORTED_BY_QUOTE')
    }
    validateTemporalPrecision(input.sourceText, result.observedAt, result.observedPeriod)
    return result
  }

  async extractMeasurementCandidates(input: SourceTextInput): Promise<MeasurementCandidate[]> {
    const result = MeasurementCandidatesSchema.parse(
      await this.provider.extractMeasurementCandidates(input),
    )
    validateQuotes(input.sourceText, result.map(({ evidenceQuote }) => evidenceQuote))
    for (const item of result) {
      validateNoNewNumbers(item.evidenceQuote, `${item.rawValueText} ${item.unit}`)
    }
    return result
  }

  async classifyPossibleDuplicate(input: DuplicateInput): Promise<DuplicateAssessment> {
    const result = DuplicateAssessmentSchema.parse(
      await this.provider.classifyPossibleDuplicate(input),
    )
    validateQuotes(`${input.firstText}\n${input.secondText}`, result.evidenceQuotes)
    return result
  }

  async explainFacts(input: ExplanationInput): Promise<GeneratedExplanation | null> {
    const raw = await this.provider.explainFacts(input)
    if (raw === null) return null
    const result = GeneratedExplanationSchema.parse(raw)
    const allowed = [...input.facts, ...input.unknowns].join('\n')
    validateNoNewNumbers(allowed, result.text)
    if (FORBIDDEN_BLAME.test(result.text)) throw new Error('LLM_FORBIDDEN_BLAME')
    return result
  }
}

export function validateQuotes(sourceText: string, quotes: string[]): void {
  if (quotes.some((quote) => !sourceText.includes(quote))) {
    throw new Error('LLM_QUOTE_NOT_FOUND')
  }
}

export function validateNoNewNumbers(allowedText: string, generatedText: string): void {
  const allowed = new Set(numbers(allowedText))
  if (numbers(generatedText).some((number) => !allowed.has(number))) {
    throw new Error('LLM_NUMBER_MUTATION')
  }
}

function numbers(value: string): string[] {
  return [...value.matchAll(NUMBER)].map(([number]) => number.replace(',', '.'))
}

function validateTemporalPrecision(
  sourceText: string,
  observedAt: string | null,
  observedPeriod: string | null,
): void {
  if (observedAt !== null) {
    const [year, month, day] = observedAt.slice(0, 10).split('-')
    if (
      year === undefined || month === undefined || day === undefined ||
      (!sourceText.includes(`${year}-${month}-${day}`) &&
        !sourceText.includes(`${day}.${month}.${year}`))
    ) {
      throw new Error('LLM_DATE_PRECISION_UNSUPPORTED')
    }
  }
  if (observedPeriod !== null) {
    const [year, month] = observedPeriod.split('-')
    const monthPattern = month === undefined ? undefined : RUSSIAN_MONTH_PATTERNS[month]
    if (
      year === undefined || month === undefined ||
      (!sourceText.includes(observedPeriod) &&
        !sourceText.includes(`${month}.${year}`) &&
        (monthPattern === undefined ||
          !new RegExp(`${monthPattern}\\s+${year}`, 'iu').test(sourceText)))
    ) {
      throw new Error('LLM_DATE_PRECISION_UNSUPPORTED')
    }
  }
}

const RUSSIAN_MONTH_PATTERNS: Readonly<Record<string, string>> = {
  '01': 'январ\\p{L}*',
  '02': 'феврал\\p{L}*',
  '03': 'март\\p{L}*',
  '04': 'апрел\\p{L}*',
  '05': 'ма(?:й|я|е|ю)',
  '06': 'июн\\p{L}*',
  '07': 'июл\\p{L}*',
  '08': 'август\\p{L}*',
  '09': 'сентябр\\p{L}*',
  '10': 'октябр\\p{L}*',
  '11': 'ноябр\\p{L}*',
  '12': 'декабр\\p{L}*',
}
