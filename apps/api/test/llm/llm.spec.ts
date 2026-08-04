import { DisabledLlmProvider } from '../../src/llm/disabled-llm.provider'
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
})

function providerWith(overrides: Partial<LlmProvider>): LlmProvider {
  const disabled = new DisabledLlmProvider()
  return Object.assign(disabled, overrides)
}
