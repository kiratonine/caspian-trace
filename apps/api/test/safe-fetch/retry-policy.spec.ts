import {
  calculateBackoffMilliseconds,
  parseRetryAfterMilliseconds,
} from '../../src/common/http/safe-fetch/retry-policy'

describe('SafeFetch retry policy', () => {
  it('parses Retry-After seconds and caps the delay', () => {
    expect(parseRetryAfterMilliseconds('2', 1_000, 5_000)).toBe(2_000)
    expect(parseRetryAfterMilliseconds('99', 1_000, 5_000)).toBe(5_000)
  })

  it('parses Retry-After HTTP dates and treats past dates as immediate', () => {
    expect(
      parseRetryAfterMilliseconds(
        'Thu, 01 Jan 1970 00:00:03 GMT',
        1_000,
        5_000,
      ),
    ).toBe(2_000)
    expect(
      parseRetryAfterMilliseconds(
        'Thu, 01 Jan 1970 00:00:00 GMT',
        1_000,
        5_000,
      ),
    ).toBe(0)
  })

  it('returns null for absent or invalid Retry-After', () => {
    expect(parseRetryAfterMilliseconds(undefined, 0, 100)).toBeNull()
    expect(parseRetryAfterMilliseconds('later', 0, 100)).toBeNull()
  })

  it('applies exponential backoff, jitter, and cap', () => {
    expect(
      calculateBackoffMilliseconds({
        retryIndex: 0,
        baseDelayMs: 250,
        maximumDelayMs: 5_000,
        random: 0.5,
      }),
    ).toBe(375)
    expect(
      calculateBackoffMilliseconds({
        retryIndex: 5,
        baseDelayMs: 250,
        maximumDelayMs: 5_000,
        random: 0.99,
      }),
    ).toBe(5_000)
  })
})
