import {
  IncidentDetailSchema,
  IncidentSummarySchema,
} from '@caspian-trace/contracts'

import { Prisma } from '../../src/generated/prisma/client'
import {
  CorridorKind,
  EvidenceLevel,
  Region,
} from '../../src/generated/prisma/enums'
import { IncidentDataInvalidError } from '../../src/incidents/incidents.errors'
import {
  mapIncidentDetail,
  mapIncidentSummary,
} from '../../src/incidents/incidents.mapper'
import { makeDetailRow, makeSummaryRow } from './incidents-row.fixture'

describe('incidents mapper', () => {
  it('maps stored summary enums, unique period, indicator fallback and timestamp', () => {
    const result = mapIncidentSummary(makeSummaryRow())

    expect(IncidentSummarySchema.parse(result)).toEqual(result)
    expect(result).toEqual({
      id: 'test-part04-investigation-september',
      title: 'Test September incident',
      region: 'atyrau',
      evidenceLevel: 'L2',
      indicator: 'нефтепродукты',
      updatedAt: '2026-02-03T04:05:06.000Z',
      period: '2025-09',
    })
  })

  it('returns null for mixed periods and does not choose one arbitrarily', () => {
    const row = makeSummaryRow()
    row.measurements.push({
      measurement: {
        sampledAt: new Date('2025-05-20T00:00:00.000Z'),
        sampledPeriod: null,
        indicator: 'нефтепродукты',
      },
    })
    expect(mapIncidentSummary(row).period).toBeNull()
  })

  it('uses the stored evidence level and database indicator without calculation', () => {
    const row = makeSummaryRow()
    row.evidenceLevel = EvidenceLevel.L0
    row.incident.region = Region.MANGYSTAU
    row.incident.indicator = 'stored indicator'
    expect(mapIncidentSummary(row)).toMatchObject({
      evidenceLevel: 'L0',
      region: 'mangystau',
      indicator: 'stored indicator',
    })
  })

  it('maps a contract-valid detail without leaking Decimal', () => {
    const result = mapIncidentDetail(makeDetailRow())

    expect(IncidentDetailSchema.parse(result)).toEqual(result)
    expect(result.measurements[0]).toMatchObject({
      value: 0.234,
      rawValueText: '0,234',
      sourcePage: 22,
      verified: true,
    })
    expect(result.measurements[0]?.value).toEqual(expect.any(Number))
    expect(result.investigation).toMatchObject({
      evidenceLevel: 'L2',
      corridor: null,
      conclusion: 'Test-only stored conclusion without causal attribution.',
    })
    expect(result).not.toHaveProperty('delta')
  })

  it('falls back to owned metadata page and preserves an unknown page as null', () => {
    const metadataRow = makeDetailRow()
    metadataRow.measurements[0]!.measurement.sourcePage = null
    expect(mapIncidentDetail(metadataRow).measurements[0]?.sourcePage).toBe(22)

    const unknownRow = makeDetailRow()
    unknownRow.measurements[0]!.measurement.sourcePage = null
    unknownRow.measurements[0]!.measurement.metadata = { sourcePage: null }
    expect(mapIncidentDetail(unknownRow).measurements[0]?.sourcePage).toBeNull()
  })

  it('deduplicates source documents and maps evidence/unknown rows in stored order', () => {
    const result = mapIncidentDetail(makeDetailRow())
    expect(result.sourceDocuments.map(({ id }) => id)).toEqual([
      'test-part04-source-september',
    ])
    expect(result.investigation.supportedFacts).toHaveLength(1)
    expect(result.investigation.contradictedHypotheses).toHaveLength(1)
    expect(result.investigation.unknowns).toEqual([
      'Test-only stored limitation.',
      'Test-only stored unknown statement.',
      'Test-only stored investigation unknown.',
    ])
  })

  it('maps NONE and BETWEEN corridors from persisted IDs', () => {
    const none = makeDetailRow()
    none.corridorKind = CorridorKind.NONE
    none.downstreamStationId = null
    none.downstreamStation = null
    expect(mapIncidentDetail(none).corridorBounds).toBeNull()

    const between = makeDetailRow()
    between.corridorKind = CorridorKind.BETWEEN_STATIONS
    between.upstreamStationId = 'test-part04-upstream'
    between.upstreamStation = {
      ...between.downstreamStation!,
      id: 'test-part04-upstream',
      name: 'Test upstream station',
      riverOrder: 0,
    }
    expect(mapIncidentDetail(between).corridorBounds).toEqual({
      upstreamStationId: 'test-part04-upstream',
      downstreamStationId: 'test-part04-station-september',
    })
  })

  it('rejects unsupported downstream-open corridor and unknown coordinate sentinel', () => {
    const downstream = makeDetailRow()
    downstream.corridorKind = CorridorKind.OPEN_DOWNSTREAM
    downstream.upstreamStationId = downstream.downstreamStationId
    downstream.downstreamStationId = null
    expect(() => mapIncidentDetail(downstream)).toThrow(IncidentDataInvalidError)

    const location = makeDetailRow()
    location.measurements[0]!.measurement.station.latitude =
      new Prisma.Decimal('0')
    location.measurements[0]!.measurement.station.longitude =
      new Prisma.Decimal('0')
    expect(() => mapIncidentDetail(location)).toThrow(IncidentDataInvalidError)
  })

  it('rejects unsupported persisted media and provenance-free candidate objects', () => {
    const media = makeDetailRow()
    media.measurements[0]!.measurement.sourceDocument.mediaType = 'image/png'
    expect(() => mapIncidentDetail(media)).toThrow(IncidentDataInvalidError)

    const candidate = makeDetailRow()
    candidate.candidateObjects[0]!.candidateObject.sources = []
    expect(() => mapIncidentDetail(candidate)).toThrow(IncidentDataInvalidError)
  })
})
