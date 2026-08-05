import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
require('reflect-metadata')

if (process.env.GEMINI_BILLING_TIER !== 'free') {
  throw new Error(
    'Refusing Gemini smoke test: confirm GEMINI_BILLING_TIER=free after checking AI Studio billing status',
  )
}
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is required for the live Gemini smoke test')
}

const { ConfigService } = require('@nestjs/config')
const {
  DEFAULT_GEMINI_FREE_TIER_MODEL,
  isGeminiFreeTierEligibleModel,
} = require('../apps/api/dist/llm/free-tier-policy.js')
const { GeminiLlmProvider } = require(
  '../apps/api/dist/llm/gemini-llm.provider.js'
)
const { LlmService } = require('../apps/api/dist/llm/llm.service.js')

const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_FREE_TIER_MODEL
assert.ok(
  isGeminiFreeTierEligibleModel(model),
  `Model ${model} is not free-tier-eligible`,
)

const provider = new GeminiLlmProvider(
  new ConfigService({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: model,
    HTTP_TIMEOUT_MS: 12_000,
  }),
)
const service = new LlmService(provider)
const candidates = await service.extractMeasurementCandidates({
  sourceText: 'Нефтепродукты — 0,114 мг/дм3.',
})

assert.ok(candidates.length > 0, 'Gemini returned no measurement candidates')
console.log(
  `Gemini free-tier smoke passed with ${model}; ${candidates.length} candidate(s) validated.`,
)
