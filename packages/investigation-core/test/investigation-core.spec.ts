import aktauFixture from '../../../data/fixtures/investigation/aktau-input.json'
import aktauGolden from '../../../data/fixtures/investigation/aktau-golden.json'
import mayFixture from '../../../data/fixtures/investigation/may-input.json'
import mayGolden from '../../../data/fixtures/investigation/may-golden.json'
import septemberFixture from '../../../data/fixtures/investigation/september-input.json'
import septemberGolden from '../../../data/fixtures/investigation/september-golden.json'

import {
  ExactDecimal,
  areMeasurementsComparable,
  assertConclusionIsAllowed,
  buildStationGraph,
  calculateInputHash,
  computePairedDelta,
  detectCycle,
  evaluatePairedIntervals,
  findEventMaximum,
  isUpstreamOf,
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
        provenance: {
          fixturePath: 'test-cycle',
          sourcePage: 1,
          sourceExcerpt: 'test cycle',
        },
      },
    ])
    expect(detectCycle(cycle)).toBe(true)
  })

  it('ignores a relation whose verified flag has no usable provenance', () => {
    const graph = buildStationGraph([
      {
        id: 'relation-without-provenance',
        upstreamStationId: 'station-a',
        downstreamStationId: 'station-b',
        sourceDocumentId: 'source-1',
        basis: 'test-only relation',
        verified: true,
        comparisonPair: true,
        provenance: undefined,
      } as unknown as Parameters<typeof buildStationGraph>[0][number],
    ])

    expect(graph.nodes.size).toBe(0)
  })

  it('does not trust relation provenance without a verified official source', () => {
    const result = runInvestigation({
      ...may,
      stationRelations: may.stationRelations.map((relation) => ({
        ...relation,
        sourceDocumentId: 'missing-source',
      })),
    })

    expect(result.evidenceLevel).not.toBe('L3')
    expect(result.corridorBounds).toBeNull()
    expect(result.unknowns.map(({ code }) => code)).toContain(
      'STATION_ORDER_UNVERIFIED',
    )
  })

  it('keeps a partial graph partial instead of inventing an order', () => {
    const graph = buildStationGraph([may.stationRelations[0]!])

    expect(isUpstreamOf('st-asa-0-5km-above', 'st-asa-0-5km-below', graph)).toBe(true)
    expect(isUpstreamOf('unknown-station', 'st-asa-0-5km-below', graph)).toBeNull()
  })
})

describe('safety boundaries', () => {
  it.each([
    'Объект виновен.',
    'Нарушитель установлен.',
    'Источник установлен.',
    'Доказано, что предприятие допустило сброс.',
    'Объект не причастен.',
  ])('rejects a forbidden conclusion: %s', (conclusion) => {
    expect(() => assertConclusionIsAllowed(conclusion)).toThrow('Forbidden conclusion wording')
  })

  it('does not turn an absent OSM location into an exclusion', () => {
    const result = runInvestigation({
      ...september,
      candidateObjects: september.candidateObjects.map((candidate) => ({
        ...candidate,
        stationId: null,
      })),
    })

    expect(result.objectDispositions.every(({ disposition }) => disposition === 'unknown')).toBe(
      true,
    )
  })

  it('does not raise the level for unverified wave evidence', () => {
    const result = runInvestigation({
      ...aktau,
      signals: aktau.signals.map((signal) => ({
        ...signal,
        phenomenon: 'other',
        excerpt: 'Наблюдалось волнение моря.',
        verificationStatus: 'unverified',
      })),
    })

    expect(result.evidenceLevel).toBe('L0')
    expect(result.corridorBounds).toBeNull()
  })

  it('does not treat a conflicting signal as corroboration', () => {
    const sourceDocumentId = aktau.signals[0]?.sourceDocumentId
    const result = runInvestigation({
      ...aktau,
      sourceDocuments: aktau.sourceDocuments.map((source) =>
        source.id === sourceDocumentId ? { ...source, official: false, verified: false } : source,
      ),
      signals: aktau.signals.map((signal) => ({
        ...signal,
        verificationStatus: 'conflicting',
      })),
    })

    expect(result.evidenceLevel).toBe('L0')
  })

  it('does not derive an L2 corridor from a disconnected no-increase pair', () => {
    const provenance = {
      fixturePath: 'test-only',
      sourcePage: 1,
      sourceExcerpt: 'test-only',
    }
    const result = runInvestigation({
      ...september,
      candidateObjects: [],
      stationRelations: [
        {
          id: 'root-component',
          upstreamStationId: 'st-zhaiyk-1km-above-atyrau',
          downstreamStationId: 'st-zhaiyk-1km-below-atyrau',
          sourceDocumentId: 'doc-kazhydromet-2025-09',
          basis: 'test-only',
          verified: true,
          comparisonPair: false,
          provenance,
        },
        {
          id: 'disconnected-pair',
          upstreamStationId: 'st-asa-0-5km-above',
          downstreamStationId: 'st-asa-0-5km-below',
          sourceDocumentId: 'doc-kazhydromet-2025-09',
          basis: 'test-only',
          verified: true,
          comparisonPair: true,
          provenance,
        },
      ],
    })

    expect(result.contradictedHypotheses.map(({ code }) => code)).toEqual([
      'NO_LOCAL_INCREASE_IN_PAIR',
    ])
    expect(result.corridorBounds).toBeNull()
    expect(result.evidenceLevel).not.toBe('L2')
  })

  it('marks a partially connected station graph as unverified order', () => {
    const result = runInvestigation({
      ...september,
      stationRelations: [september.stationRelations[1]!],
    })

    expect(result.unknowns.map(({ code }) => code)).toContain(
      'STATION_ORDER_UNVERIFIED',
    )
  })

  it('keeps an official verified measurement at L1 without a spatial rule', () => {
    const result = runInvestigation({
      ...may,
      stationRelations: [],
      candidateObjects: [],
    })

    expect(result.evidenceLevel).toBe('L1')
    expect(result.corridorBounds).toBeNull()
  })

  it.each([
    ['unit', { unit: 'mg/kg' }],
    ['matrix', { matrix: 'sediment' }],
    ['period', { sampledPeriod: '2025-08' }],
  ] as const)(
    'does not derive a spatial maximum across a mismatched %s',
    (_label, override) => {
      const input: InvestigationInput = {
        ...september,
        measurements: [
          ...september.measurements,
          {
            ...september.measurements[0]!,
            ...override,
            id: `incomparable-maximum-${_label}`,
            value: '9',
            rawValueText: '9',
          },
        ],
      }

      expect(findEventMaximum(input)).toBeNull()
      const result = runInvestigation(input)
      expect(result.contradictedHypotheses.map(({ code }) => code)).not.toContain(
        'MAXIMUM_UPSTREAM_OF_OBJECT',
      )
      expect(result.corridorBounds).toBeNull()
      expect(result.evidenceLevel).toBe('L1')
    },
  )
})

describe('golden investigations', () => {
  it('normalizes equivalent timestamp offsets and empty unknown collections', () => {
    const utcEquivalent: InvestigationInput = {
      ...september,
      incident: {
        ...september.incident,
        unknowns: [],
      },
      signals: september.signals.map((signal) => ({
        ...signal,
        observedAt:
          signal.observedAt === null
            ? null
            : new Date(signal.observedAt).toISOString(),
        reportedAt: new Date(signal.reportedAt).toISOString(),
      })),
      measurements: september.measurements.map((measurement) => ({
        ...measurement,
        sampledAt:
          measurement.sampledAt === null
            ? null
            : new Date(measurement.sampledAt).toISOString(),
      })),
      sourceDocuments: september.sourceDocuments.map((source) => ({
        ...source,
        publishedAt:
          source.publishedAt === null
            ? null
            : new Date(source.publishedAt).toISOString(),
        fetchedAt:
          source.fetchedAt === null
            ? null
            : new Date(source.fetchedAt).toISOString(),
      })),
    }

    expect(calculateInputHash(utcEquivalent)).toBe(
      calculateInputHash(september),
    )
    expect(runInvestigation(utcEquivalent).inputHash).toBe(
      runInvestigation(september).inputHash,
    )
  })
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
      rulesetVersion: '1.2.1',
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
      rulesetVersion: '1.2.1',
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

  it('keeps multi-measurement interval results deterministic with unique IDs', () => {
    const multiMeasurementInput: InvestigationInput = {
      ...may,
      measurements: [
        ...may.measurements,
        {
          ...may.measurements[0]!,
          id: 'm-2025-05-asa-above-second',
          value: '0.100',
          rawValueText: '0,100',
        },
      ],
    }
    const reversed: InvestigationInput = {
      ...multiMeasurementInput,
      measurements: [...multiMeasurementInput.measurements].reverse(),
    }
    const first = runInvestigation(multiMeasurementInput)
    const second = runInvestigation(reversed)

    expect(second.inputHash).toBe(first.inputHash)
    expect(second).toEqual(first)
    const statementIds = first.supportedFacts.map(({ id }) => id)
    expect(new Set(statementIds).size).toBe(statementIds.length)
  })

  it('assigns a unique global sort order across supported and contradicted facts', () => {
    const mixed = runInvestigation({
      ...may,
      measurements: [
        ...may.measurements,
        {
          ...may.measurements[1]!,
          id: 'm-2025-05-asa-below-low',
          value: '0.050',
          rawValueText: '0,050',
        },
      ],
    })
    const sortOrders = [
      ...mixed.supportedFacts,
      ...mixed.contradictedHypotheses,
    ].map(({ sortOrder }) => sortOrder)

    expect(new Set(sortOrders).size).toBe(sortOrders.length)
    expect(sortOrders).toEqual(sortOrders.map((_, index) => index))
  })
})
