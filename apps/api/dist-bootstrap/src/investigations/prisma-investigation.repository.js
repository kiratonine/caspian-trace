"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaInvestigationRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("../generated/prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const investigation_input_schema_1 = require("./investigation-input.schema");
let PrismaInvestigationRepository = class PrismaInvestigationRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async loadInput(referenceId) {
        const referencedVersion = await this.prisma.investigation.findUnique({
            where: { id: referenceId },
            select: { incidentId: true, isCurrent: true },
        });
        if (referencedVersion !== null && !referencedVersion.isCurrent)
            return null;
        const incidentId = referencedVersion?.incidentId ?? referenceId;
        const incident = await this.prisma.incident.findUnique({
            where: { id: incidentId },
            include: { signals: { include: { signal: true } } },
        });
        if (incident === null)
            return null;
        const scopes = readRuntimeBootstrapScopes(asRecord(incident.metadata));
        if (scopes === null)
            return null;
        const stations = await this.prisma.station.findMany({
            where: { id: { in: scopes.stationIds } },
            orderBy: { id: 'asc' },
        });
        const [relations, relationEvidence, measurements, candidates] = await Promise.all([
            this.prisma.stationRelation.findMany({
                where: { id: { in: scopes.stationRelationIds } },
                orderBy: { id: 'asc' },
            }),
            scopes.stationRelationFacts.length === 0
                ? Promise.resolve([])
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
        ]);
        if (!containsExactlyScopedIds(stations, scopes.stationIds) ||
            !containsExactlyScopedIds(relations, scopes.stationRelationIds) ||
            !containsExactlyScopedIds(relationEvidence, scopes.stationRelationFacts.map(({ evidenceId }) => evidenceId)) ||
            !containsExactlyScopedIds(measurements, scopes.measurementIds) ||
            !containsExactlyScopedIds(candidates, scopes.candidateObjectIds)) {
            return null;
        }
        const stationById = new Map(stations.map((station) => [station.id, station]));
        if (scopes.stationFacts.some((fact) => {
            const station = stationById.get(fact.id);
            return station === undefined || !matchesScopedStation(station, fact);
        })) {
            return null;
        }
        const measurementById = new Map(measurements.map((measurement) => [measurement.id, measurement]));
        if (scopes.measurementFacts.some((fact) => {
            const measurement = measurementById.get(fact.id);
            return measurement === undefined || !matchesScopedMeasurement(measurement, fact);
        })) {
            return null;
        }
        const sources = await this.prisma.sourceDocument.findMany({
            where: { id: { in: scopes.sourceDocumentIds } },
            orderBy: { id: 'asc' },
        });
        if (!containsExactlyScopedIds(sources, scopes.sourceDocumentIds))
            return null;
        const sourceById = new Map(sources.map((source) => [source.id, source]));
        if (scopes.sourceDocumentFacts.some((fact) => {
            const source = sourceById.get(fact.id);
            return source === undefined || !matchesScopedSourceDocument(source, fact);
        })) {
            return null;
        }
        const sourceIds = new Set(scopes.sourceDocumentIds);
        const stationIds = new Set(scopes.stationIds);
        const relationById = new Map(relations.map((relation) => [relation.id, relation]));
        const evidenceById = new Map(relationEvidence.map((evidence) => [evidence.id, evidence]));
        const candidateFactById = new Map(scopes.candidateObjectFacts.map((fact) => [fact.candidateObjectId, fact]));
        const stationRelations = [];
        for (const fact of scopes.stationRelationFacts) {
            const relation = relationById.get(fact.relationId);
            const evidence = evidenceById.get(fact.evidenceId);
            if (relation === undefined || evidence === undefined)
                return null;
            const mapped = mapScopedStationRelation(relation, evidence, fact);
            if (mapped === null ||
                !stationIds.has(mapped.upstreamStationId) ||
                !stationIds.has(mapped.downstreamStationId) ||
                !sourceIds.has(mapped.sourceDocumentId)) {
                return null;
            }
            stationRelations.push(mapped);
        }
        if (incident.signals.some(({ signal }) => !sourceIds.has(signal.sourceDocumentId)) ||
            measurements.some((measurement) => !stationIds.has(measurement.stationId) ||
                !sourceIds.has(measurement.sourceDocumentId))) {
            return null;
        }
        const candidateObjects = [];
        for (const candidate of candidates) {
            const fact = candidateFactById.get(candidate.id);
            if (fact === undefined)
                return null;
            const linkedSourceIds = new Set(candidate.sources.map(({ sourceDocumentId }) => sourceDocumentId));
            if (fact.evidenceDocumentIds.some((sourceDocumentId) => !sourceIds.has(sourceDocumentId) || !linkedSourceIds.has(sourceDocumentId))) {
                return null;
            }
            const metadata = asRecord(candidate.metadata);
            const stationId = readString(metadata.stationId);
            if (stationId !== null && !stationIds.has(stationId))
                return null;
            candidateObjects.push({
                id: candidate.id,
                name: candidate.name,
                category: candidate.objectType,
                stationId,
                waterBody: readString(metadata.waterBody),
                evidenceDocumentIds: fact.evidenceDocumentIds,
                completeness: metadata.completeness === 'confirmed' ? 'confirmed' : 'partial',
            });
        }
        try {
            return (0, investigation_input_schema_1.parseInvestigationInput)({
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
                stations: scopes.stationFacts,
                stationRelations,
                measurements: scopes.measurementFacts,
                candidateObjects,
                sourceDocuments: scopes.sourceDocumentFacts,
            });
        }
        catch {
            return null;
        }
    }
    async findCurrent(referenceId) {
        const exactCurrent = await this.prisma.investigation.findFirst({
            where: { id: referenceId, isCurrent: true },
        });
        if (exactCurrent !== null)
            return readStoredSnapshot(exactCurrent);
        const currentByIncident = await this.prisma.investigation.findFirst({
            where: { incidentId: referenceId, isCurrent: true },
            orderBy: { generatedAt: 'desc' },
        });
        return currentByIncident === null ? null : readStoredSnapshot(currentByIncident);
    }
    async saveVersioned(investigationId, input, result) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                return await this.prisma.$transaction(async (transaction) => {
                    const existing = await transaction.investigation.findFirst({
                        where: {
                            incidentId: investigationId,
                            inputHash: result.inputHash,
                            rulesetVersion: result.rulesetVersion,
                        },
                    });
                    if (existing !== null) {
                        await transaction.investigation.updateMany({
                            where: { incidentId: investigationId, id: { not: existing.id } },
                            data: { isCurrent: false },
                        });
                        if (!existing.isCurrent) {
                            await transaction.investigation.update({
                                where: { id: existing.id },
                                data: { isCurrent: true },
                            });
                        }
                        return snapshot(investigationId, input, result, existing.id, existing.generatedAt);
                    }
                    await persistInput(transaction, input);
                    await transaction.investigation.updateMany({
                        where: { incidentId: investigationId, isCurrent: true },
                        data: { isCurrent: false },
                    });
                    const versionId = buildVersionId(investigationId, result);
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
                    });
                    if (input.measurements.length > 0) {
                        await transaction.investigationMeasurement.createMany({
                            data: input.measurements.map(({ id }) => ({
                                investigationId: versionId,
                                measurementId: id,
                            })),
                        });
                    }
                    if (result.objectDispositions.length > 0) {
                        await transaction.investigationCandidateObject.createMany({
                            data: result.objectDispositions.map((disposition) => ({
                                investigationId: versionId,
                                candidateObjectId: disposition.objectId,
                                disposition: mapDisposition(disposition),
                            })),
                        });
                    }
                    const statements = [
                        ...result.supportedFacts,
                        ...result.contradictedHypotheses,
                    ];
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
                        });
                    }
                    const dispositionEvidence = result.objectDispositions.flatMap((disposition) => disposition.evidenceStatementIds.map((statementId) => ({
                        investigationId: versionId,
                        candidateObjectId: disposition.objectId,
                        evidenceStatementId: `${versionId}:${statementId}`,
                    })));
                    if (dispositionEvidence.length > 0) {
                        await transaction.investigationCandidateObjectEvidence.createMany({
                            data: dispositionEvidence,
                        });
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
                        });
                    }
                    return snapshot(investigationId, input, result, created.id, created.generatedAt);
                }, {
                    isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable,
                    maxWait: 10_000,
                    timeout: 30_000,
                });
            }
            catch (error) {
                if (!isConcurrentWrite(error) || attempt === 2)
                    throw error;
                const existing = await this.findByVersion(investigationId, result);
                if (existing !== null)
                    return existing;
            }
        }
        throw new Error('Unable to save investigation version');
    }
    async findByVersion(investigationId, result) {
        const existing = await this.prisma.investigation.findFirst({
            where: {
                incidentId: investigationId,
                inputHash: result.inputHash,
                rulesetVersion: result.rulesetVersion,
            },
        });
        return existing === null ? null : readStoredSnapshot(existing);
    }
};
exports.PrismaInvestigationRepository = PrismaInvestigationRepository;
exports.PrismaInvestigationRepository = PrismaInvestigationRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PrismaInvestigationRepository);
async function persistInput(transaction, input) {
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
            status: source.status.toUpperCase(),
            extractionMetadata: jsonValue({ official: source.official, verified: source.verified }),
        };
        await transaction.sourceDocument.upsert({
            where: { id: source.id },
            create: { id: source.id, ...data },
            update: {},
        });
    }
    const region = input.incident.region.toUpperCase();
    for (const station of input.stations) {
        await transaction.station.upsert({
            where: { id: station.id },
            create: { id: station.id, name: station.name, waterBody: station.waterBody, region },
            update: {},
        });
    }
    const existingIncident = await transaction.incident.findUnique({
        where: { id: input.incident.id },
        select: { metadata: true },
    });
    const runtimeBootstrapRelationIds = readRuntimeBootstrapRelationIds(existingIncident?.metadata);
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
    });
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
                extractionMode: signal.extractionMode.toUpperCase(),
                verificationStatus: signal.verificationStatus.toUpperCase(),
                dedupKey: signal.id,
            },
            update: {},
        });
        await transaction.incidentSignalLink.upsert({
            where: { incidentId_signalId: { incidentId: input.incident.id, signalId: signal.id } },
            create: { incidentId: input.incident.id, signalId: signal.id },
            update: {},
        });
    }
    for (const relation of input.stationRelations) {
        if (runtimeBootstrapRelationIds !== undefined) {
            const canonicalRelationId = runtimeBootstrapRelationIds.get(relation.id);
            if (canonicalRelationId === undefined) {
                throw new Error(`Missing runtime bootstrap station relation mapping for evidence ${relation.id}`);
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
            });
            if (canonicalRelation === null ||
                !matchesInputStationRelation(canonicalRelation, relation)) {
                throw new Error(`Canonical station relation ${canonicalRelationId} does not match evidence ${relation.id}`);
            }
            await transaction.stationRelation.update({
                where: { id: canonicalRelationId },
                data: {
                    metadata: jsonValue({
                        ...asRecord(canonicalRelation.metadata),
                        comparisonPair: relation.comparisonPair,
                    }),
                },
            });
            continue;
        }
        const existingRelation = await transaction.stationRelation.findUnique({
            where: { id: relation.id },
            select: { metadata: true },
        });
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
        });
    }
    for (const measurement of input.measurements) {
        const data = {
            stationId: measurement.stationId,
            sourceDocumentId: measurement.sourceDocumentId,
            indicator: measurement.indicator,
            value: new client_1.Prisma.Decimal(measurement.value),
            rawValueText: measurement.rawValueText,
            unit: measurement.unit,
            matrix: measurement.matrix,
            sampledAt: toDate(measurement.sampledAt),
            sampledPeriod: measurement.sampledPeriod,
            sourceExcerpt: measurement.sourceExcerpt,
            extractionMode: 'VERIFIED_SEED',
            verificationStatus: measurement.verified ? 'OFFICIAL' : 'UNVERIFIED',
            metadata: jsonValue({ sourcePage: measurement.sourcePage }),
        };
        await transaction.measurement.upsert({
            where: { id: measurement.id },
            create: { id: measurement.id, ...data },
            update: {},
        });
    }
    for (const candidate of input.candidateObjects) {
        const data = {
            name: candidate.name,
            objectType: candidate.category,
            basisText: `Evidence documents: ${candidate.evidenceDocumentIds.join(', ')}`,
            verificationStatus: candidate.completeness === 'confirmed' ? 'CORROBORATED' : 'UNVERIFIED',
            metadata: jsonValue({
                region: input.incident.region,
                stationId: candidate.stationId,
                waterBody: candidate.waterBody,
                completeness: candidate.completeness,
            }),
        };
        await transaction.candidateObject.upsert({
            where: { id: candidate.id },
            create: { id: candidate.id, ...data },
            update: {},
        });
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
            });
        }
    }
}
function readRuntimeBootstrapRelationIds(metadata) {
    const incidentMetadata = asRecord(metadata);
    if (incidentMetadata.runtimeBootstrap === undefined)
        return undefined;
    if (!isRecord(incidentMetadata.runtimeBootstrap)) {
        throw new Error('Invalid incident runtime bootstrap metadata');
    }
    const facts = incidentMetadata.runtimeBootstrap.stationRelationFacts;
    if (!Array.isArray(facts)) {
        throw new Error('Invalid runtime bootstrap station relation facts');
    }
    const relationIds = new Map();
    for (const fact of facts) {
        if (!isRecord(fact)) {
            throw new Error('Invalid runtime bootstrap station relation fact');
        }
        const evidenceId = readString(fact.evidenceId);
        const relationId = readString(fact.relationId);
        if (evidenceId === null ||
            relationId === null ||
            relationIds.has(evidenceId)) {
            throw new Error('Invalid runtime bootstrap station relation mapping');
        }
        relationIds.set(evidenceId, relationId);
    }
    return relationIds;
}
function matchesInputStationRelation(canonical, input) {
    if (canonical.kind === 'UPSTREAM_OF') {
        return (canonical.fromStationId === input.upstreamStationId &&
            canonical.toStationId === input.downstreamStationId);
    }
    if (canonical.kind === 'DOWNSTREAM_OF') {
        return (canonical.fromStationId === input.downstreamStationId &&
            canonical.toStationId === input.upstreamStationId);
    }
    return false;
}
function mapScopedStationRelation(relation, evidence, fact) {
    if (evidence.id !== fact.evidenceId ||
        evidence.stationRelationId !== relation.id ||
        evidence.sourceDocumentId !== fact.sourceDocumentId ||
        evidence.sourcePage !== fact.provenance.sourcePage ||
        evidence.sourceExcerpt !== fact.provenance.sourceExcerpt ||
        !basisMatchesEvidence(fact.basis, evidence.basis) ||
        (asRecord(relation.metadata).comparisonPair === true) !== fact.comparisonPair) {
        return null;
    }
    const reverse = relation.kind === 'DOWNSTREAM_OF';
    if (!reverse && relation.kind !== 'UPSTREAM_OF')
        return null;
    return {
        id: fact.evidenceId,
        upstreamStationId: reverse ? relation.toStationId : relation.fromStationId,
        downstreamStationId: reverse ? relation.fromStationId : relation.toStationId,
        sourceDocumentId: fact.sourceDocumentId,
        basis: fact.basis,
        verified: isVerified(relation.verificationStatus) &&
            isVerified(evidence.verificationStatus),
        comparisonPair: fact.comparisonPair,
        provenance: fact.provenance,
    };
}
const relationEvidenceBasisByFact = new Map([
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
]);
function basisMatchesEvidence(factBasis, evidenceBasis) {
    return factBasis === evidenceBasis || relationEvidenceBasisByFact.get(factBasis) === evidenceBasis;
}
function matchesScopedMeasurement(measurement, fact) {
    const sourcePage = measurement.sourcePage?.pageNumber ??
        readNumber(asRecord(measurement.metadata).sourcePage);
    return (measurement.id === fact.id &&
        measurement.stationId === fact.stationId &&
        measurement.sourceDocumentId === fact.sourceDocumentId &&
        measurement.indicator === fact.indicator &&
        measurement.matrix === fact.matrix &&
        decimalMatches(measurement.value, fact.value) &&
        measurement.rawValueText === fact.rawValueText &&
        measurement.unit === fact.unit &&
        measurementDateMatches(measurement.sampledAt, fact.sampledAt) &&
        measurement.sampledPeriod === fact.sampledPeriod &&
        sourcePage === fact.sourcePage &&
        isVerified(measurement.verificationStatus) === fact.verified &&
        measurementExcerptMatches(measurement.sourceExcerpt, fact.sourceExcerpt));
}
function decimalMatches(value, fact) {
    try {
        return new client_1.Prisma.Decimal(value.toString()).equals(new client_1.Prisma.Decimal(fact));
    }
    catch {
        return false;
    }
}
function measurementDateMatches(value, fact) {
    if (value === null || fact === null)
        return value === null && fact === null;
    return new Date(value.toISOString()).getTime() === new Date(fact).getTime();
}
function measurementExcerptMatches(value, fact) {
    return value === fact || (value !== null &&
        fact !== null &&
        value.endsWith(fact));
}
function mapSourceDocument(source) {
    const metadata = asRecord(source.extractionMetadata);
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
        status: source.status.toLowerCase(),
    };
}
function matchesScopedSourceDocument(source, fact) {
    const mapped = mapSourceDocument(source);
    return (mapped.id === fact.id &&
        mapped.url === fact.url &&
        mapped.publisher === fact.publisher &&
        mapped.contentType === fact.contentType &&
        (fact.sha256 === null || mapped.sha256 === fact.sha256) &&
        (fact.cachePath === null || mapped.cachePath === fact.cachePath) &&
        matchesScopedDate(mapped.fetchedAt, fact.fetchedAt) &&
        matchesScopedDate(mapped.publishedAt, fact.publishedAt));
}
function matchesScopedDate(value, fact) {
    return fact === null || (value !== null &&
        new Date(value).getTime() === new Date(fact).getTime());
}
function readStoredSnapshot(record) {
    const metadata = asRecord(record.metadata);
    if (!isRecord(metadata.input) || !isRecord(metadata.result))
        return null;
    const input = (0, investigation_input_schema_1.parseInvestigationInput)(metadata.input);
    const result = metadata.result;
    if (typeof result.inputHash !== 'string' || typeof result.rulesetVersion !== 'string') {
        return null;
    }
    return {
        id: record.id,
        investigationId: record.incidentId,
        input,
        result,
        generatedAt: record.generatedAt.toISOString(),
        isCurrent: record.isCurrent,
    };
}
function snapshot(investigationId, input, result, id, generatedAt) {
    return {
        id,
        investigationId,
        input: structuredClone(input),
        result: structuredClone(result),
        generatedAt: generatedAt.toISOString(),
        isCurrent: true,
    };
}
function readIncidentUnknowns(metadata) {
    const unknowns = asRecord(metadata).unknowns;
    return Array.isArray(unknowns) ? unknowns : [];
}
function incidentUnknowns(unknowns) {
    return unknowns.length === 0 ? {} : { unknowns };
}
function incidentMetadataSnapshot(input, existing) {
    const existingMetadata = asRecord(existing);
    return jsonValue({
        ...existingMetadata,
        unknowns: input.incident.unknowns ?? [],
        stationIds: input.stations.map(({ id }) => id),
        stationRelationIds: existingMetadata.stationRelationIds ??
            input.stationRelations.map(({ id }) => id),
        measurementIds: input.measurements.map(({ id }) => id),
        candidateObjectIds: input.candidateObjects.map(({ id }) => id),
        sourceDocumentIds: input.sourceDocuments.map(({ id }) => id),
    });
}
function mapDisposition(disposition) {
    if (disposition.disposition === 'in_corridor')
        return 'FOR_CHECK';
    if (disposition.disposition === 'does_not_explain_event')
        return 'OUTSIDE_CORRIDOR';
    return 'INSUFFICIENT_DATA';
}
function corridorKind(result) {
    if (result.corridorBounds === null)
        return 'NONE';
    return result.corridorBounds.upstreamStationId === null
        ? 'OPEN_UPSTREAM'
        : 'BETWEEN_STATIONS';
}
function buildVersionId(investigationId, result) {
    return `${investigationId}@${result.rulesetVersion}:${result.inputHash}`;
}
function isConcurrentWrite(error) {
    return (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034'));
}
function jsonValue(value) {
    return JSON.parse(JSON.stringify(value));
}
function asRecord(value) {
    return isRecord(value) ? value : {};
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function readString(value) {
    return typeof value === 'string' && value.length > 0 ? value : null;
}
function readNumber(value) {
    return typeof value === 'number' && Number.isInteger(value) && value > 0
        ? value
        : null;
}
function readRuntimeBootstrapScopes(metadata) {
    const stationIds = readStringArray(metadata.stationIds);
    const stationRelationIds = readStringArray(metadata.stationRelationIds);
    const measurementIds = readStringArray(metadata.measurementIds);
    const candidateObjectIds = readStringArray(metadata.candidateObjectIds);
    const sourceDocumentIds = readStringArray(metadata.sourceDocumentIds);
    if (stationIds === null ||
        stationRelationIds === null ||
        measurementIds === null ||
        candidateObjectIds === null ||
        sourceDocumentIds === null ||
        (metadata.unknowns !== undefined && !Array.isArray(metadata.unknowns)) ||
        !isRecord(metadata.runtimeBootstrap)) {
        return null;
    }
    const stationRelationFacts = readScopedStationRelationFacts(metadata.runtimeBootstrap.stationRelationFacts);
    const stationFacts = readScopedStationFacts(metadata.runtimeBootstrap.stationFacts);
    const candidateObjectFacts = readScopedCandidateObjectFacts(metadata.runtimeBootstrap.candidateObjectFacts);
    const sourceDocumentFacts = readScopedSourceDocumentFacts(metadata.runtimeBootstrap.sourceDocumentFacts);
    const measurementFacts = sourceDocumentFacts === null
        ? null
        : readScopedMeasurementFacts(metadata.runtimeBootstrap.measurementFacts, stationIds, sourceDocumentFacts);
    if (stationFacts === null ||
        stationRelationFacts === null ||
        candidateObjectFacts === null ||
        sourceDocumentFacts === null ||
        measurementFacts === null ||
        !containsExactlyScopedIds(stationFacts, stationIds) ||
        !containsExactlyScopedIds(stationRelationFacts.map(({ relationId }) => ({ id: relationId })), stationRelationIds) ||
        !containsExactlyScopedIds(candidateObjectFacts.map(({ candidateObjectId }) => ({ id: candidateObjectId })), candidateObjectIds) ||
        !containsExactlyScopedIds(sourceDocumentFacts, sourceDocumentIds) ||
        !containsExactlyScopedIds(measurementFacts, measurementIds)) {
        return null;
    }
    return {
        stationIds,
        stationRelationIds,
        measurementIds,
        candidateObjectIds,
        sourceDocumentIds,
        stationFacts,
        measurementFacts,
        sourceDocumentFacts,
        stationRelationFacts,
        candidateObjectFacts,
    };
}
function readScopedStationFacts(value) {
    if (!Array.isArray(value))
        return null;
    try {
        return (0, investigation_input_schema_1.parseInvestigationInput)({
            incident: {
                id: 'runtime-bootstrap-station-facts',
                title: 'Runtime bootstrap station facts',
                region: 'atyrau',
                indicator: 'runtime-bootstrap-validation',
            },
            signals: [],
            stations: value,
            stationRelations: [],
            measurements: [],
            candidateObjects: [],
            sourceDocuments: [],
        }).stations;
    }
    catch {
        return null;
    }
}
function matchesScopedStation(station, fact) {
    return (station.id === fact.id &&
        station.waterBody === fact.waterBody &&
        (station.name === fact.name ||
            normalizeScopedStationName(station.name) === normalizeScopedStationName(fact.name)));
}
function normalizeScopedStationName(value) {
    return value
        .normalize('NFC')
        .replace(/(^|\s)г\.\s*/giu, '$1')
        .replace(/\s+/gu, ' ')
        .trim();
}
function readScopedMeasurementFacts(value, stationIds, sourceDocumentFacts) {
    if (!Array.isArray(value))
        return null;
    try {
        return (0, investigation_input_schema_1.parseInvestigationInput)({
            incident: {
                id: 'runtime-bootstrap-measurement-facts',
                title: 'Runtime bootstrap measurement facts',
                region: 'atyrau',
                indicator: 'runtime-bootstrap-validation',
            },
            signals: [],
            stations: stationIds.map((id) => ({
                id,
                name: id,
                waterBody: 'runtime-bootstrap-validation',
            })),
            stationRelations: [],
            measurements: value,
            candidateObjects: [],
            sourceDocuments: sourceDocumentFacts,
        }).measurements;
    }
    catch {
        return null;
    }
}
function readScopedSourceDocumentFacts(value) {
    if (!Array.isArray(value))
        return null;
    try {
        return (0, investigation_input_schema_1.parseInvestigationInput)({
            incident: {
                id: 'runtime-bootstrap-source-document-facts',
                title: 'Runtime bootstrap source document facts',
                region: 'atyrau',
                indicator: 'runtime-bootstrap-validation',
            },
            signals: [],
            stations: [],
            stationRelations: [],
            measurements: [],
            candidateObjects: [],
            sourceDocuments: value,
        }).sourceDocuments;
    }
    catch {
        return null;
    }
}
function readScopedStationRelationFacts(value) {
    if (!Array.isArray(value))
        return null;
    const facts = [];
    for (const item of value) {
        if (!isRecord(item) || !isRecord(item.provenance))
            return null;
        const relationId = readString(item.relationId);
        const evidenceId = readString(item.evidenceId);
        const sourceDocumentId = readString(item.sourceDocumentId);
        const basis = readString(item.basis);
        const fixturePath = readString(item.provenance.fixturePath);
        const sourceExcerpt = readString(item.provenance.sourceExcerpt);
        const sourcePage = readNullablePositiveInteger(item.provenance.sourcePage);
        if (relationId === null ||
            evidenceId === null ||
            sourceDocumentId === null ||
            basis === null ||
            typeof item.comparisonPair !== 'boolean' ||
            fixturePath === null ||
            sourceExcerpt === null ||
            sourcePage === undefined) {
            return null;
        }
        facts.push({
            relationId,
            evidenceId,
            sourceDocumentId,
            basis,
            comparisonPair: item.comparisonPair,
            provenance: { fixturePath, sourcePage, sourceExcerpt },
        });
    }
    const relationIds = facts.map(({ relationId }) => relationId);
    const evidenceIds = facts.map(({ evidenceId }) => evidenceId);
    return new Set(relationIds).size === facts.length &&
        new Set(evidenceIds).size === facts.length
        ? facts
        : null;
}
function readScopedCandidateObjectFacts(value) {
    if (!Array.isArray(value))
        return null;
    const facts = [];
    for (const item of value) {
        if (!isRecord(item))
            return null;
        const candidateObjectId = readString(item.candidateObjectId);
        const evidenceDocumentIds = readStringArray(item.evidenceDocumentIds);
        if (candidateObjectId === null ||
            evidenceDocumentIds === null ||
            evidenceDocumentIds.length === 0) {
            return null;
        }
        facts.push({ candidateObjectId, evidenceDocumentIds });
    }
    return new Set(facts.map(({ candidateObjectId }) => candidateObjectId)).size ===
        facts.length
        ? facts
        : null;
}
function readNullablePositiveInteger(value) {
    if (value === null)
        return null;
    return readNumber(value) ?? undefined;
}
function containsExactlyScopedIds(records, expectedIds) {
    if (records.length !== expectedIds.length) {
        return false;
    }
    const expected = new Set(expectedIds);
    return records.every(({ id }) => expected.has(id));
}
function readStringArray(value) {
    if (!Array.isArray(value) ||
        value.some((item) => typeof item !== 'string' || item.length === 0)) {
        return null;
    }
    return new Set(value).size === value.length ? value : null;
}
function toDate(value) {
    return value === null ? null : new Date(value);
}
function toIso(value) {
    return value === null ? null : value.toISOString();
}
function isVerified(status) {
    return status === 'OFFICIAL' || status === 'CORROBORATED';
}
function normalizePhenomenon(value) {
    return ['oil_film', 'color_change', 'odor', 'fish_kill', 'wastewater'].includes(value)
        ? value
        : 'other';
}
function normalizeContentType(value) {
    const normalized = value.toLowerCase();
    if (normalized.includes('pdf'))
        return 'pdf';
    if (normalized.includes('json'))
        return 'json';
    return 'html';
}
//# sourceMappingURL=prisma-investigation.repository.js.map