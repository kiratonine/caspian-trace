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

type ScopedStationRelationFact = {
  relationId: string
  evidenceId: string
  sourceDocumentId: string
  basis: string
  comparisonPair: boolean
  provenance: StationRelationFact['provenance']
}

type ScopedCandidateObjectFact = {
  candidateObjectId: string
  evidenceDocumentIds: string[]
}

type RuntimeBootstrapScopes = {
  stationIds: string[]
  stationRelationIds: string[]
  measurementIds: string[]
  candidateObjectIds: string[]
  sourceDocumentIds: string[]
  stationRelationFacts: ScopedStationRelationFact[]
  candidateObjectFacts: ScopedCandidateObjectFact[]
}

type StationRelationEvidenceRecord = {
  id: string
  stationRelationId: string
  sourceDocumentId: string
  sourcePage: number | null
  basis: string
  sourceExcerpt: string
  verificationStatus: string
}

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

    const scopes = readRuntimeBootstrapScopes(asRecord(incident.metadata))
    if (scopes === null) return null

    const stations = await this.prisma.station.findMany({
      where: { id: { in: scopes.stationIds } },
      orderBy: { id: 'asc' },
    })
    const [relations, relationEvidence, measurements, candidates] = await Promise.all([
      this.prisma.stationRelation.findMany({
        where: { id: { in: scopes.stationRelationIds } },
        orderBy: { id: 'asc' },
      }),
      scopes.stationRelationFacts.length === 0
        ? Promise.resolve([] as StationRelationEvidenceRecord[])
        : this.prisma.stationRelationEvidence.findMany({
            where: {
              id: {
                in: scopes.stationRelationFacts.map(({ evidenceId }) => evidenceId),
              },
            },
            orderBy: { id: 'asc' },
          }),
      this.prisma.measurement.findMany({
        where: { id: { in: scopes.measurementIds } },
        include: { sourcePage: true },
        orderBy: { id: 'asc' },
      }),
      this.prisma.candidateObject.findMany({
        where: { id: { in: scopes.candidateObjectIds } },
        include: { sources: true },
        orderBy: { id: 'asc' },
      }),
    ])

    if (
      !containsExactlyScopedIds(stations, scopes.stationIds) ||
      !containsExactlyScopedIds(relations, scopes.stationRelationIds) ||
      !containsExactlyScopedIds(
        relationEvidence,
        scopes.stationRelationFacts.map(({ evidenceId }) => evidenceId),
      ) ||
      !containsExactlyScopedIds(measurements, scopes.measurementIds) ||
      !containsExactlyScopedIds(candidates, scopes.candidateObjectIds)
    ) {
      return null
    }

    const sources = await this.prisma.sourceDocument.findMany({
      where: { id: { in: scopes.sourceDocumentIds } },
      orderBy: { id: 'asc' },
    })
    if (!containsExactlyScopedIds(sources, scopes.sourceDocumentIds)) return null

    const sourceIds = new Set(scopes.sourceDocumentIds)
    const stationIds = new Set(scopes.stationIds)
    const relationById = new Map(relations.map((relation) => [relation.id, relation]))
    const evidenceById = new Map(relationEvidence.map((evidence) => [evidence.id, evidence]))
    const candidateFactById = new Map(
      scopes.candidateObjectFacts.map((fact) => [fact.candidateObjectId, fact]),
    )
    const stationRelations: StationRelationFact[] = []

    for (const fact of scopes.stationRelationFacts) {
      const relation = relationById.get(fact.relationId)
      const evidence = evidenceById.get(fact.evidenceId)
      if (relation === undefined || evidence === undefined) return null
      const mapped = mapScopedStationRelation(relation, evidence, fact)
      if (
        mapped === null ||
        !stationIds.has(mapped.upstreamStationId) ||
        !stationIds.has(mapped.downstreamStationId) ||
        !sourceIds.has(mapped.sourceDocumentId)
      ) {
        return null
      }
      stationRelations.push(mapped)
    }

    if (
      incident.signals.some(({ signal }) => !sourceIds.has(signal.sourceDocumentId)) ||
      measurements.some(
        (measurement) =>
          !stationIds.has(measurement.stationId) ||
          !sourceIds.has(measurement.sourceDocumentId),
      )
    ) {
      return null
    }

    const candidateObjects = []
    for (const candidate of candidates) {
      const fact = candidateFactById.get(candidate.id)
      if (fact === undefined) return null
      const linkedSourceIds = new Set(
        candidate.sources.map(({ sourceDocumentId }) => sourceDocumentId),
      )
      if (
        fact.evidenceDocumentIds.some(
          (sourceDocumentId) =>
            !sourceIds.has(sourceDocumentId) || !linkedSourceIds.has(sourceDocumentId),
        )
      ) {
        return null
      }
      const metadata = asRecord(candidate.metadata)
      const stationId = readString(metadata.stationId)
      if (stationId !== null && !stationIds.has(stationId)) return null
      candidateObjects.push({
        id: candidate.id,
        name: candidate.name,
        category: candidate.objectType,
        stationId,
        waterBody: readString(metadata.waterBody),
        evidenceDocumentIds: fact.evidenceDocumentIds,
        completeness:
          metadata.completeness === 'confirmed' ? 'confirmed' as const : 'partial' as const,
      })
    }

    try {
      return parseInvestigationInput({
        incident: {
          id: incident.id,
          title: incident.title,
          region: incident.region.toLowerCase(),
          indicator: incident.indicator ?? '',
          ...incidentUnknowns(readIncidentUnknowns(incident.metadata)),
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
        stationRelations,
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
        candidateObjects,
        sourceDocuments: sources.map(mapSourceDocument),
      })
    } catch {
      return null
    }
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
  const runtimeBootstrapRelationIds = readRuntimeBootstrapRelationIds(
    existingIncident?.metadata,
  )
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
    if (runtimeBootstrapRelationIds !== undefined) {
      const canonicalRelationId = runtimeBootstrapRelationIds.get(relation.id)
      if (canonicalRelationId === undefined) {
        throw new Error(
          `Missing runtime bootstrap station relation mapping for evidence ${relation.id}`,
        )
      }
      const canonicalRelation = await transaction.stationRelation.findUnique({
        where: { id: canonicalRelationId },
        select: {
          id: true,
          fromStationId: true,
          toStationId: true,
          kind: true,
          metadata: true,
        },
      })
      if (
        canonicalRelation === null ||
        !matchesInputStationRelation(canonicalRelation, relation)
      ) {
        throw new Error(
          `Canonical station relation ${canonicalRelationId} does not match evidence ${relation.id}`,
        )
      }
      await transaction.stationRelation.update({
        where: { id: canonicalRelationId },
        data: {
          metadata: jsonValue({
            ...asRecord(canonicalRelation.metadata),
            comparisonPair: relation.comparisonPair,
          }),
        },
      })
      continue
    }

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

function readRuntimeBootstrapRelationIds(
  metadata: unknown,
): Map<string, string> | undefined {
  const incidentMetadata = asRecord(metadata)
  if (incidentMetadata.runtimeBootstrap === undefined) return undefined
  if (!isRecord(incidentMetadata.runtimeBootstrap)) {
    throw new Error('Invalid incident runtime bootstrap metadata')
  }

  const facts = incidentMetadata.runtimeBootstrap.stationRelationFacts
  if (!Array.isArray(facts)) {
    throw new Error('Invalid runtime bootstrap station relation facts')
  }

  const relationIds = new Map<string, string>()
  for (const fact of facts) {
    if (!isRecord(fact)) {
      throw new Error('Invalid runtime bootstrap station relation fact')
    }
    const evidenceId = readString(fact.evidenceId)
    const relationId = readString(fact.relationId)
    if (
      evidenceId === null ||
      relationId === null ||
      relationIds.has(evidenceId)
    ) {
      throw new Error('Invalid runtime bootstrap station relation mapping')
    }
    relationIds.set(evidenceId, relationId)
  }
  return relationIds
}

function matchesInputStationRelation(
  canonical: {
    fromStationId: string
    toStationId: string
    kind: string
  },
  input: StationRelationFact,
): boolean {
  if (canonical.kind === 'UPSTREAM_OF') {
    return (
      canonical.fromStationId === input.upstreamStationId &&
      canonical.toStationId === input.downstreamStationId
    )
  }
  if (canonical.kind === 'DOWNSTREAM_OF') {
    return (
      canonical.fromStationId === input.downstreamStationId &&
      canonical.toStationId === input.upstreamStationId
    )
  }
  return false
}

function mapScopedStationRelation(
  relation: {
    id: string
    fromStationId: string
    toStationId: string
    kind: string
    verificationStatus: string
    metadata: unknown
  },
  evidence: StationRelationEvidenceRecord,
  fact: ScopedStationRelationFact,
): StationRelationFact | null {
  if (
    evidence.id !== fact.evidenceId ||
    evidence.stationRelationId !== relation.id ||
    evidence.sourceDocumentId !== fact.sourceDocumentId ||
    evidence.sourcePage !== fact.provenance.sourcePage ||
    evidence.sourceExcerpt !== fact.provenance.sourceExcerpt ||
    !basisMatchesEvidence(fact.basis, evidence.basis) ||
    (asRecord(relation.metadata).comparisonPair === true) !== fact.comparisonPair
  ) {
    return null
  }

  const reverse = relation.kind === 'DOWNSTREAM_OF'
  if (!reverse && relation.kind !== 'UPSTREAM_OF') return null

  return {
    id: fact.evidenceId,
    upstreamStationId: reverse ? relation.toStationId : relation.fromStationId,
    downstreamStationId: reverse ? relation.fromStationId : relation.toStationId,
    sourceDocumentId: fact.sourceDocumentId,
    basis: fact.basis,
    verified:
      isVerified(relation.verificationStatus) &&
      isVerified(evidence.verificationStatus),
    comparisonPair: fact.comparisonPair,
    provenance: fact.provenance,
  }
}

const relationEvidenceBasisByFact = new Map<string, string>([
  [
    'Официальная парная маркировка выше/ниже одного сброса',
    'OFFICIAL_PAIRED_ABOVE_BELOW_LABELS',
  ],
  [
    'Названия створов в приложении 2: 1 км выше города и 0,5 км выше городского сброса',
    'OFFICIAL_MONITORING_TABLE_SEQUENCE_AND_STATION_LABELS',
  ],
  [
    'Названия створов в приложении 2',
    'OFFICIAL_MONITORING_TABLE_SEQUENCE_AND_STATION_LABELS',
  ],
])

function basisMatchesEvidence(factBasis: string, evidenceBasis: string): boolean {
  return factBasis === evidenceBasis || relationEvidenceBasisByFact.get(factBasis) === evidenceBasis
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

function incidentUnknowns(unknowns: unknown[]): { unknowns?: unknown[] } {
  return unknowns.length === 0 ? {} : { unknowns }
}

function incidentMetadataSnapshot(
  input: InvestigationInput,
  existing?: unknown,
): Prisma.InputJsonValue {
  const existingMetadata = asRecord(existing)
  return jsonValue({
    ...existingMetadata,
    unknowns: input.incident.unknowns ?? [],
    stationIds: input.stations.map(({ id }) => id),
    stationRelationIds:
      existingMetadata.stationRelationIds ??
      input.stationRelations.map(({ id }) => id),
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

function readRuntimeBootstrapScopes(metadata: JsonRecord): RuntimeBootstrapScopes | null {
  const stationIds = readStringArray(metadata.stationIds)
  const stationRelationIds = readStringArray(metadata.stationRelationIds)
  const measurementIds = readStringArray(metadata.measurementIds)
  const candidateObjectIds = readStringArray(metadata.candidateObjectIds)
  const sourceDocumentIds = readStringArray(metadata.sourceDocumentIds)
  if (
    stationIds === null ||
    stationRelationIds === null ||
    measurementIds === null ||
    candidateObjectIds === null ||
    sourceDocumentIds === null ||
    (metadata.unknowns !== undefined && !Array.isArray(metadata.unknowns)) ||
    !isRecord(metadata.runtimeBootstrap)
  ) {
    return null
  }

  const stationRelationFacts = readScopedStationRelationFacts(
    metadata.runtimeBootstrap.stationRelationFacts,
  )
  const candidateObjectFacts = readScopedCandidateObjectFacts(
    metadata.runtimeBootstrap.candidateObjectFacts,
  )
  if (
    stationRelationFacts === null ||
    candidateObjectFacts === null ||
    !containsExactlyScopedIds(
      stationRelationFacts.map(({ relationId }) => ({ id: relationId })),
      stationRelationIds,
    ) ||
    !containsExactlyScopedIds(
      candidateObjectFacts.map(({ candidateObjectId }) => ({ id: candidateObjectId })),
      candidateObjectIds,
    )
  ) {
    return null
  }

  return {
    stationIds,
    stationRelationIds,
    measurementIds,
    candidateObjectIds,
    sourceDocumentIds,
    stationRelationFacts,
    candidateObjectFacts,
  }
}

function readScopedStationRelationFacts(
  value: unknown,
): ScopedStationRelationFact[] | null {
  if (!Array.isArray(value)) return null
  const facts: ScopedStationRelationFact[] = []
  for (const item of value) {
    if (!isRecord(item) || !isRecord(item.provenance)) return null
    const relationId = readString(item.relationId)
    const evidenceId = readString(item.evidenceId)
    const sourceDocumentId = readString(item.sourceDocumentId)
    const basis = readString(item.basis)
    const fixturePath = readString(item.provenance.fixturePath)
    const sourceExcerpt = readString(item.provenance.sourceExcerpt)
    const sourcePage = readNullablePositiveInteger(item.provenance.sourcePage)
    if (
      relationId === null ||
      evidenceId === null ||
      sourceDocumentId === null ||
      basis === null ||
      typeof item.comparisonPair !== 'boolean' ||
      fixturePath === null ||
      sourceExcerpt === null ||
      sourcePage === undefined
    ) {
      return null
    }
    facts.push({
      relationId,
      evidenceId,
      sourceDocumentId,
      basis,
      comparisonPair: item.comparisonPair,
      provenance: { fixturePath, sourcePage, sourceExcerpt },
    })
  }
  const relationIds = facts.map(({ relationId }) => relationId)
  const evidenceIds = facts.map(({ evidenceId }) => evidenceId)
  return new Set(relationIds).size === facts.length &&
    new Set(evidenceIds).size === facts.length
    ? facts
    : null
}

function readScopedCandidateObjectFacts(
  value: unknown,
): ScopedCandidateObjectFact[] | null {
  if (!Array.isArray(value)) return null
  const facts: ScopedCandidateObjectFact[] = []
  for (const item of value) {
    if (!isRecord(item)) return null
    const candidateObjectId = readString(item.candidateObjectId)
    const evidenceDocumentIds = readStringArray(item.evidenceDocumentIds)
    if (
      candidateObjectId === null ||
      evidenceDocumentIds === null ||
      evidenceDocumentIds.length === 0
    ) {
      return null
    }
    facts.push({ candidateObjectId, evidenceDocumentIds })
  }
  return new Set(facts.map(({ candidateObjectId }) => candidateObjectId)).size ===
    facts.length
    ? facts
    : null
}

function readNullablePositiveInteger(value: unknown): number | null | undefined {
  if (value === null) return null
  return readNumber(value) ?? undefined
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
