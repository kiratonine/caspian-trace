import { DisabledLlmProvider } from '../../src/llm/disabled-llm.provider'
import type { LlmProvider } from '../../src/llm/llm-provider'
import { LlmService } from '../../src/llm/llm.service'

describe('disabled LLM validation boundary', () => {
  it('returns conservative values without an external transport', async () => {
    const provider = new DisabledLlmProvider()
    const service = new LlmService(provider)

    await expect(service.extractIncidentSignal({ sourceText: 'text' })).resolves.toBeNull()
    await expect(service.extractMeasurementCandidates({ sourceText: 'text' })).resolves.toEqual([])
    await expect(service.explainFacts({ facts: [], unknowns: [] })).resolves.toBeNull()
    await expect(provider.classifyPossibleDuplicate())
      .resolves.toMatchObject({ isDuplicate: false, confidence: 0 })
  })

  it('rejects a quote absent from the source', async () => {
    const service = new LlmService(providerWith({
      extractIncidentSignal: () => Promise.resolve({
        observedAt: null,
        observedPeriod: '2025-09',
        locationText: 'Атырау',
        phenomenon: 'color_change',
        excerpt: 'invented quote',
        evidenceQuotes: ['invented quote'],
        confidence: 0.9,
      }),
    }))
    await expect(service.extractIncidentSignal({ sourceText: 'original text' }))
      .rejects.toThrow('LLM_QUOTE_NOT_FOUND')
  })

  it('rejects an excerpt that is not exact source text', async () => {
    const service = new LlmService(providerWith({
      extractIncidentSignal: () => Promise.resolve({
        observedAt: null,
        observedPeriod: null,
        locationText: 'Атырау',
        phenomenon: 'color_change',
        excerpt: 'зелёная вода и неподтверждённое описание',
        evidenceQuotes: ['зелёная вода'],
        confidence: 0.9,
      }),
    }))
    await expect(service.extractIncidentSignal({ sourceText: 'Отмечена зелёная вода.' }))
      .rejects.toThrow('LLM_EXCERPT_NOT_FOUND')
  })

  it('rejects unsupported temporal precision', async () => {
    const service = new LlmService(providerWith({
      extractIncidentSignal: () => Promise.resolve({
        observedAt: '2025-09-03T12:00:00+05:00',
        observedPeriod: null,
        locationText: 'Атырау',
        phenomenon: 'color_change',
        excerpt: 'зелёная вода',
        evidenceQuotes: ['зелёная вода'],
        confidence: 0.8,
      }),
    }))
    await expect(service.extractIncidentSignal({ sourceText: 'Отмечена зелёная вода.' }))
      .rejects.toThrow('LLM_DATE_PRECISION_UNSUPPORTED')
  })

  it('rejects mutated measurement numbers', async () => {
    const service = new LlmService(providerWith({
      extractMeasurementCandidates: () => Promise.resolve([{
        indicator: 'нефтепродукты',
        rawValueText: '0,193',
        unit: 'мг/дм3',
        evidenceQuote: 'В таблице указано 0,114 мг/дм3.',
        confidence: 0.9,
      }]),
    }))
    await expect(service.extractMeasurementCandidates({
      sourceText: 'В таблице указано 0,114 мг/дм3.',
    })).rejects.toThrow('LLM_NUMBER_MUTATION')
  })

  it('rejects new numbers and forbidden blame in explanations', async () => {
    const numeric = new LlmService(providerWith({
      explainFacts: () => Promise.resolve({ text: 'Значение выросло до 0,7.' }),
    }))
    await expect(numeric.explainFacts({ facts: ['Значение 0,5.'], unknowns: [] }))
      .rejects.toThrow('LLM_NUMBER_MUTATION')

    for (const text of ['Объект виновен.', 'Источник установлен.', 'Объект не причастен.']) {
      const service = new LlmService(providerWith({
        explainFacts: () => Promise.resolve({ text }),
      }))
      await expect(service.explainFacts({ facts: ['Объект проверяется.'], unknowns: [] }))
        .rejects.toThrow('LLM_FORBIDDEN_BLAME')
    }
  })
})

function providerWith(overrides: Partial<LlmProvider>): LlmProvider {
  return Object.assign(new DisabledLlmProvider(), overrides)
}
