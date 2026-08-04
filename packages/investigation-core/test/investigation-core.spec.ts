import aktauFixture from '../../../data/fixtures/investigation/aktau-input.json'
import aktauGolden from '../../../data/fixtures/investigation/aktau-golden.json'
import mayFixture from '../../../data/fixtures/investigation/may-input.json'
import mayGolden from '../../../data/fixtures/investigation/may-golden.json'
import septemberFixture from '../../../data/fixtures/investigation/september-input.json'
import septemberGolden from '../../../data/fixtures/investigation/september-golden.json'

import {
  ExactDecimal,
  areMeasurementsComparable,
  buildStationGraph,
  calculateInputHash,
  computePairedDelta,
  detectCycle,
  evaluatePairedIntervals,
  runInvestigation,
  type InvestigationInput,
  type MeasurementFact,
} from '../src'

const september = septemberFixture as InvestigationInput
const may = mayFixture as InvestigationInput
const aktau = aktauFixture as InvestigationInput

describe('exact decimal boundary', () => {
  it('computes the May delta exactly', () => {
    expect(computePairedDelta(may.measurements[0]!, may.measurements[1]!).toString()).toBe(
      '0.079',
    )
  })

  it('computes the September pair without floating point drift', () => {
    const above = september.measurements.find(({ id }) => id === 'm-2025-09-asa-above')!
    const below = september.measurements.find(({ id }) => id === 'm-2025-09-asa-below')!
    expect(computePairedDelta(above, below).toString()).toBe('-0.004')
    expect(ExactDecimal.parse('0.193').subtract(ExactDecimal.parse('0.114')).toString()).toBe(
      '0.079',
    )
  })
})

describe('measurement comparability', () => {
  const sourceDocuments = may.sourceDocuments
  const base = may.measurements[0]!

  it.each([
    ['indicator', { indicator: 'фенолы' }, 'INDICATOR_MISMATCH'],
    ['matrix', { matrix: 'sediment' }, 'MATRIX_MISMATCH'],
    ['unit', { unit: 'percent' }, 'UNIT_MISMATCH'],
    ['period', { sampledPeriod: '2025-06' }, 'TIME_MISMATCH'],
  ] as const)('rejects a %s mismatch', (_label, override, reason) => {
    const candidate: MeasurementFact = { ...may.measurements[1]!, ...override }
    expect(
      areMeasurementsComparable(base, candidate, {
        relationVerified: true,
        sourceDocuments,
      }),
    ).toEqual({ comparable: false, reasons: [reason] })
  })

  it('rejects an unverified relation and non-official source', () => {
    expect(
      areMeasurementsComparable(base, may.measurements[1]!, {
        relationVerified: false,
        sourceDocuments: sourceDocuments.map((source) => ({ ...source, official: false })),
      }),
    ).toEqual({
      comparable: false,
      reasons: ['RELATION_UNVERIFIED', 'SOURCE_NOT_OFFICIAL'],
    })
  })
})

describe('station graph', () => {
  it('detects a cycle and refuses a topological result', () => {
    const cycle = buildStationGraph([
      ...may.stationRelations,
      {
        id: 'cycle-back',
        upstreamStationId: 'st-asa-0-5km-below',
        downstreamStationId: 'st-asa-0-5km-above',
        sourceDocumentId: 'doc-kazhydromet-2025-05',
        basis: 'test cycle',
        verified: true,
        comparisonPair: false,
      },
    ])
    expect(detectCycle(cycle)).toBe(true)
  })
})

describe('golden investigations', () => {
  it('derives the September L2/open-upstream result', () => {
    const intervals = evaluatePairedIntervals(september)
    expect(intervals.find(({ relationId }) => relationId === 'rel-sep-asa-pair')?.delta).toBe(
      '-0.004',
    )

    const result = runInvestigation(september)
    expect(result).toMatchObject({
      evidenceLevel: 'L2',
      corridorBounds: {
        upstreamStationId: null,
        downstreamStationId: 'st-zhaiyk-1km-above-atyrau',
      },
      rulesetVersion: '1.0.0',
    })
    expect(result.contradictedHypotheses.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['NO_LOCAL_INCREASE_IN_PAIR', 'MAXIMUM_UPSTREAM_OF_OBJECT']),
    )
    expect(result.unknowns.map(({ code }) => code)).toContain('UPSTREAM_BOUNDARY_UNMEASURED')
    expect(result.conclusion).toContain('выше створа «1 км выше Атырау»')
    expect(result).toEqual(septemberGolden)
  })

  it('derives the May L3 paired corridor', () => {
    const result = runInvestigation(may)
    expect(result).toMatchObject({
      evidenceLevel: 'L3',
      corridorBounds: {
        upstreamStationId: 'st-asa-0-5km-above',
        downstreamStationId: 'st-asa-0-5km-below',
      },
      rulesetVersion: '1.0.0',
    })
    expect(result.supportedFacts).toHaveLength(1)
    expect(result.supportedFacts[0]?.text).toContain('+0,079')
    expect(result.conclusion).toContain('интервал требует проверки')
    expect(result).toEqual(mayGolden)
  })

  it('keeps Aktau at L0 with explicit insufficiency reasons', () => {
    const result = runInvestigation(aktau)
    expect(result.evidenceLevel).toBe('L0')
    expect(result.corridorBounds).toBeNull()
    expect(result.unknowns.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'CURRENT_FIELD_UNAVAILABLE',
        'SYNCHRONOUS_MEASUREMENTS_UNAVAILABLE',
      ]),
    )
    expect(result.conclusion).toContain('Источник не локализован')
    expect(result).toEqual(aktauGolden)
  })

  it('is deterministic regardless of entity array order', () => {
    const reversed: InvestigationInput = {
      ...september,
      measurements: [...september.measurements].reverse(),
      stations: [...september.stations].reverse(),
      stationRelations: [...september.stationRelations].reverse(),
    }
    expect(calculateInputHash(reversed)).toBe(calculateInputHash(september))
    expect(runInvestigation(reversed)).toEqual(runInvestigation(september))
  })
})
