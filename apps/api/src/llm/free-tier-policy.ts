export const GEMINI_FREE_TIER_ELIGIBLE_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
] as const

export const DEFAULT_GEMINI_FREE_TIER_MODEL =
  GEMINI_FREE_TIER_ELIGIBLE_MODELS[0]
export const GEMINI_MAX_INPUT_BYTES = 32 * 1024
export const GEMINI_MAX_OUTPUT_TOKENS = 512
export const GEMINI_MAX_REQUESTS_PER_MINUTE = 2
export const GEMINI_MAX_REQUESTS_PER_ROLLING_DAY = 20

export type GeminiFreeTierEligibleModel =
  (typeof GEMINI_FREE_TIER_ELIGIBLE_MODELS)[number]

export function isGeminiFreeTierEligibleModel(
  value: string,
): value is GeminiFreeTierEligibleModel {
  return GEMINI_FREE_TIER_ELIGIBLE_MODELS.some((model) => model === value)
}

export class GeminiProcessQuota {
  private readonly requests: number[] = []

  consume(now = Date.now()): void {
    const rollingDayStart = now - 24 * 60 * 60 * 1_000
    while (
      this.requests[0] !== undefined &&
      this.requests[0] <= rollingDayStart
    ) {
      this.requests.shift()
    }
    if (this.requests.length >= GEMINI_MAX_REQUESTS_PER_ROLLING_DAY) {
      throw new Error('LLM_FREE_TIER_DAILY_LIMIT')
    }
    const minuteStart = now - 60 * 1_000
    const requestsInLastMinute = this.requests.filter(
      (requestedAt) => requestedAt > minuteStart,
    ).length
    if (requestsInLastMinute >= GEMINI_MAX_REQUESTS_PER_MINUTE) {
      throw new Error('LLM_FREE_TIER_MINUTE_LIMIT')
    }
    this.requests.push(now)
  }
}
