import {
  extractMeasurementCandidates,
  findRelevantPages,
  normalizeDecimal,
  validateCandidateAgainstText,
} from '../../src/ingestion/kazhydromet/kazhydromet-candidates'
import type { MeasurementCandidate, PdfPage } from '../../src/ingestion/kazhydromet/kazhydromet.types'

const page: PdfPage = {
  pageNumber: 7,
  text: 'Атырау, река Жайык\nНефтепродукты 0,234 мг/дм³',
  textSha256: 'a'.repeat(64),
}

describe('Kazhydromet relevant pages and candidate-only extraction', () => {
  it('requires indicator and regional/water marker without hardcoded pages', () => {
    expect(findRelevantPages([page])).toEqual([
      expect.objectContaining({ pageNumber: 7 }),
    ])
    expect(findRelevantPages([{ ...page, text: 'Нефтепродукты 0,234 мг/дм³' }])).toEqual([])
    expect(findRelevantPages([{ ...page, pageNumber: 99 }])[0]?.pageNumber).toBe(99)
  })

  it('preserves raw decimal comma and normalizes without JS float', () => {
    const candidates = extractMeasurementCandidates(page)
    expect(candidates).toEqual([
      expect.objectContaining({ rawValueText: '0,234', normalizedValue: '0.234', stationLabel: null }),
    ])
    expect(validateCandidateAgainstText(candidates[0]!, page)).toEqual({ valid: true })
    expect(normalizeDecimal('12345678901234567890,0001')).toBe('12345678901234567890.0001')
  })

  it('does not extract a value without explicit unit or indicator', () => {
    expect(extractMeasurementCandidates({ ...page, text: 'Нефтепродукты 0,234' })).toEqual([])
    expect(extractMeasurementCandidates({ ...page, text: 'Атырау 0,234 мг/дм3' })).toEqual([])
  })

  it('accepts an explicit PDF superscript split onto the adjacent extracted line', () => {
    const splitPage = { ...page, text: 'Атырау Жайык\nНефтепродукты 0,234 мг/дм\n3' }
    expect(extractMeasurementCandidates(splitPage)).toEqual([
      expect.objectContaining({ rawValueText: '0,234', sourceExcerpt: 'Нефтепродукты 0,234 мг/дм\n3' }),
    ])
  })

  it.each([
    ['missing value', { rawValueText: '0,999' }, 'VALUE_NOT_IN_PAGE'],
    ['missing indicator', { sourceExcerpt: '0,234 мг/дм³' }, 'INDICATOR_NOT_IN_EXCERPT'],
    ['missing unit', { sourceExcerpt: 'Нефтепродукты 0,234' }, 'UNIT_NOT_IN_EXCERPT'],
    ['excerpt mismatch', { sourceExcerpt: 'Нефтепродукты 0,234 мг/дм3' }, 'EXCERPT_NOT_IN_PAGE'],
    ['decimal mismatch', { normalizedValue: '0.235' }, 'DECIMAL_INVALID'],
    ['invented station', { stationLabel: 'Несуществующий створ' }, 'STATION_LABEL_AMBIGUOUS'],
  ])('rejects %s', (_label, overrides, reason) => {
    const base = extractMeasurementCandidates(page)[0]!
    const candidate: MeasurementCandidate = { ...base, ...overrides }
    expect(validateCandidateAgainstText(candidate, page)).toEqual({ valid: false, reason })
  })
})
