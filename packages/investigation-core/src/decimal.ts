const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?$/

/** Exact finite decimal arithmetic for laboratory values, backed by bigint. */
export class ExactDecimal {
  readonly coefficient: bigint
  readonly scale: number

  private constructor(coefficient: bigint, scale: number) {
    let normalizedCoefficient = coefficient
    let normalizedScale = scale
    while (normalizedScale > 0 && normalizedCoefficient % 10n === 0n) {
      normalizedCoefficient /= 10n
      normalizedScale -= 1
    }
    this.coefficient = normalizedCoefficient
    this.scale = normalizedScale
  }

  static parse(value: string): ExactDecimal {
    const match = DECIMAL_PATTERN.exec(value.trim())
    if (!match) throw new Error(`Invalid decimal value: ${value}`)
    const sign = match[1] === '-' ? -1n : 1n
    const fraction = match[3] ?? ''
    return new ExactDecimal(sign * BigInt(`${match[2]}${fraction}`), fraction.length)
  }

  subtract(other: ExactDecimal): ExactDecimal {
    const scale = Math.max(this.scale, other.scale)
    return new ExactDecimal(
      this.coefficient * powerOfTen(scale - this.scale) -
        other.coefficient * powerOfTen(scale - other.scale),
      scale,
    )
  }

  compare(other: ExactDecimal): -1 | 0 | 1 {
    const difference = this.subtract(other).coefficient
    return difference < 0n ? -1 : difference > 0n ? 1 : 0
  }

  toString(): string {
    const negative = this.coefficient < 0n
    const digits = (negative ? -this.coefficient : this.coefficient).toString()
    if (this.scale === 0) return `${negative ? '-' : ''}${digits}`
    const padded = digits.padStart(this.scale + 1, '0')
    const splitAt = padded.length - this.scale
    return `${negative ? '-' : ''}${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`
  }
}

function powerOfTen(exponent: number): bigint {
  return 10n ** BigInt(exponent)
}
