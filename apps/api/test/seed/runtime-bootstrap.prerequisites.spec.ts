import type {
    Prisma,
} from '../../src/generated/prisma/client'
import {
    StationRelationKind,
    VerificationStatus,
} from '../../src/generated/prisma/enums'
import {
    RuntimeBootstrapError,
    type RuntimeBootstrapErrorCode,
} from '../../prisma/seed/runtime-bootstrap.errors'
import {
    loadRuntimeBootstrap,
} from '../../prisma/seed/runtime-bootstrap.loader'
import {
    buildRuntimeBootstrapPlan,
    type RuntimeBootstrapPlan,
} from '../../prisma/seed/runtime-bootstrap.plan'
import {
    verifyRuntimeBootstrapPrerequisites,
} from '../../prisma/seed/runtime-bootstrap.prerequisites'
import {
    validateRuntimeBootstrap,
    type ValidatedRuntimeBootstrap,
} from '../../prisma/seed/runtime-bootstrap.validator'

interface FakePrerequisiteRows {
    sourceDocuments: Array<{
        id: string
        originalUrl: string
        canonicalUrl: string
        publisher: string
        mediaType: string
        sha256: string | null
    }>
    stations: Array<{
        id: string
    }>
    stationRelations: Array<{
        id: string
        kind: typeof StationRelationKind.UPSTREAM_OF
        verificationStatus:
        typeof VerificationStatus.OFFICIAL
    }>
    relationEvidence: Array<{
        id: string
        stationRelationId: string
        sourceDocumentId: string
        sourcePage: number | null
        verificationStatus:
        typeof VerificationStatus.OFFICIAL
    }>
    measurements: Array<{
        id: string
        verificationStatus:
        typeof VerificationStatus.OFFICIAL
    }>
}

describe(
    'runtime bootstrap prerequisites',
    () => {
        let validated:
            ValidatedRuntimeBootstrap
        let plan: RuntimeBootstrapPlan
        let rows: FakePrerequisiteRows

        beforeAll(async () => {
            const loaded =
                await loadRuntimeBootstrap()

            validated =
                validateRuntimeBootstrap(
                    loaded,
                )

            plan =
                buildRuntimeBootstrapPlan(
                    validated,
                )

            rows = buildFakeRows(
                validated,
                plan,
            )
        })

        it('accepts complete official verified data', async () => {
            const summary =
                await verifyRuntimeBootstrapPrerequisites(
                    fakeTransaction(
                        structuredClone(rows),
                    ),
                    plan,
                )

            expect(summary).toEqual({
                sourceDocuments: 2,
                stations: 4,
                stationRelations: 3,
                stationRelationEvidence: 4,
                measurements: 6,
            })
        })

        it('rejects a missing verified measurement', async () => {
            const tampered =
                structuredClone(rows)

            tampered.measurements.pop()

            await expectRuntimeBootstrapError(
                () =>
                    verifyRuntimeBootstrapPrerequisites(
                        fakeTransaction(tampered),
                        plan,
                    ),
                'RUNTIME_BOOTSTRAP_PREREQUISITE_MISSING',
            )
        })

        it('rejects relation evidence linked to another edge', async () => {
            const tampered =
                structuredClone(rows)

            tampered.relationEvidence[0]!
                .stationRelationId =
                'station-relation:wrong-edge'

            await expectRuntimeBootstrapError(
                () =>
                    verifyRuntimeBootstrapPrerequisites(
                        fakeTransaction(tampered),
                        plan,
                    ),
                'RUNTIME_BOOTSTRAP_PREREQUISITE_CONFLICT',
            )
        })

        it('rejects a conflicting verified source URL', async () => {
            const tampered =
                structuredClone(rows)

            tampered.sourceDocuments[0]!
                .originalUrl =
                'https://example.invalid/conflict.pdf'

            await expectRuntimeBootstrapError(
                () =>
                    verifyRuntimeBootstrapPrerequisites(
                        fakeTransaction(tampered),
                        plan,
                    ),
                'RUNTIME_BOOTSTRAP_PREREQUISITE_CONFLICT',
            )
        })
    },
)

function buildFakeRows(
    validated: ValidatedRuntimeBootstrap,
    plan: RuntimeBootstrapPlan,
): FakePrerequisiteRows {
    const officialSources =
        plan.sourceDocuments
            .filter(({ id }) =>
                plan.requiredVerifiedData
                    .sourceDocumentIds.includes(id),
            )
            .map((source) => ({
                id: source.id,
                originalUrl: source.url,
                canonicalUrl: source.url,
                publisher: source.publisher,
                mediaType:
                    source.contentType === 'pdf'
                        ? 'application/pdf'
                        : source.contentType ===
                            'json'
                            ? 'application/json'
                            : 'text/html',
                sha256: source.sha256,
            }))

    const evidenceById = new Map<
        string,
        FakePrerequisiteRows[
        'relationEvidence'
        ][number]
    >()

    for (
        const validatedCase
        of validated.cases
    ) {
        const {
            handoff,
            input,
        } = validatedCase

        for (
            const [index, relation]
            of input.stationRelations
                .entries()
        ) {
            const stationRelationId =
                handoff.stationRelationIds[
                index
                ]

            if (
                stationRelationId ===
                undefined
            ) {
                throw new Error(
                    `Missing canonical relation ID for ${relation.id}`,
                )
            }

            evidenceById.set(
                relation.id,
                {
                    id: relation.id,
                    stationRelationId,
                    sourceDocumentId:
                        relation.sourceDocumentId,
                    sourcePage:
                        relation.provenance
                            .sourcePage,
                    verificationStatus:
                        VerificationStatus.OFFICIAL,
                },
            )
        }
    }

    return {
        sourceDocuments:
            officialSources,
        stations:
            plan.requiredVerifiedData
                .stationIds
                .map((id) => ({ id })),
        stationRelations:
            plan.requiredVerifiedData
                .stationRelationIds
                .map((id) => ({
                    id,
                    kind:
                        StationRelationKind.UPSTREAM_OF,
                    verificationStatus:
                        VerificationStatus.OFFICIAL,
                })),
        relationEvidence: [
            ...evidenceById.values(),
        ].sort(
            (left, right) =>
                left.id.localeCompare(
                    right.id,
                ),
        ),
        measurements:
            plan.requiredVerifiedData
                .measurementIds
                .map((id) => ({
                    id,
                    verificationStatus:
                        VerificationStatus.OFFICIAL,
                })),
    }
}

function fakeTransaction(
    rows: FakePrerequisiteRows,
): Prisma.TransactionClient {
    return {
        sourceDocument: {
            findMany: () =>
                Promise.resolve(
                    structuredClone(
                        rows.sourceDocuments,
                    ),
                ),
        },
        station: {
            findMany: () =>
                Promise.resolve(
                    structuredClone(
                        rows.stations,
                    ),
                ),
        },
        stationRelation: {
            findMany: () =>
                Promise.resolve(
                    structuredClone(
                        rows.stationRelations,
                    ),
                ),
        },
        stationRelationEvidence: {
            findMany: () =>
                Promise.resolve(
                    structuredClone(
                        rows.relationEvidence,
                    ),
                ),
        },
        measurement: {
            findMany: () =>
                Promise.resolve(
                    structuredClone(
                        rows.measurements,
                    ),
                ),
        },
    } as unknown as Prisma.TransactionClient
}

async function expectRuntimeBootstrapError(
    operation: () => Promise<unknown>,
    expectedCode:
        RuntimeBootstrapErrorCode,
): Promise<void> {
    try {
        await operation()
    } catch (error: unknown) {
        expect(error).toBeInstanceOf(
            RuntimeBootstrapError,
        )

        if (
            !(
                error instanceof
                RuntimeBootstrapError
            )
        ) {
            throw error
        }

        expect(error.code).toBe(
            expectedCode,
        )

        return
    }

    throw new Error(
        `Expected RuntimeBootstrapError with code ${expectedCode}`,
    )
}