export function parseRetryAfterMilliseconds(
  value: string | undefined,
  nowMs: number,
  maximumMs: number,
): number | null {
  if (value === undefined) return null
  if (/^\d+$/.test(value)) {
    const seconds = Number(value)
    if (!Number.isSafeInteger(seconds)) return maximumMs
    return Math.min(seconds * 1_000, maximumMs)
  }

  const retryAt = Date.parse(value)
  if (!Number.isFinite(retryAt)) return null
  return Math.min(Math.max(0, retryAt - nowMs), maximumMs)
}

export function calculateBackoffMilliseconds(input: {
  retryIndex: number
  baseDelayMs: number
  maximumDelayMs: number
  random: number
}): number {
  const random = Math.min(Math.max(input.random, 0), 0.999_999_999)
  const exponential = input.baseDelayMs * 2 ** input.retryIndex
  const jitter = Math.floor(random * input.baseDelayMs)
  return Math.min(exponential + jitter, input.maximumDelayMs)
}
