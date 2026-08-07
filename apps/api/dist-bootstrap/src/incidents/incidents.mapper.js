"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapIncidentSummary = mapIncidentSummary;
exports.mapIncidentDetail = mapIncidentDetail;
const contracts_1 = require("@caspian-trace/contracts");
const enums_1 = require("../generated/prisma/enums");
const incidents_errors_1 = require("./incidents.errors");
function mapIncidentSummary(row) {
    const measurements = row.measurements.map(({ measurement }) => measurement);
    const result = {
        id: row.id,
        title: requireText(row.incident.title),
        region: mapRegion(row.incident.region),
        evidenceLevel: mapEvidenceLevel(row.evidenceLevel),
        indicator: resolveIndicator(row.incident.indicator, measurements),
        updatedAt: row.generatedAt.toISOString(),
        period: resolvePeriod(measurements),
    };
    if (!contracts_1.IncidentSummarySchema.safeParse(result).success)
        invalidData();
    return result;
}
function mapIncidentDetail(row) {
    const signals = row.incident.signals
        .map(({ signal }) => mapSignal(signal))
        .sort(compareSignals);
    const measurements = row.measurements
        .map(({ measurement }) => mapMeasurement(measurement))
        .sort((left, right) => compareMeasurements(left, right, row));
    const statements = row.evidenceStatements.map(mapStatement);
    const candidateObjects = row.candidateObjects
        .map(({ candidateObject }) => mapCandidateObject(candidateObject))
        .sort((left, right) => compareText(left.id, right.id));
    const stations = collectStations(row);
    const corridorBounds = mapCorridorBounds(row);
    const sourceDocuments = collectSourceDocuments(row);
    const unknowns = stableUnique([
        ...row.evidenceStatements
            .filter(({ kind }) => kind === enums_1.EvidenceKind.LIMITS || kind === enums_1.EvidenceKind.UNKNOWN)
            .map(({ text }) => requireText(text)),
        ...row.unknowns.map(({ text }) => requireText(text)),
    ]);
    const indicator = resolveIndicator(row.incident.indicator, row.measurements.map(({ measurement }) => measurement));
    const result = {
        investigation: {
            id: row.id,
            title: requireText(row.incident.title),
            signalIds: stableUnique(signals.map(({ id }) => id)).sort(compareText),
            indicator,
            evidenceLevel: mapEvidenceLevel(row.evidenceLevel),
            corridor: null,
            supportedFacts: statements.filter(({ kind }) => kind === 'supports'),
            contradictedHypotheses: statements.filter(({ kind }) => kind === 'contradicts'),
            unknowns,
            conclusion: requireText(row.conclusion),
            updatedAt: row.generatedAt.toISOString(),
        },
        region: mapRegion(row.incident.region),
        signals,
        measurements,
        stations,
        candidateObjects,
        sourceDocuments,
        corridorBounds,
    };
    if (!contracts_1.IncidentDetailSchema.safeParse(result).success)
        invalidData();
    return result;
}
function mapSignal(row) {
    return {
        id: row.id,
        title: requireText(row.title),
        observedAt: row.observedAt?.toISOString() ?? null,
        observedPeriod: row.observedPeriod,
        reportedAt: row.reportedAt.toISOString(),
        location: mapLocation(row.latitude, row.longitude),
        locationText: requireText(row.locationText),
        phenomenon: mapPhenomenon(row.phenomenon),
        excerpt: requireText(row.excerpt),
        sourceDocumentId: row.sourceDocumentId,
        extractionMode: mapExtractionMode(row.extractionMode),
        verificationStatus: mapVerificationStatus(row.verificationStatus),
    };
}
function mapMeasurement(row) {
    return {
        id: row.id,
        stationId: row.stationId,
        sampledAt: row.sampledAt?.toISOString() ?? null,
        sampledPeriod: row.sampledPeriod,
        indicator: requireText(row.indicator),
        value: decimalToFiniteNumber(row.value),
        rawValueText: requireText(row.rawValueText),
        unit: mapUnit(row.unit),
        matrix: mapMatrix(row.matrix),
        qualityClass: null,
        sourceDocumentId: row.sourceDocumentId,
        sourcePage: row.sourcePage?.pageNumber ?? metadataSourcePage(row.metadata),
        sourceExcerpt: row.sourceExcerpt,
        verified: row.verificationStatus === enums_1.VerificationStatus.OFFICIAL,
    };
}
function mapStatement(row) {
    const statement = {
        id: row.id,
        code: requireText(row.code),
        sortOrder: row.sortOrder,
        kind: mapEvidenceKind(row.kind),
        text: requireText(row.text),
        measurementIds: stableUnique(row.measurements.map(({ measurementId }) => measurementId)).sort(compareText),
        sourceDocumentIds: stableUnique(row.sources.map(({ sourceDocumentId }) => sourceDocumentId)).sort(compareText),
        generatedBy: mapEvidenceGeneratedBy(row.generatedBy),
    };
    if (statement.kind !== 'unknown' &&
        statement.sourceDocumentIds.length === 0) {
        invalidData();
    }
    return statement;
}
function mapCandidateObject(row) {
    const evidenceDocumentIds = stableUnique(row.sources.map(({ sourceDocumentId }) => sourceDocumentId)).sort(compareText);
    if (evidenceDocumentIds.length === 0)
        invalidData();
    return {
        id: row.id,
        name: requireText(row.name),
        category: requireText(row.objectType),
        location: mapLocation(row.latitude, row.longitude),
        waterBody: metadataString(row.metadata, 'waterBody'),
        riverOrder: metadataNonnegativeInteger(row.metadata, 'riverOrder'),
        evidenceDocumentIds,
        completeness: row.verificationStatus === enums_1.VerificationStatus.OFFICIAL
            ? 'confirmed'
            : 'partial',
    };
}
function mapStation(row) {
    return {
        id: row.id,
        name: requireText(row.name),
        waterBody: requireText(row.waterBody),
        location: mapLocation(row.latitude, row.longitude),
        riverOrder: row.riverOrder,
        relationType: 'neutral',
        relatedObjectId: null,
        locationSourceDocumentId: row.locationSourceDocumentId,
    };
}
function mapSourceDocument(row) {
    return {
        id: row.id,
        title: requireText(row.title),
        publisher: requireText(row.publisher),
        url: row.originalUrl,
        publishedAt: row.publishedAt?.toISOString() ?? null,
        fetchedAt: row.fetchedAt?.toISOString() ?? null,
        contentType: mapMediaType(row.mediaType),
        sha256: row.sha256,
        cachePath: row.cachePath,
        status: mapSourceStatus(row.status),
    };
}
function collectStations(row) {
    const byId = new Map();
    for (const { measurement } of row.measurements) {
        byId.set(measurement.station.id, measurement.station);
    }
    if (row.upstreamStation)
        byId.set(row.upstreamStation.id, row.upstreamStation);
    if (row.downstreamStation) {
        byId.set(row.downstreamStation.id, row.downstreamStation);
    }
    return [...byId.values()]
        .map(mapStation)
        .sort((left, right) => {
        const order = compareNullableOrder(left.riverOrder, right.riverOrder);
        return (order || compareText(left.name, right.name) || compareText(left.id, right.id));
    });
}
function collectSourceDocuments(row) {
    const byId = new Map();
    for (const { signal } of row.incident.signals) {
        byId.set(signal.sourceDocument.id, signal.sourceDocument);
    }
    for (const { measurement } of row.measurements) {
        byId.set(measurement.sourceDocument.id, measurement.sourceDocument);
    }
    for (const statement of row.evidenceStatements) {
        for (const { sourceDocument } of statement.sources) {
            byId.set(sourceDocument.id, sourceDocument);
        }
    }
    for (const { candidateObject } of row.candidateObjects) {
        for (const { sourceDocument } of candidateObject.sources) {
            byId.set(sourceDocument.id, sourceDocument);
        }
    }
    return [...byId.values()]
        .sort((left, right) => compareText(left.id, right.id))
        .map(mapSourceDocument);
}
function mapCorridorBounds(row) {
    switch (row.corridorKind) {
        case enums_1.CorridorKind.NONE:
            if (row.upstreamStationId !== null || row.downstreamStationId !== null) {
                invalidData();
            }
            return null;
        case enums_1.CorridorKind.BETWEEN_STATIONS:
            if (row.upstreamStationId === null ||
                row.downstreamStationId === null ||
                row.upstreamStationId === row.downstreamStationId) {
                invalidData();
            }
            return {
                upstreamStationId: row.upstreamStationId,
                downstreamStationId: row.downstreamStationId,
            };
        case enums_1.CorridorKind.OPEN_UPSTREAM:
            if (row.upstreamStationId !== null || row.downstreamStationId === null) {
                invalidData();
            }
            return {
                upstreamStationId: null,
                downstreamStationId: row.downstreamStationId,
            };
        case enums_1.CorridorKind.OPEN_DOWNSTREAM:
            invalidData();
    }
}
function resolveIndicator(incidentIndicator, measurements) {
    if (incidentIndicator !== null && incidentIndicator.trim().length > 0) {
        return incidentIndicator;
    }
    const indicators = stableUnique(measurements
        .map(({ indicator }) => indicator)
        .filter((indicator) => indicator.trim().length > 0));
    return indicators.length === 1 ? indicators[0] : 'не определён';
}
function resolvePeriod(measurements) {
    const periods = stableUnique(measurements.flatMap(({ sampledAt, sampledPeriod }) => {
        if (sampledPeriod !== null)
            return [sampledPeriod];
        return sampledAt ? [sampledAt.toISOString().slice(0, 7)] : [];
    }));
    return periods.length === 1 ? periods[0] : null;
}
function compareSignals(left, right) {
    return (left.reportedAt.localeCompare(right.reportedAt) ||
        compareText(left.id, right.id));
}
function compareMeasurements(left, right, row) {
    const leftStation = stationForMeasurement(row, left.stationId);
    const rightStation = stationForMeasurement(row, right.stationId);
    return (measurementTimeKey(left).localeCompare(measurementTimeKey(right)) ||
        compareNullableOrder(leftStation.riverOrder, rightStation.riverOrder) ||
        compareText(leftStation.name, rightStation.name) ||
        compareText(left.id, right.id));
}
function stationForMeasurement(row, stationId) {
    const link = row.measurements.find(({ measurement }) => measurement.stationId === stationId);
    if (!link)
        invalidData();
    return link.measurement.station;
}
function measurementTimeKey(measurement) {
    return measurement.sampledPeriod ?? measurement.sampledAt ?? '';
}
function compareNullableOrder(left, right) {
    if (left === null && right === null)
        return 0;
    if (left === null)
        return 1;
    if (right === null)
        return -1;
    return left - right;
}
function compareText(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
function stableUnique(values) {
    return [...new Set(values)];
}
function metadataSourcePage(value) {
    if (!isJsonObject(value) || !Object.hasOwn(value, 'sourcePage'))
        return null;
    const sourcePage = value.sourcePage;
    if (sourcePage === null)
        return null;
    if (typeof sourcePage === 'number' && Number.isInteger(sourcePage) && sourcePage > 0) {
        return sourcePage;
    }
    invalidData();
}
function metadataString(value, key) {
    if (!isJsonObject(value))
        return null;
    const candidate = value[key];
    return typeof candidate === 'string' && candidate.trim().length > 0
        ? candidate
        : null;
}
function metadataNonnegativeInteger(value, key) {
    if (!isJsonObject(value))
        return null;
    const candidate = value[key];
    return typeof candidate === 'number' &&
        Number.isInteger(candidate) &&
        candidate >= 0
        ? candidate
        : null;
}
function isJsonObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function requireText(value) {
    if (value === null || value.trim().length === 0)
        invalidData();
    return value;
}
function decimalToFiniteNumber(value) {
    const parsed = Number(value.toString());
    if (!Number.isFinite(parsed))
        invalidData();
    return parsed;
}
function mapLocation(latitude, longitude) {
    if (latitude === null && longitude === null)
        return null;
    if (latitude === null || longitude === null)
        invalidData();
    const lat = decimalToFiniteNumber(latitude);
    const lon = decimalToFiniteNumber(longitude);
    if (lat < -90 ||
        lat > 90 ||
        lon < -180 ||
        lon > 180 ||
        (lat === 0 && lon === 0)) {
        invalidData();
    }
    return { lat, lon };
}
function mapRegion(value) {
    return value === 'ATYRAU' ? 'atyrau' : 'mangystau';
}
function mapEvidenceLevel(value) {
    switch (value) {
        case enums_1.EvidenceLevel.L0:
            return 'L0';
        case enums_1.EvidenceLevel.L1:
            return 'L1';
        case enums_1.EvidenceLevel.L2:
            return 'L2';
        case enums_1.EvidenceLevel.L3:
            return 'L3';
    }
}
function mapExtractionMode(value) {
    switch (value) {
        case enums_1.ExtractionMode.LLM_VERIFIED:
            return 'llm_verified';
        case enums_1.ExtractionMode.RULE:
            return 'rule';
        case enums_1.ExtractionMode.VERIFIED_SEED:
            return 'verified_seed';
    }
}
function mapVerificationStatus(value) {
    switch (value) {
        case enums_1.VerificationStatus.UNVERIFIED:
            return 'unverified';
        case enums_1.VerificationStatus.CORROBORATED:
            return 'corroborated';
        case enums_1.VerificationStatus.OFFICIAL:
            return 'official';
        case enums_1.VerificationStatus.CONFLICTING:
            return 'conflicting';
    }
}
function mapPhenomenon(value) {
    switch (value) {
        case 'oil_film':
        case 'color_change':
        case 'odor':
        case 'fish_kill':
        case 'wastewater':
        case 'other':
            return value;
        default:
            invalidData();
    }
}
function mapUnit(value) {
    switch (value) {
        case 'mg/dm3':
        case 'mg/kg':
        case 'percent':
            return value;
        default:
            invalidData();
    }
}
function mapMatrix(value) {
    switch (value) {
        case 'water':
        case 'sediment':
            return value;
        default:
            invalidData();
    }
}
function mapEvidenceKind(value) {
    switch (value) {
        case enums_1.EvidenceKind.SUPPORTS:
            return 'supports';
        case enums_1.EvidenceKind.CONTRADICTS:
            return 'contradicts';
        case enums_1.EvidenceKind.LIMITS:
            return 'limits';
        case enums_1.EvidenceKind.UNKNOWN:
            return 'unknown';
    }
}
function mapEvidenceGeneratedBy(value) {
    switch (value) {
        case enums_1.EvidenceGeneratedBy.RULE_ENGINE:
            return 'rule_engine';
        case enums_1.EvidenceGeneratedBy.HUMAN_VERIFIED:
            return 'human_verified';
    }
}
function mapMediaType(value) {
    switch (value.toLowerCase()) {
        case 'application/pdf':
        case 'pdf':
            return 'pdf';
        case 'text/html':
        case 'html':
            return 'html';
        case 'application/json':
        case 'json':
            return 'json';
        default:
            invalidData();
    }
}
function mapSourceStatus(value) {
    switch (value) {
        case enums_1.SourceDocumentStatus.UNVERIFIED:
            return 'unverified';
        case enums_1.SourceDocumentStatus.VERIFIED:
            return 'verified';
        case enums_1.SourceDocumentStatus.UNAVAILABLE:
            return 'unavailable';
    }
}
function invalidData() {
    throw new incidents_errors_1.IncidentDataInvalidError();
}
//# sourceMappingURL=incidents.mapper.js.map