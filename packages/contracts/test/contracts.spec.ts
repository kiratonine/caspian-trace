import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  ApiErrorSchema,
  CandidateObjectSchema,
  DossierSchema,
  EvidenceGraphSchema,
  EvidenceStatementSchema,
  ExtractionModeSchema,
  IncidentDetailSchema,
  IncidentSummaryListSchema,
  LiveStatusSchema,
  MeasurementSchema,
  ReplayScenarioSchema,
  SourceDocumentSchema,
  StationSchema,
  mapRegionToApi,
} from '../src'

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8'))
}

type FixtureMeasurement = {
  sourceExcerpt: string | null
  verified: boolean
}

type FixtureSourceDocument = {
  fetchedAt: string | null
  sha256: string | null
  status: string
}

describe('contract fixtures', () => {
  it.each([
    ['incidents.json', IncidentSummaryListSchema],
    ['incident-september.json', IncidentDetailSchema],
    ['evidence-september.json', EvidenceGraphSchema],
    ['replay-september.json', ReplayScenarioSchema],
    ['live-status.json', LiveStatusSchema],
    ['dossier-september.json', DossierSchema],
  ] as const)('validates %s', (fixture, schema) => {
    expect(schema.safeParse(readFixture(fixture)).success).toBe(true)
  })
})

describe('strict API boundaries', () => {
  it('rejects unknown fields', () => {
    const sourceDocument = (
      readFixture('evidence-september.json') as {
        sourceDocuments: unknown[]
      }
    ).sourceDocuments[0] as Record<string, unknown>
    const source = {
      ...sourceDocument,
      internalMetadata: { secret: true },
    }

    expect(SourceDocumentSchema.safeParse(source).success).toBe(false)
  })

  it('rejects sourcePage zero and accepts null', () => {
    const measurement = (
      readFixture('evidence-september.json') as { measurements: unknown[] }
    ).measurements[0] as Record<string, unknown>

    expect(
      MeasurementSchema.safeParse({ ...measurement, sourcePage: 0 }).success,
    ).toBe(false)
    expect(
      MeasurementSchema.safeParse({ ...measurement, sourcePage: null }).success,
    ).toBe(true)
  })

  it('does not complete verification without full provenance', () => {
    const incident = readFixture('incident-september.json') as {
      measurements: FixtureMeasurement[]
      sourceDocuments: FixtureSourceDocument[]
    }
    const evidence = readFixture('evidence-september.json') as {
      measurements: FixtureMeasurement[]
      sourceDocuments: FixtureSourceDocument[]
    }
    const replay = readFixture('replay-september.json') as {
      steps: Array<{
        payload: { measurements?: FixtureMeasurement[] }
      }>
    }
    const dossier = readFixture('dossier-september.json') as {
      measurements: FixtureMeasurement[]
      sources: FixtureSourceDocument[]
    }
    const measurements = [
      ...incident.measurements,
      ...evidence.measurements,
      ...replay.steps.flatMap(({ payload }) => payload.measurements ?? []),
      ...dossier.measurements,
    ]
    const sourceDocuments = [
      ...incident.sourceDocuments,
      ...evidence.sourceDocuments,
      ...dossier.sources,
    ]

    expect(
      measurements.every(
        ({ sourceExcerpt, verified }) =>
          sourceExcerpt === null && verified === false,
      ),
    ).toBe(true)
    expect(
      sourceDocuments.every(
        ({ fetchedAt, sha256, status }) =>
          (fetchedAt !== null && sha256 !== null) || status !== 'verified',
      ),
    ).toBe(true)
    expect(
      MeasurementSchema.safeParse({
        ...measurements[0],
        id: 'measurement-without-provenance',
        stationId: 'station',
        sampledAt: null,
        sampledPeriod: '2025-09',
        indicator: 'нефтепродукты',
        value: 0.234,
        rawValueText: '0,234',
        unit: 'mg/dm3',
        matrix: 'water',
        qualityClass: null,
        sourceDocumentId: 'source',
        sourcePage: null,
        verified: true,
      }).success,
    ).toBe(false)
    expect(
      SourceDocumentSchema.safeParse({
        ...(sourceDocuments[0] as Record<string, unknown>),
        status: 'verified',
      }).success,
    ).toBe(false)
  })

  it('states the supported 0.234 value without an unsupported maximum', () => {
    const incident = readFixture('incident-september.json') as {
      investigation: {
        supportedFacts: Array<{
          id: string
          measurementIds: string[]
          text: string
        }>
      }
    }
    const evidence = readFixture('evidence-september.json') as {
      statements: Array<{
        id: string
        measurementIds: string[]
        text: string
      }>
    }
    const dossier = readFixture('dossier-september.json') as {
      supportedFacts: Array<{
        id: string
        measurementIds: string[]
        text: string
      }>
    }
    const statements = [
      ...incident.investigation.supportedFacts,
      ...evidence.statements,
      ...dossier.supportedFacts,
    ].filter(({ id }) => id === 'es-2025-09-fact-max')

    expect(statements).toHaveLength(3)
    for (const statement of statements) {
      expect(statement.text).toBe(
        'На створе «1 км выше Атырау» за сентябрь зафиксировано 0,234 мг/дм³ нефтепродуктов.',
      )
      expect(statement.measurementIds).toEqual([
        'm-2025-09-1km-above-atyrau',
      ])
      expect(statement.text).not.toMatch(/максим/i)
    }
  })

  it('does not advertise cache before cache implementation', () => {
    const liveStatus = readFixture('live-status.json') as {
      sources: Array<{ cacheAvailable: boolean }>
    }

    expect(
      liveStatus.sources.every(
        ({ cacheAvailable }) => cacheAvailable === false,
      ),
    ).toBe(true)
  })

  it.each(['supports', 'contradicts', 'limits'] as const)(
    'rejects %s without source IDs',
    (kind) => {
      expect(
        EvidenceStatementSchema.safeParse({
          id: `statement-${kind}`,
          kind,
          text: 'Проверяемое утверждение',
          measurementIds: [],
          sourceDocumentIds: [],
          generatedBy: 'human_verified',
        }).success,
      ).toBe(false)
    },
  )

  it('accepts a statement with source provenance and no measurement IDs', () => {
    expect(
      EvidenceStatementSchema.safeParse({
        id: 'statement-with-source',
        kind: 'supports',
        text: 'Факт подтвержден документом',
        measurementIds: [],
        sourceDocumentIds: ['source-document'],
        generatedBy: 'human_verified',
      }).success,
    ).toBe(true)
  })

  it('accepts an unknown statement with empty IDs', () => {
    expect(
      EvidenceStatementSchema.safeParse({
        id: 'statement-unknown',
        kind: 'unknown',
        text: 'Данных недостаточно',
        measurementIds: [],
        sourceDocumentIds: [],
        generatedBy: 'human_verified',
      }).success,
    ).toBe(true)
  })

  it('rejects a candidate object without an evidence document', () => {
    const candidateObject = (
      readFixture('incident-september.json') as {
        candidateObjects: unknown[]
      }
    ).candidateObjects[0] as Record<string, unknown>

    expect(
      CandidateObjectSchema.safeParse({
        ...candidateObject,
        evidenceDocumentIds: [],
      }).success,
    ).toBe(false)
  })

  it('rejects [0, 0] as unknown geometry', () => {
    const station = (
      readFixture('incident-september.json') as { stations: unknown[] }
    ).stations[0] as Record<string, unknown>

    expect(StationSchema.safeParse({ ...station, location: [0, 0] }).success).toBe(
      false,
    )
    expect(StationSchema.safeParse({ ...station, location: null }).success).toBe(
      true,
    )
    expect(
      StationSchema.safeParse({
        ...station,
        location: { lat: 0, lon: 0 },
        locationSourceDocumentId: 'doc-location',
      }).success,
    ).toBe(false)
  })

  it('keeps location provenance nullable and aligned with location', () => {
    const station = (
      readFixture('incident-september.json') as { stations: unknown[] }
    ).stations[0] as Record<string, unknown>

    expect(
      StationSchema.safeParse({
        ...station,
        location: null,
        locationSourceDocumentId: 'doc-location',
      }).success,
    ).toBe(false)
    expect(
      StationSchema.safeParse({
        ...station,
        location: { lat: 47.1, lon: 51.9 },
        locationSourceDocumentId: null,
      }).success,
    ).toBe(false)
    expect(
      StationSchema.safeParse({
        ...station,
        location: { lat: 47.1, lon: 51.9 },
        locationSourceDocumentId: 'doc-location',
      }).success,
    ).toBe(true)
  })

  it('accepts only verified LLM extraction mode', () => {
    expect(ExtractionModeSchema.safeParse('llm_verified').success).toBe(true)
    expect(ExtractionModeSchema.safeParse('llm').success).toBe(false)
  })

  it('validates replay payloads through the type discriminant', () => {
    const replay = structuredClone(
      readFixture('replay-september.json') as {
        steps: Array<Record<string, unknown>>
      },
    )
    replay.steps[0]!.payload = { text: 'wrong payload', evidenceLevel: 'L0' }

    expect(ReplayScenarioSchema.safeParse(replay).success).toBe(false)
  })

  it('does not claim L2 while station order is unverified', () => {
    const incident = readFixture('incident-september.json') as {
      investigation: { evidenceLevel: string }
      stations: Array<{
        relatedObjectId: string | null
        relationType: string
        riverOrder: number | null
      }>
      corridorBounds: unknown
    }

    expect(incident.stations.every(({ riverOrder }) => riverOrder === null)).toBe(
      true,
    )
    expect(
      incident.stations.every(
        ({ relatedObjectId, relationType }) =>
          relationType === 'neutral' && relatedObjectId === null,
      ),
    ).toBe(true)
    expect(incident.investigation.evidenceLevel).toBe('L1')
    expect(incident.corridorBounds).toBeNull()
  })

  it('does not present Zakon as an official source', () => {
    const incident = readFixture('incident-september.json') as {
      signals: Array<{ verificationStatus: string }>
    }
    const replay = readFixture('replay-september.json') as {
      steps: Array<{
        type: string
        payload: {
          signal?: { verificationStatus: string }
          sourceDocumentId?: string
        }
      }>
    }
    const signalStep = replay.steps.find(({ type }) => type === 'signal')
    const corroborationStep = replay.steps.find(
      ({ type }) => type === 'corroboration',
    )

    expect(incident.signals[0]?.verificationStatus).toBe('corroborated')
    expect(signalStep?.payload.signal?.verificationStatus).toBe('corroborated')
    expect(corroborationStep?.payload.sourceDocumentId).toBe(
      'doc-kazhydromet-2025-09',
    )
  })

  it('maps internal uppercase regions to stable lowercase API values', () => {
    expect(mapRegionToApi('ATYRAU')).toBe('atyrau')
    expect(mapRegionToApi('MANGYSTAU')).toBe('mangystau')
  })

  it('validates normalized API errors', () => {
    expect(
      ApiErrorSchema.parse({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        requestId: 'forwarded-request-id',
      }),
    ).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      requestId: 'forwarded-request-id',
    })
  })
})
