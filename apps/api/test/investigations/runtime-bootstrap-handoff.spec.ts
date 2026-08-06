import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  runInvestigation,
  type InvestigationInput,
  type InvestigationResult,
} from '@caspian-trace/investigation-core'

import { parseInvestigationInput } from '../../src/investigations/investigation-input.schema'

interface HandoffCase {
  inputPath: string
  expectedResultPath: string
  incident: InvestigationInput['incident']
  signalIds: string[]
  signalProvenance: Array<{
    signalId: string
    sourceDocumentId: string
    url: string
    reportedAt: string
    excerpt: string
  }>
  stationIds: string[]
  stationRelationIds: string[]
  stationRelationEvidenceIds: string[]
  comparisonPairRelationIds: string[]
  measurementIds: string[]
  candidateObjectIds: string[]
  sourceDocumentIds: string[]
  unknowns: NonNullable<InvestigationInput['incident']['unknowns']>
  expectedResult: {
    evidenceLevel: InvestigationResult['evidenceLevel']
    corridorKind: 'none' | 'open_upstream' | 'between_stations'
    upstreamStationId: string | null
    downstreamStationId: string | null
    supportedFactCodes: string[]
    contradictedHypothesisCodes: string[]
    objectDispositions: Record<string, string>
    unknownCodes: string[]
    conclusion: string
    fixtureInputHash: string
    rulesetVersion: string
  }
}

interface HandoffManifest {
  cases: HandoffCase[]
}

interface VerifiedMeasurements {
  document: {
    id: string
    url: string
    sha256: string
    sourcePage: number
  }
  measurements: Array<{
    id: string
    stationId: string
    stationLabel: string
    indicator: string
    rawValueText: string
    normalizedValue: string
    unit: string
    sampledAt: string | null
    sampledPeriod: string | null
    sourceExcerpt: string
  }>
}

interface VerifiedRelations {
  document: {
    id: string
    sourcePage: number
  }
  relations: Array<{
    id: string
    upstreamStationId: string
    downstreamStationId: string
    sourcePage: number
    sourceExcerpt: string
  }>
}

const repositoryRoot = resolve(__dirname, '..', '..', '..', '..')

describe('runtime bootstrap handoff', () => {
  let handoff: HandoffManifest

  beforeAll(async () => {
    handoff = await readJson<HandoffManifest>(
      'data/fixtures/investigation/runtime-bootstrap-handoff.json',
    )
  })

  it.each([
    'inv-atyrau-2025-09',
    'inv-atyrau-2025-05',
    'inv-aktau-insufficient',
  ])('parses and reproduces the golden core result for %s', async (incidentId) => {
    const handoffCase = requiredCase(handoff, incidentId)
    const input = parseInvestigationInput(
      await readJson<unknown>(handoffCase.inputPath),
    )
    const golden = await readJson<InvestigationResult>(
      handoffCase.expectedResultPath,
    )

    expect(input.incident).toMatchObject(handoffCase.incident)
    expect(ids(input.signals)).toEqual(handoffCase.signalIds)
    expect(ids(input.stations)).toEqual(handoffCase.stationIds)
    expect(ids(input.stationRelations)).toEqual(
      handoffCase.stationRelationEvidenceIds,
    )
    expect(input.stationRelations.map(canonicalRelationId)).toEqual(
      handoffCase.stationRelationIds,
    )
    expect(
      input.stationRelations
        .filter(({ comparisonPair }) => comparisonPair)
        .map(canonicalRelationId),
    ).toEqual(handoffCase.comparisonPairRelationIds)
    expect(ids(input.measurements)).toEqual(handoffCase.measurementIds)
    expect(ids(input.candidateObjects)).toEqual(handoffCase.candidateObjectIds)
    expect(ids(input.sourceDocuments)).toEqual(handoffCase.sourceDocumentIds)
    expect(input.incident.unknowns ?? []).toEqual(handoffCase.unknowns)
    expect(runInvestigation(input)).toEqual(golden)
    expect(expectedResultSummary(golden)).toEqual(handoffCase.expectedResult)
  })

  it.each([
    ['inv-atyrau-2025-09', 'atyrau-2025-09'],
    ['inv-atyrau-2025-05', 'atyrau-2025-05'],
  ])(
    'keeps every measurement and station relation in %s tied to verified fixtures',
    async (incidentId, fixtureStem) => {
      const handoffCase = requiredCase(handoff, incidentId)
      const input = parseInvestigationInput(
        await readJson<unknown>(handoffCase.inputPath),
      )
      const measurements = await readJson<VerifiedMeasurements>(
        `data/verified/${fixtureStem}.json`,
      )
      const relations = await readJson<VerifiedRelations>(
        `data/verified/${fixtureStem}-station-relations.json`,
      )

      const source = input.sourceDocuments.find(
        ({ id }) => id === measurements.document.id,
      )
      expect(source).toMatchObject({
        url: measurements.document.url,
        sha256: measurements.document.sha256,
      })

      for (const measurement of input.measurements) {
        const verified = measurements.measurements.find(
          ({ id }) => id === measurement.id,
        )
        expect(verified).toBeDefined()
        expect(measurement).toMatchObject({
          stationId: verified!.stationId,
          indicator: verified!.indicator,
          value: verified!.normalizedValue,
          rawValueText: verified!.rawValueText,
          unit: verified!.unit,
          sampledAt: verified!.sampledAt,
          sampledPeriod: verified!.sampledPeriod,
          sourceDocumentId: measurements.document.id,
          sourcePage: measurements.document.sourcePage,
          verified: true,
        })
        expect(verified!.sourceExcerpt).toContain(measurement.sourceExcerpt)
      }

      for (const relation of input.stationRelations) {
        const verified = relations.relations.find(({ id }) => id === relation.id)
        expect(verified).toBeDefined()
        expect(relation).toMatchObject({
          upstreamStationId: verified!.upstreamStationId,
          downstreamStationId: verified!.downstreamStationId,
          sourceDocumentId: relations.document.id,
          verified: true,
          provenance: {
            sourcePage: verified!.sourcePage,
            sourceExcerpt: verified!.sourceExcerpt,
          },
        })
      }

      for (const candidate of input.candidateObjects) {
        expect(
          measurements.measurements.some(({ stationLabel }) =>
            stationLabel.includes(candidate.name),
          ),
        ).toBe(true)
      }
    },
  )

  it('uses a checked published page for the only supplied signal', async () => {
    const handoffCase = requiredCase(handoff, 'inv-atyrau-2025-09')
    const input = parseInvestigationInput(
      await readJson<unknown>(handoffCase.inputPath),
    )
    const signal = input.signals[0]
    const provenance = handoffCase.signalProvenance[0]
    const source = input.sourceDocuments.find(
      ({ id }) => id === signal?.sourceDocumentId,
    )

    expect(provenance).toBeDefined()
    expect(signal).toMatchObject({
      id: provenance!.signalId,
      sourceDocumentId: provenance!.sourceDocumentId,
      reportedAt: provenance!.reportedAt,
      excerpt: provenance!.excerpt,
    })
    expect(source?.url).toBe(provenance!.url)
  })
})

function expectedResultSummary(
  result: InvestigationResult,
): HandoffCase['expectedResult'] {
  return {
    evidenceLevel: result.evidenceLevel,
    corridorKind:
      result.corridorBounds === null
        ? 'none'
        : result.corridorBounds.upstreamStationId === null
          ? 'open_upstream'
          : 'between_stations',
    upstreamStationId: result.corridorBounds?.upstreamStationId ?? null,
    downstreamStationId: result.corridorBounds?.downstreamStationId ?? null,
    supportedFactCodes: result.supportedFacts.map(({ code }) => code),
    contradictedHypothesisCodes: result.contradictedHypotheses.map(
      ({ code }) => code,
    ),
    objectDispositions: Object.fromEntries(
      result.objectDispositions.map(({ objectId, disposition }) => [
        objectId,
        disposition,
      ]),
    ),
    unknownCodes: result.unknowns.map(({ code }) => code),
    conclusion: result.conclusion,
    fixtureInputHash: result.inputHash,
    rulesetVersion: result.rulesetVersion,
  }
}

function requiredCase(
  manifest: HandoffManifest,
  incidentId: string,
): HandoffCase {
  const handoffCase = manifest.cases.find(
    ({ incident }) => incident.id === incidentId,
  )
  if (handoffCase === undefined) throw new Error(`Missing handoff: ${incidentId}`)
  return handoffCase
}

function ids(items: ReadonlyArray<{ id: string }>): string[] {
  return items.map(({ id }) => id)
}

function canonicalRelationId(relation: {
  upstreamStationId: string
  downstreamStationId: string
}): string {
  return `station-relation:${relation.upstreamStationId}:${relation.downstreamStationId}:upstream-of`
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(
    await readFile(resolve(repositoryRoot, path), 'utf8'),
  ) as T
}
