import { Injectable } from '@nestjs/common'

import type {
  InvestigationInput,
  InvestigationResult,
  ObjectDisposition,
  SourceDocumentFact,
  StationRelationFact,
} from '@caspian-trace/investigation-core'

import { Prisma, type Region } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { parseInvestigationInput } from './investigation-input.schema'
import type {
  InvestigationInputReader,
  InvestigationResultWriter,
  StoredInvestigation,
} from './investigation.ports'

type JsonRecord = Record<string, unknown>

@Injectable()
export class PrismaInvestigationRepository
  implements InvestigationInputReader, InvestigationResultWriter {
  constructor(private readonly prisma: PrismaService) { }

  async loadInput(referenceId: string): Promise<InvestigationInput | null> {
    const referencedVersion = await this.prisma.investigation.findUnique({
      where: { id: referenceId },
      select: { incidentId: true, isCurrent: true },
    })
    if (referencedVersion !== null && !referencedVersion.isCurrent) return null

    const incidentId = referencedVersion?.incidentId ?? referenceId
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: { signals: { include: { signal: true } } },
    })
    if (incident === null) return null

    const incidentMetadata = asRecord(incident.metadata)
    const stationScope = readStringArray(incidentMetadata.stationIds)
    const relationScope = readStringArray(incidentMetadata.stationRelationIds)
    const measurementScope = readStringArray(incidentMetadata.measurementIds)
    const candidateScope = readStringArray(incidentMetadata.candidateObjectIds)
    if (
      stationScope === null ||
      relationScope === null ||
      measurementScope === null ||
      candidateScope === null
    ) {
      return null
    }

    const stations = await this.prisma.station.findMany({
      where: { id: { in: stationScope } },
      orderBy: { id: 'asc' },
    })
    const [relations, measurements, candidates] = await Promise.all([
      this.prisma.stationRelation.findMany({
        where: { id: { in: relationScope } },
        orderBy: { id: 'asc' },
        include: {
          evidence: {
            orderBy: [
              { sourceDocumentId: 'asc' },
              { sourcePage: 'asc' },
              { id: 'asc' },
            ],
          },
        },
      }),
      this.prisma.measurement.findMany({
        where: { id: { in: measurementScope } },
        include: { sourcePage: true },
        orderBy: { id: 'asc' },
      }),
      this.prisma.candidateObject.findMany({
        where: { id: { in: candidateScope } },
        include: { sources: true },
        orderBy: { id: 'asc' },
      }),
    ])

    if (
      !containsExactlyScopedIds(stations, stationScope) ||
      !containsExactlyScopedIds(relations, relationScope) ||
      !containsExactlyScopedIds(measurements, measurementScope) ||
      !containsExactlyScopedIds(candidates, candidateScope)
    ) {
      return null
    }

    const sourceIds = new Set<string>()
    for (const { signal } of incident.signals) sourceIds.add(signal.sourceDocumentId)
    for (const relation of relations) {
      if (relation.sourceDocumentId !== null) sourceIds.add(relation.sourceDocumentId)
      for (const evidence of relation.evidence) sourceIds.add(evidence.sourceDocumentId)
    }
    for (const measurement of measurements) sourceIds.add(measurement.sourceDocumentId)
    for (const candidate of candidates) {
      for (const source of candidate.sources) sourceIds.add(source.sourceDocumentId)
    }
    const sources = await this.prisma.sourceDocument.findMany({
      where: { id: { in: [...sourceIds] } },
      orderBy: { id: 'asc' },
    })

    return parseInvestigationInput({
      incident: {
        id: incident.id,
        title: incident.title,
        region: incident.region.toLowerCase(),
        indicator: incident.indicator ?? '',
        unknowns: readIncidentUnknowns(incident.metadata),
      },
      signals: incident.signals.map(({ signal }) => ({
        id: signal.id,
        title: signal.title,
        observedAt: toIso(signal.observedAt),
        observedPeriod: signal.observedPeriod,
        reportedAt: signal.reportedAt.toISOString(),
        locationText: signal.locationText ?? '',
        phenomenon: normalizePhenomenon(signal.phenomenon),
        excerpt: signal.excerpt,
        sourceDocumentId: signal.sourceDocumentId,
        extractionMode: signal.extractionMode.toLowerCase(),
        verificationStatus: signal.verificationStatus.toLowerCase(),
      })),
      stations: stations.map((station) => ({
        id: station.id,
        name: station.name,
        waterBody: station.waterBody,
      })),
      stationRelations: relations.map(mapStationRelation),
      measurements: measurements.map((measurement) => ({
        id: measurement.id,
        stationId: measurement.stationId,
        indicator: measurement.indicator,
        matrix: measurement.matrix,
        value: measurement.value.toString(),
        rawValueText: measurement.rawValueText,
        unit: measurement.unit,
        sampledAt: toIso(measurement.sampledAt),
        sampledPeriod: measurement.sampledPeriod,
        sourceDocumentId: measurement.sourceDocumentId,
        sourcePage:
          measurement.sourcePage?.pageNumber ??
          readNumber(asRecord(measurement.metadata).sourcePage),
        sourceExcerpt: measurement.sourceExcerpt,
        verified: isVerified(measurement.verificationStatus),
      })),
      candidateObjects: candidates.map((candidate) => {
        const metadata = asRecord(candidate.metadata)
        return {
          id: candidate.id,
          name: candidate.name,
          category: candidate.objectType,
          stationId: readString(metadata.stationId),
          waterBody: readString(metadata.waterBody),
          evidenceDocumentIds: candidate.sources.map(({ sourceDocumentId }) => sourceDocumentId),
          completeness: metadata.completeness === 'confirmed' ? 'confirmed' : 'partial',
        }
      }),
      sourceDocuments: sources.map(mapSourceDocument),
    })
  }

  async findCurrent(referenceId: string): Promise<StoredInvestigation | null> {
    const exactCurrent = await this.prisma.investigation.findFirst({
      where: { id: referenceId, isCurrent: true },
    })
    if (exactCurrent !== null) return readStoredSnapshot(exactCurrent)

    const currentByIncident = await this.prisma.investigation.findFirst({
      where: { incidentId: referenceId, isCurrent: true },
      orderBy: { generatedAt: 'desc' },
    })
    return currentByIncident === null ? null : readStoredSnapshot(currentByIncident)
  }

  async saveVersioned(
    investigationId: string,
    input: InvestigationInput,
    result: InvestigationResult,
  ): Promise<StoredInvestigation> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const existing = await transaction.investigation.findFirst({
              where: {
                incidentId: investigationId,
                inputHash: result.inputHash,
                rulesetVersion: result.rulesetVersion,
              },
            })
            if (existing !== null) {
              await transaction.investigation.updateMany({
                where: { incidentId: investigationId, id: { not: existing.id } },
                data: { isCurrent: false },
              })
              if (!existing.isCurrent) {
                await transaction.investigation.update({
                  where: { id: existing.id },
                  data: { isCurrent: true },
                })
              }
              return snapshot(investigationId, input, result, existing.id, existing.generatedAt)
            }

            await persistInput(transaction, input)
            await transaction.investigation.updateMany({
              where: { incidentId: investigationId, isCurrent: true },
              data: { isCurrent: false },
            })
            const versionId = buildVersionId(investigationId, result)
            const created = await transaction.investigation.create({
              data: {
                id: versionId,
                incidentId: investigationId,
                evidenceLevel: result.evidenceLevel,
                conclusion: result.conclusion,
                corridorKind: corridorKind(result),
                upstreamStationId: result.corridorBounds?.upstreamStationId ?? null,
                downstreamStationId: result.corridorBounds?.downstreamStationId ?? null,
                rulesetVersion: result.rulesetVersion,
                inputHash: result.inputHash,
                isCurrent: true,
                metadata: jsonValue({ input, result }),
              },
            })
            if (input.measurements.length > 0) {
              await transaction.investigationMeasurement.createMany({
                data: input.measurements.map(({ id }) => ({
                  investigationId: versionId,
                  measurementId: id,
                })),
              })
            }
            if (result.objectDispositions.length > 0) {
              await transaction.investigationCandidateObject.createMany({
                data: result.objectDispositions.map((disposition) => ({
                  investigationId: versionId,
                  candidateObjectId: disposition.objectId,
                  disposition: mapDisposition(disposition),
                })),
              })
            }
            const statements = [
              ...result.supportedFacts,
              ...result.contradictedHypotheses,
            ]
            for (const statement of statements) {
              await transaction.evidenceStatement.create({
                data: {
                  id: `${versionId}:${statement.id}`,
                  investigationId: versionId,
                  kind: statement.kind === 'supports' ? 'SUPPORTS' : 'CONTRADICTS',
                  code: statement.code,
                  text: statement.text,
                  generatedBy: 'RULE_ENGINE',
                  sortOrder: statement.sortOrder,
                  measurements: {
                    create: statement.measurementIds.map((measurementId) => ({
                      measurement: { connect: { id: measurementId } },
                    })),
                  },
                  sources: {
                    create: statement.sourceDocumentIds.map((sourceDocumentId) => ({
                      sourceDocument: { connect: { id: sourceDocumentId } },
                    })),
                  },
                },
              })
            }
            const dispositionEvidence = result.objectDispositions.flatMap(
              (disposition) =>
                disposition.evidenceStatementIds.map((statementId) => ({
                  investigationId: versionId,
                  candidateObjectId: disposition.objectId,
                  evidenceStatementId: `${versionId}:${statementId}`,
                })),
            )
            if (dispositionEvidence.length > 0) {
              await transaction.investigationCandidateObjectEvidence.createMany({
                data: dispositionEvidence,
              })
            }
            if (result.unknowns.length > 0) {
              await transaction.investigationUnknown.createMany({
                data: result.unknowns.map((unknown, sortOrder) => ({
                  id: `${versionId}:unknown:${unknown.code}`,
                  investigationId: versionId,
                  code: unknown.code,
                  text: unknown.text,
                  sortOrder,
                })),
              })
            }
            return snapshot(investigationId, input, result, created.id, created.generatedAt)
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        )
      } catch (error) {
        if (!isConcurrentWrite(error) || attempt === 2) throw error
        const existing = await this.findByVersion(investigationId, result)
        if (existing !== null) return existing
      }
    }
    throw new Error('Unable to save investigation version')
  }

  private async findByVersion(
    investigationId: string,
    result: InvestigationResult,
  ): Promise<StoredInvestigation | null> {
    const existing = await this.prisma.investigation.findFirst({
      where: {
        incidentId: investigationId,
        inputHash: result.inputHash,
        rulesetVersion: result.rulesetVersion,
      },
    })
    return existing === null ? null : readStoredSnapshot(existing)
  }
}

async function persistInput(
  transaction: Prisma.TransactionClient,
  input: InvestigationInput,
): Promise<void> {
  for (const source of input.sourceDocuments) {
    const data = {
      originalUrl: source.url,
      canonicalUrl: source.url,
      publisher: source.publisher,
      title: source.title,
      sourceType: source.official ? 'official' : 'media',
      mediaType: source.contentType,
      publishedAt: toDate(source.publishedAt),
      fetchedAt: toDate(source.fetchedAt),
      sha256: source.sha256,
      cachePath: source.cachePath,
      status: source.status.toUpperCase() as 'VERIFIED' | 'UNVERIFIED' | 'UNAVAILABLE',
      extractionMetadata: jsonValue({ official: source.official, verified: source.verified }),
    }
    await transaction.sourceDocument.upsert({
      where: { id: source.id },
      create: { id: source.id, ...data },
      update: {},
    })
  }
  const region = input.incident.region.toUpperCase() as Region
  for (const station of input.stations) {
    await transaction.station.upsert({
      where: { id: station.id },
      create: { id: station.id, name: station.name, waterBody: station.waterBody, region },
      update: {},
    })
  }
  const existingIncident = await transaction.incident.findUnique({
    where: { id: input.incident.id },
    select: { metadata: true },
  })
  await transaction.incident.upsert({
    where: { id: input.incident.id },
    create: {
      id: input.incident.id,
      title: input.incident.title,
      region,
      indicator: input.incident.indicator,
      metadata: incidentMetadataSnapshot(input, existingIncident?.metadata),
    },
    update: {
      title: input.incident.title,
      region,
      indicator: input.incident.indicator,
      metadata: incidentMetadataSnapshot(input, existingIncident?.metadata),
    },
  })
  for (const signal of input.signals) {
    await transaction.incidentSignal.upsert({
      where: { id: signal.id },
      create: {
        id: signal.id,
        title: signal.title,
        observedAt: toDate(signal.observedAt),
        observedPeriod: signal.observedPeriod,
        reportedAt: new Date(signal.reportedAt),
        locationText: signal.locationText,
        phenomenon: signal.phenomenon,
        excerpt: signal.excerpt,
        sourceDocumentId: signal.sourceDocumentId,
        extractionMode: signal.extractionMode.toUpperCase() as 'LLM_VERIFIED' | 'RULE' | 'VERIFIED_SEED',
        verificationStatus: signal.verificationStatus.toUpperCase() as 'UNVERIFIED' | 'CORROBORATED' | 'OFFICIAL' | 'CONFLICTING',
        dedupKey: signal.id,
      },
      update: {},
    })
    await transaction.incidentSignalLink.upsert({
      where: { incidentId_signalId: { incidentId: input.incident.id, signalId: signal.id } },
      create: { incidentId: input.incident.id, signalId: signal.id },
      update: {},
    })
  }
  for (const relation of input.stationRelations) {
    const existingRelation = await transaction.stationRelation.findUnique({
      where: { id: relation.id },
      select: { metadata: true },
    })
    await transaction.stationRelation.upsert({
      where: { id: relation.id },
      create: {
        id: relation.id,
        fromStationId: relation.upstreamStationId,
        toStationId: relation.downstreamStationId,
        kind: 'UPSTREAM_OF',
        sourceDocumentId: relation.sourceDocumentId,
        verificationStatus: relation.verified ? 'OFFICIAL' : 'UNVERIFIED',
        notes: relation.basis,
        metadata: jsonValue({
          comparisonPair: relation.comparisonPair,
          provenance: relation.provenance,
        }),
      },
      update: {
        metadata: jsonValue({
          ...asRecord(existingRelation?.metadata),
          comparisonPair: relation.comparisonPair,
        }),
      },
    })
  }
  for (const measurement of input.measurements) {
    const data = {
      stationId: measurement.stationId,
      sourceDocumentId: measurement.sourceDocumentId,
      indicator: measurement.indicator,
      value: new Prisma.Decimal(measurement.value),
      rawValueText: measurement.rawValueText,
      unit: measurement.unit,
      matrix: measurement.matrix,
      sampledAt: toDate(measurement.sampledAt),
      sampledPeriod: measurement.sampledPeriod,
      sourceExcerpt: measurement.sourceExcerpt,
      extractionMode: 'VERIFIED_SEED' as const,
      verificationStatus: measurement.verified ? ('OFFICIAL' as const) : ('UNVERIFIED' as const),
      metadata: jsonValue({ sourcePage: measurement.sourcePage }),
    }
    await transaction.measurement.upsert({
      where: { id: measurement.id },
      create: { id: measurement.id, ...data },
      update: {},
    })
  }
  for (const candidate of input.candidateObjects) {
    const data = {
      name: candidate.name,
      objectType: candidate.category,
      basisText: `Evidence documents: ${candidate.evidenceDocumentIds.join(', ')}`,
      verificationStatus: candidate.completeness === 'confirmed' ? ('CORROBORATED' as const) : ('UNVERIFIED' as const),
      metadata: jsonValue({
        region: input.incident.region,
        stationId: candidate.stationId,
        waterBody: candidate.waterBody,
        completeness: candidate.completeness,
      }),
    }
    await transaction.candidateObject.upsert({
      where: { id: candidate.id },
      create: { id: candidate.id, ...data },
      update: {},
    })
    for (const sourceDocumentId of candidate.evidenceDocumentIds) {
      await transaction.candidateObjectSource.upsert({
        where: {
          candidateObjectId_sourceDocumentId: {
            candidateObjectId: candidate.id,
            sourceDocumentId,
          },
        },
        create: { candidateObjectId: candidate.id, sourceDocumentId },
        update: {},
      })
    }
  }
}

function mapStationRelation(relation: {
  id: string
  fromStationId: string
  toStationId: string
  kind: string
  sourceDocumentId: string | null
  verificationStatus: string
  notes: string | null
  metadata: unknown
  evidence: Array<{
    id: string
    sourceDocumentId: string
    sourcePage: number | null
    basis: string
    sourceExcerpt: string
    verificationStatus: string
  }>
}): StationRelationFact {
  const metadata = asRecord(relation.metadata)
  const provenance = asRecord(metadata.provenance)
  const evidence = relation.evidence[0]
  const reverse = relation.kind === 'DOWNSTREAM_OF'
  const sourceDocumentId = evidence?.sourceDocumentId ?? relation.sourceDocumentId
  if (sourceDocumentId === null) {
    throw new Error(`STATION_RELATION_PROVENANCE_MISSING:${relation.id}`)
  }
  const sourcePage = evidence?.sourcePage ?? readNumber(provenance.sourcePage)
  const sourceExcerpt = evidence?.sourceExcerpt ?? readString(provenance.sourceExcerpt)
  const fixturePath =
    readString(provenance.fixturePath) ??
    (evidence === undefined ? null : `database:station_relation_evidence/${evidence.id}`)
  return {
    id: relation.id,
    upstreamStationId: reverse ? relation.toStationId : relation.fromStationId,
    downstreamStationId: reverse ? relation.fromStationId : relation.toStationId,
    sourceDocumentId,
    basis: relation.notes ?? evidence?.basis ?? '',
    verified:
      relation.kind !== 'SAME_REACH' &&
      isVerified(evidence?.verificationStatus ?? relation.verificationStatus) &&
      fixturePath !== null &&
      sourcePage !== null &&
      sourceExcerpt !== null,
    comparisonPair: metadata.comparisonPair === true,
    provenance: {
      fixturePath: fixturePath ?? `database:station_relations/${relation.id}`,
      sourcePage,
      sourceExcerpt: sourceExcerpt ?? relation.notes ?? '',
    },
  }
}

function mapSourceDocument(source: {
  id: string
  title: string
  publisher: string
  originalUrl: string
  mediaType: string
  publishedAt: Date | null
  fetchedAt: Date | null
  sha256: string | null
  cachePath: string | null
  status: string
  extractionMetadata: unknown
}): SourceDocumentFact {
  const metadata = asRecord(source.extractionMetadata)
  return {
    id: source.id,
    title: source.title,
    publisher: source.publisher,
    url: source.originalUrl,
    official: metadata.official === true,
    verified: metadata.verified === true || source.status === 'VERIFIED',
    publishedAt: toIso(source.publishedAt),
    fetchedAt: toIso(source.fetchedAt),
    contentType: normalizeContentType(source.mediaType),
    sha256: source.sha256,
    cachePath: source.cachePath,
    status: source.status.toLowerCase() as SourceDocumentFact['status'],
  }
}

function readStoredSnapshot(record: {
  id: string
  incidentId: string
  generatedAt: Date
  isCurrent: boolean
  metadata: unknown
}): StoredInvestigation | null {
  const metadata = asRecord(record.metadata)
  if (!isRecord(metadata.input) || !isRecord(metadata.result)) return null
  const input = parseInvestigationInput(metadata.input)
  const result = metadata.result as InvestigationResult
  if (typeof result.inputHash !== 'string' || typeof result.rulesetVersion !== 'string') {
    return null
  }
  return {
    id: record.id,
    investigationId: record.incidentId,
    input,
    result,
    generatedAt: record.generatedAt.toISOString(),
    isCurrent: record.isCurrent,
  }
}

function snapshot(
  investigationId: string,
  input: InvestigationInput,
  result: InvestigationResult,
  id: string,
  generatedAt: Date,
): StoredInvestigation {
  return {
    id,
    investigationId,
    input: structuredClone(input),
    result: structuredClone(result),
    generatedAt: generatedAt.toISOString(),
    isCurrent: true,
  }
}

function readIncidentUnknowns(metadata: unknown): unknown[] {
  const unknowns = asRecord(metadata).unknowns
  return Array.isArray(unknowns) ? unknowns : []
}

function incidentMetadataSnapshot(
  input: InvestigationInput,
  existing?: unknown,
): Prisma.InputJsonValue {
  return jsonValue({
    ...asRecord(existing),
    unknowns: input.incident.unknowns ?? [],
    stationIds: input.stations.map(({ id }) => id),
    stationRelationIds: input.stationRelations.map(({ id }) => id),
    measurementIds: input.measurements.map(({ id }) => id),
    candidateObjectIds: input.candidateObjects.map(({ id }) => id),
    sourceDocumentIds: input.sourceDocuments.map(({ id }) => id),
  })
}

function mapDisposition(disposition: ObjectDisposition): 'FOR_CHECK' | 'OUTSIDE_CORRIDOR' | 'INSUFFICIENT_DATA' {
  if (disposition.disposition === 'in_corridor') return 'FOR_CHECK'
  if (disposition.disposition === 'does_not_explain_event') return 'OUTSIDE_CORRIDOR'
  return 'INSUFFICIENT_DATA'
}

function corridorKind(result: InvestigationResult): 'NONE' | 'BETWEEN_STATIONS' | 'OPEN_UPSTREAM' {
  if (result.corridorBounds === null) return 'NONE'
  return result.corridorBounds.upstreamStationId === null
    ? 'OPEN_UPSTREAM'
    : 'BETWEEN_STATIONS'
}

function buildVersionId(investigationId: string, result: InvestigationResult): string {
  return `${investigationId}@${result.rulesetVersion}:${result.inputHash}`
}

function isConcurrentWrite(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2002' || error.code === 'P2034')
  )
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {}
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null
}

function containsExactlyScopedIds(
  records: ReadonlyArray<{ id: string }>,
  expectedIds: readonly string[],
): boolean {
  if (records.length !== expectedIds.length) {
    return false
  }

  const expected = new Set(expectedIds)

  return records.every(({ id }) => expected.has(id))
}

function readStringArray(value: unknown): string[] | null {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item.length === 0)
  ) {
    return null
  }
  return new Set(value).size === value.length ? value : null
}

function toDate(value: string | null): Date | null {
  return value === null ? null : new Date(value)
}

function toIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString()
}

function isVerified(status: string): boolean {
  return status === 'OFFICIAL' || status === 'CORROBORATED'
}

function normalizePhenomenon(value: string): 'oil_film' | 'color_change' | 'odor' | 'fish_kill' | 'wastewater' | 'other' {
  return ['oil_film', 'color_change', 'odor', 'fish_kill', 'wastewater'].includes(value)
    ? (value as 'oil_film' | 'color_change' | 'odor' | 'fish_kill' | 'wastewater')
    : 'other'
}

function normalizeContentType(value: string): 'html' | 'pdf' | 'json' {
  const normalized = value.toLowerCase()
  if (normalized.includes('pdf')) return 'pdf'
  if (normalized.includes('json')) return 'json'
  return 'html'
}
