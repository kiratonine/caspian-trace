import {
    runInvestigation,
    type InvestigationInput,
    type InvestigationResult,
} from '@caspian-trace/investigation-core'

import { parseInvestigationInput } from '../../src/investigations/investigation-input.schema'
import { RuntimeBootstrapError } from './runtime-bootstrap.errors'
import type {
    LoadedRuntimeBootstrap,
    LoadedRuntimeBootstrapCase,
    RuntimeBootstrapCase,
} from './runtime-bootstrap.types'

export interface ValidatedRuntimeBootstrapCase {
    handoff: RuntimeBootstrapCase
    input: InvestigationInput
    result: InvestigationResult
}

export interface ValidatedRuntimeBootstrap {
    cases: ValidatedRuntimeBootstrapCase[]
}

export function validateRuntimeBootstrap(
    loaded: LoadedRuntimeBootstrap,
): ValidatedRuntimeBootstrap {
    return {
        cases: loaded.cases.map(validateRuntimeBootstrapCase),
    }
}

function validateRuntimeBootstrapCase(
    loadedCase: LoadedRuntimeBootstrapCase,
): ValidatedRuntimeBootstrapCase {
    const input = parseInput(loadedCase)

    validateInputAgainstHandoff(
        loadedCase.handoff,
        input,
    )

    const result = runInvestigation(input)

    validateResultAgainstGolden(
        loadedCase,
        result,
    )

    validateResultAgainstHandoff(
        loadedCase.handoff,
        result,
    )

    return {
        handoff: loadedCase.handoff,
        input,
        result,
    }
}

function parseInput(
    loadedCase: LoadedRuntimeBootstrapCase,
): InvestigationInput {
    try {
        return parseInvestigationInput(
            loadedCase.input,
        )
    } catch (error: unknown) {
        throw new RuntimeBootstrapError(
            'RUNTIME_BOOTSTRAP_INPUT_INVALID',
            `Runtime bootstrap input is invalid: ${loadedCase.handoff.incident.id}`,
            { cause: error },
        )
    }
}

function validateResultAgainstGolden(
    loadedCase: LoadedRuntimeBootstrapCase,
    result: InvestigationResult,
): void {
    const goldenResult =
        loadedCase.expectedResult

    if (
        isJsonStructurallyEqual(
            result,
            goldenResult,
        )
    ) {
        return
    }

    throw new RuntimeBootstrapError(
        'RUNTIME_BOOTSTRAP_GOLDEN_MISMATCH',
        [
            'Runtime bootstrap golden result',
            'does not match current ruleset:',
            loadedCase.handoff.incident.id,
        ].join(' '),
    )
}

function validateResultAgainstHandoff(
    handoff: RuntimeBootstrapCase,
    result: InvestigationResult,
): void {
    assertHandoffEqual(
        expectedResultSummary(result),
        handoff.expectedResult,
        handoff.incident.id,
        'expected result summary',
    )
}

function validateInputAgainstHandoff(
    handoff: RuntimeBootstrapCase,
    input: InvestigationInput,
): void {
    const incidentId = handoff.incident.id

    assertHandoffEqual(
        {
            id: input.incident.id,
            title: input.incident.title,
            region: input.incident.region,
            indicator: input.incident.indicator,
        },
        handoff.incident,
        incidentId,
        'incident',
    )

    assertHandoffEqual(
        input.signals.map(({ id }) => id),
        handoff.signalIds,
        incidentId,
        'signal IDs',
    )

    assertHandoffEqual(
        input.stations.map(({ id }) => id),
        handoff.stationIds,
        incidentId,
        'station IDs',
    )

    assertHandoffEqual(
        input.stationRelations.map(({ id }) => id),
        handoff.stationRelationEvidenceIds,
        incidentId,
        'station relation evidence IDs',
    )

    assertHandoffEqual(
        input.stationRelations.map(
            canonicalRelationId,
        ),
        handoff.stationRelationIds,
        incidentId,
        'station relation IDs',
    )

    assertHandoffEqual(
        input.stationRelations
            .filter(({ comparisonPair }) => comparisonPair)
            .map(canonicalRelationId),
        handoff.comparisonPairRelationIds,
        incidentId,
        'comparison pair relation IDs',
    )

    assertHandoffEqual(
        input.measurements.map(({ id }) => id),
        handoff.measurementIds,
        incidentId,
        'measurement IDs',
    )

    assertHandoffEqual(
        input.candidateObjects.map(({ id }) => id),
        handoff.candidateObjectIds,
        incidentId,
        'candidate object IDs',
    )

    assertHandoffEqual(
        input.sourceDocuments.map(({ id }) => id),
        handoff.sourceDocumentIds,
        incidentId,
        'source document IDs',
    )

    assertHandoffEqual(
        input.incident.unknowns ?? [],
        handoff.unknowns,
        incidentId,
        'incident unknowns',
    )

    validateSignalProvenance(
        handoff,
        input,
    )

    if (
        handoff.signalIds.length === 0 &&
        handoff.signalAbsenceReason === undefined
    ) {
        throw handoffMismatch(
            incidentId,
            'signal absence reason',
        )
    }
}

function validateSignalProvenance(
    handoff: RuntimeBootstrapCase,
    input: InvestigationInput,
): void {
    const expected =
        handoff.signalProvenance.map(
            ({
                signalId,
                sourceDocumentId,
                url,
                reportedAt,
                excerpt,
            }) => ({
                signalId,
                sourceDocumentId,
                url,
                reportedAt,
                excerpt,
            }),
        )

    const actual = input.signals.map(
        (signal) => {
            const source =
                input.sourceDocuments.find(
                    ({ id }) =>
                        id === signal.sourceDocumentId,
                )

            if (source === undefined) {
                throw handoffMismatch(
                    handoff.incident.id,
                    `source for signal ${signal.id}`,
                )
            }

            return {
                signalId: signal.id,
                sourceDocumentId:
                    signal.sourceDocumentId,
                url: source.url,
                reportedAt: signal.reportedAt,
                excerpt: signal.excerpt,
            }
        },
    )

    assertHandoffEqual(
        actual,
        expected,
        handoff.incident.id,
        'signal provenance',
    )
}

function expectedResultSummary(
    result: InvestigationResult,
): RuntimeBootstrapCase['expectedResult'] {
    const objectDispositions: Record<
        string,
        string
    > = {}

    for (
        const disposition
        of result.objectDispositions
    ) {
        objectDispositions[
            disposition.objectId
        ] = disposition.disposition
    }

    return {
        evidenceLevel: result.evidenceLevel,
        corridorKind:
            result.corridorBounds === null
                ? 'none'
                : result.corridorBounds
                    .upstreamStationId === null
                    ? 'open_upstream'
                    : 'between_stations',
        upstreamStationId:
            result.corridorBounds
                ?.upstreamStationId ?? null,
        downstreamStationId:
            result.corridorBounds
                ?.downstreamStationId ?? null,
        supportedFactCodes:
            result.supportedFacts.map(
                ({ code }) => code,
            ),
        contradictedHypothesisCodes:
            result.contradictedHypotheses.map(
                ({ code }) => code,
            ),
        objectDispositions,
        unknownCodes: result.unknowns.map(
            ({ code }) => code,
        ),
        conclusion: result.conclusion,
        fixtureInputHash: result.inputHash,
        rulesetVersion:
            result.rulesetVersion,
    }
}

function canonicalRelationId(
    relation: {
        upstreamStationId: string
        downstreamStationId: string
    },
): string {
    return [
        'station-relation',
        relation.upstreamStationId,
        relation.downstreamStationId,
        'upstream-of',
    ].join(':')
}

function assertHandoffEqual(
    actual: unknown,
    expected: unknown,
    incidentId: string,
    field: string,
): void {
    if (
        isJsonStructurallyEqual(
            actual,
            expected,
        )
    ) {
        return
    }

    throw handoffMismatch(
        incidentId,
        field,
    )
}

function isJsonStructurallyEqual(
    actual: unknown,
    expected: unknown,
): boolean {
    return (
        canonicalJson(actual) ===
        canonicalJson(expected)
    )
}

function canonicalJson(
    value: unknown,
): string {
    if (value === null) {
        return 'null'
    }

    if (
        typeof value === 'string' ||
        typeof value === 'boolean'
    ) {
        return serializeJsonScalar(value)
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new TypeError(
                'Runtime bootstrap comparison received a non-finite number',
            )
        }

        return serializeJsonScalar(value)
    }

    if (Array.isArray(value)) {
        return [
            '[',
            value
                .map((item) =>
                    canonicalJson(item),
                )
                .join(','),
            ']',
        ].join('')
    }

    if (typeof value === 'object') {
        const entries = Object.entries(
            value as Record<
                string,
                unknown
            >,
        ).sort(
            ([leftKey], [rightKey]) =>
                compareKeys(
                    leftKey,
                    rightKey,
                ),
        )

        return [
            '{',
            entries
                .map(
                    ([key, item]) =>
                        [
                            serializeJsonScalar(
                                key,
                            ),
                            ':',
                            canonicalJson(
                                item,
                            ),
                        ].join(''),
                )
                .join(','),
            '}',
        ].join('')
    }

    throw new TypeError(
        [
            'Runtime bootstrap comparison',
            'requires JSON-compatible values;',
            `received ${typeof value}`,
        ].join(' '),
    )
}

function serializeJsonScalar(
    value: string | number | boolean,
): string {
    const serialized =
        JSON.stringify(value)

    if (serialized === undefined) {
        throw new TypeError(
            'Unable to serialize runtime bootstrap value',
        )
    }

    return serialized
}

function compareKeys(
    left: string,
    right: string,
): number {
    if (left < right) {
        return -1
    }

    if (left > right) {
        return 1
    }

    return 0
}

function handoffMismatch(
    incidentId: string,
    field: string,
): RuntimeBootstrapError {
    return new RuntimeBootstrapError(
        'RUNTIME_BOOTSTRAP_HANDOFF_MISMATCH',
        `Runtime bootstrap handoff mismatch for ${incidentId}: ${field}`,
    )
}