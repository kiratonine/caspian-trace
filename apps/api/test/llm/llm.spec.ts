import { DisabledLlmProvider } from '../../src/llm/disabled-llm.provider'
import { GeminiLlmProvider } from '../../src/llm/gemini-llm.provider'
import type { LlmProvider } from '../../src/llm/llm-provider'
import { LlmService } from '../../src/llm/llm.service'

describe('LLM validation boundary', () => {
  it('works conservatively with the provider disabled', async () => {
    const service = new LlmService(new DisabledLlmProvider())
    await expect(service.extractIncidentSignal({ sourceText: 'text' })).resolves.toBeNull()
    await expect(service.extractMeasurementCandidates({ sourceText: 'text' })).resolves.toEqual([])
    await expect(service.explainFacts({ facts: [], unknowns: [] })).resolves.toBeNull()
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

  it('rejects a new number and accusatory wording in explanations', async () => {
    const numeric = new LlmService(providerWith({
      explainFacts: () => Promise.resolve({ text: 'Значение выросло до 0,7.' }),
    }))
    await expect(numeric.explainFacts({ facts: ['Значение 0,5.'], unknowns: [] }))
      .rejects.toThrow('LLM_NUMBER_MUTATION')

    const blame = new LlmService(providerWith({
      explainFacts: () => Promise.resolve({ text: 'Объект виновен.' }),
    }))
    await expect(blame.explainFacts({ facts: ['Объект проверяется.'], unknowns: [] }))
      .rejects.toThrow('LLM_FORBIDDEN_BLAME')
  })

  it('rejects unsupported temporal precision and mutated table numbers', async () => {
    const temporal = new LlmService(providerWith({
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
    await expect(
      temporal.extractIncidentSignal({ sourceText: 'Отмечена зелёная вода.' }),
    ).rejects.toThrow('LLM_DATE_PRECISION_UNSUPPORTED')

    const measurement = new LlmService(providerWith({
      extractMeasurementCandidates: () => Promise.resolve([{
        indicator: 'нефтепродукты',
        rawValueText: '0,193',
        unit: 'мг/дм3',
        evidenceQuote: 'В таблице указано 0,114 мг/дм3.',
        confidence: 0.9,
      }]),
    }))
    await expect(
      measurement.extractMeasurementCandidates({
        sourceText: 'В таблице указано 0,114 мг/дм3.',
      }),
    ).rejects.toThrow('LLM_NUMBER_MUTATION')
  })

  it('parses structured JSON through the Gemini adapter without a real network call', async () => {
    const previousKey = process.env.GEMINI_API_KEY
    process.env.GEMINI_API_KEY = 'test-key'
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          observedAt: null,
          observedPeriod: '2025-09',
          locationText: 'Атырау',
          phenomenon: 'color_change',
          excerpt: 'зелёная вода',
          evidenceQuotes: ['зелёная вода'],
          confidence: 0.75,
        }) }] } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    try {
      await expect(
        new GeminiLlmProvider().extractIncidentSignal({ sourceText: 'зелёная вода' }),
      ).resolves.toMatchObject({ phenomenon: 'color_change', confidence: 0.75 })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      fetchMock.mockRestore()
      if (previousKey === undefined) delete process.env.GEMINI_API_KEY
      else process.env.GEMINI_API_KEY = previousKey
    }
  })
})

function providerWith(overrides: Partial<LlmProvider>): LlmProvider {
  const disabled = new DisabledLlmProvider()
  return Object.assign(disabled, overrides)
}
