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
    validateRuntimeBootstrap,
} from '../../prisma/seed/runtime-bootstrap.validator'

describe('runtime bootstrap persistence plan', () => {
    let plan: RuntimeBootstrapPlan

    beforeAll(async () => {
        const loaded =
            await loadRuntimeBootstrap()

        const validated =
            validateRuntimeBootstrap(loaded)

        plan =
            buildRuntimeBootstrapPlan(
                validated,
            )
    })

    it('uses canonical database relation IDs in incident scopes', () => {
        const september = requiredById(
            plan.incidents,
            'inv-atyrau-2025-09',
        )

        expect(
            september.metadata
                .stationRelationIds,
        ).toEqual([
            'station-relation:st-zhaiyk-1km-above-atyrau:st-asa-0-5km-above:upstream-of',
            'station-relation:st-asa-0-5km-above:st-asa-0-5km-below:upstream-of',
            'station-relation:st-asa-0-5km-below:st-zhaiyk-1km-below-atyrau:upstream-of',
        ])

        expect(
            september.metadata
                .stationRelationIds,
        ).not.toContain(
            'rel-sep-asa-pair',
        )

        expect(
            september.metadata
                .runtimeBootstrap
                .stationRelationEvidenceIds,
        ).toContain(
            'rel-sep-asa-pair',
        )
    })

    it('preserves explicit empty Aktau scopes and unknowns', () => {
        const aktau = requiredById(
            plan.incidents,
            'inv-aktau-insufficient',
        )

        expect(
            aktau.metadata.stationIds,
        ).toEqual([])

        expect(
            aktau.metadata
                .runtimeBootstrap
                .measurementFacts,
        ).toEqual([])

        expect(
            aktau.metadata
                .stationRelationIds,
        ).toEqual([])

        expect(
            aktau.metadata.measurementIds,
        ).toEqual([])

        expect(
            aktau.metadata
                .candidateObjectIds,
        ).toEqual([])

        expect(
            aktau.metadata.sourceDocumentIds,
        ).toEqual([])

        expect(
            aktau.metadata.unknowns.map(
                ({ code }) => code,
            ),
        ).toEqual([
            'CURRENT_FIELD_UNAVAILABLE',
            'SYNCHRONOUS_MEASUREMENTS_UNAVAILABLE',
        ])
        expect(
            aktau.metadata
                .runtimeBootstrap
                .stationRelationFacts,
        ).toEqual([])

        expect(
            aktau.metadata
                .runtimeBootstrap
                .candidateObjectFacts,
        ).toEqual([])
    })

    it('preserves exact per-incident measurement facts', async () => {
        const loaded =
            await loadRuntimeBootstrap()

        const validated =
            validateRuntimeBootstrap(loaded)

        for (
            const validatedCase
            of validated.cases
        ) {
            const incident =
                requiredById(
                    plan.incidents,
                    validatedCase.input.incident.id,
                )

            expect(
                incident.metadata
                    .runtimeBootstrap
                    .measurementFacts,
            ).toEqual(
                validatedCase.input.measurements,
            )
        }
    })

    it('keeps the exact scoped May measurement excerpts', () => {
        const may =
            requiredById(
                plan.incidents,
                'inv-atyrau-2025-05',
            )

        expect(
            may.metadata
                .runtimeBootstrap
                .measurementFacts
                .map(
                    ({
                        id,
                        sourceExcerpt,
                    }) => ({
                        id,
                        sourceExcerpt,
                    }),
                ),
        ).toEqual([
            {
                id:
                    'm-2025-05-asa-above',
                sourceExcerpt:
                    'Нефтепродукты – 0,114 мг/дм3',
            },
            {
                id:
                    'm-2025-05-asa-below',
                sourceExcerpt:
                    'Нефтепродукты – 0,193 мг/дм3',
            },
        ])
    })

    it('merges both official source links for the shared candidate', () => {
        const candidate = requiredById(
            plan.candidateObjects,
            'obj-atyrau-su-arnasy',
        )

        expect(
            candidate.evidenceDocumentIds,
        ).toEqual([
            'doc-kazhydromet-2025-05',
            'doc-kazhydromet-2025-09',
        ])

        expect(
            candidate.incidentIds,
        ).toEqual([
            'inv-atyrau-2025-05',
            'inv-atyrau-2025-09',
        ])

        expect(
            plan.candidateSources,
        ).toEqual([
            {
                candidateObjectId:
                    'obj-atyrau-su-arnasy',
                sourceDocumentId:
                    'doc-kazhydromet-2025-05',
            },
            {
                candidateObjectId:
                    'obj-atyrau-su-arnasy',
                sourceDocumentId:
                    'doc-kazhydromet-2025-09',
            },
        ])
    })

    it('marks only the official above-below relation as comparison pair', () => {
        expect(
            plan.relations,
        ).toHaveLength(3)

        const pair = requiredById(
            plan.relations,
            'station-relation:st-asa-0-5km-above:st-asa-0-5km-below:upstream-of',
        )

        expect(
            pair.comparisonPair,
        ).toBe(true)

        expect(
            pair.evidenceIds,
        ).toEqual([
            'rel-may-asa-pair',
            'rel-sep-asa-pair',
        ])

        expect(
            plan.relations
                .filter(
                    ({ comparisonPair }) =>
                        comparisonPair,
                )
                .map(({ id }) => id),
        ).toEqual([
            'station-relation:st-asa-0-5km-above:st-asa-0-5km-below:upstream-of',
        ])
    })

    it('keeps checked provenance for the only supplied signal', () => {
        const signal = requiredById(
            plan.signals,
            'sig-zakon-green-water',
        )

        expect(signal).toMatchObject({
            sourceDocumentId:
                'doc-zakon-green-water',
            checkedAt: '2026-08-06',
            provenanceStatus:
                'published_page_checked',
            incidentIds: [
                'inv-atyrau-2025-09',
            ],
        })

        expect(plan.signalLinks).toEqual([
            {
                incidentId:
                    'inv-atyrau-2025-09',
                signalId:
                    'sig-zakon-green-water',
            },
        ])
    })

    it('distinguishes official verified fixtures from the media source', () => {
        const may = requiredById(
            plan.sourceDocuments,
            'doc-kazhydromet-2025-05',
        )

        const september = requiredById(
            plan.sourceDocuments,
            'doc-kazhydromet-2025-09',
        )

        const zakon = requiredById(
            plan.sourceDocuments,
            'doc-zakon-green-water',
        )

        expect(may).toMatchObject({
            official: true,
            verified: true,
            contentType: 'pdf',
        })

        expect(september).toMatchObject({
            official: true,
            verified: true,
            contentType: 'pdf',
        })

        expect(zakon).toMatchObject({
            official: false,
            verified: true,
            contentType: 'html',
            sha256: null,
            cachePath: null,
        })

        expect(
            plan.requiredVerifiedData
                .sourceDocumentIds,
        ).toEqual([
            'doc-kazhydromet-2025-05',
            'doc-kazhydromet-2025-09',
        ])
    })

    it('rejects conflicting duplicate candidate definitions', async () => {
        const loaded =
            await loadRuntimeBootstrap()

        const validated =
            validateRuntimeBootstrap(loaded)

        const tampered =
            structuredClone(validated)

        const mayCase =
            tampered.cases.find(
                ({ handoff }) =>
                    handoff.incident.id ===
                    'inv-atyrau-2025-05',
            )

        const candidate =
            mayCase?.input
                .candidateObjects[0]

        if (candidate === undefined) {
            throw new Error(
                'Missing May candidate',
            )
        }

        candidate.name =
            'Конфликтующее название'

        expectRuntimeBootstrapError(
            () =>
                buildRuntimeBootstrapPlan(
                    tampered,
                ),
            'RUNTIME_BOOTSTRAP_PLAN_CONFLICT',
        )
    })

    it('keeps per-incident evidence for the shared canonical relation', () => {
        const september = requiredById(
            plan.incidents,
            'inv-atyrau-2025-09',
        )

        const may = requiredById(
            plan.incidents,
            'inv-atyrau-2025-05',
        )

        const sharedRelationId =
            'station-relation:' +
            'st-asa-0-5km-above:' +
            'st-asa-0-5km-below:' +
            'upstream-of'

        const septemberFact =
            september.metadata
                .runtimeBootstrap
                .stationRelationFacts
                .find(
                    ({ relationId }) =>
                        relationId ===
                        sharedRelationId,
                )

        const mayFact =
            may.metadata
                .runtimeBootstrap
                .stationRelationFacts
                .find(
                    ({ relationId }) =>
                        relationId ===
                        sharedRelationId,
                )

        expect(septemberFact).toEqual({
            relationId:
                sharedRelationId,
            evidenceId:
                'rel-sep-asa-pair',
            sourceDocumentId:
                'doc-kazhydromet-2025-09',
            basis:
                'Официальная парная маркировка выше/ниже одного сброса',
            comparisonPair: true,
            provenance: {
                fixturePath:
                    'data/verified/atyrau-2025-09-station-relations.json',
                sourcePage: 22,
                sourceExcerpt:
                    'Официальная парная маркировка: 0,5 км выше и 0,5 км ниже одного сброса КГП «Атырау су арнасы».',
            },
        })

        expect(mayFact).toEqual({
            relationId:
                sharedRelationId,
            evidenceId:
                'rel-may-asa-pair',
            sourceDocumentId:
                'doc-kazhydromet-2025-05',
            basis:
                'Официальная парная маркировка выше/ниже одного сброса',
            comparisonPair: true,
            provenance: {
                fixturePath:
                    'data/verified/atyrau-2025-05-station-relations.json',
                sourcePage: 24,
                sourceExcerpt:
                    'Официальная парная маркировка: 0,5 км выше и 0,5 км ниже одного сброса КГП «Атырау су арнасы».',
            },
        })
    })

    it('keeps candidate source links scoped to each incident', () => {
        const september = requiredById(
            plan.incidents,
            'inv-atyrau-2025-09',
        )

        const may = requiredById(
            plan.incidents,
            'inv-atyrau-2025-05',
        )

        expect(
            september.metadata
                .runtimeBootstrap
                .candidateObjectFacts,
        ).toEqual([
            {
                candidateObjectId:
                    'obj-atyrau-su-arnasy',
                evidenceDocumentIds: [
                    'doc-kazhydromet-2025-09',
                ],
            },
        ])

        expect(
            may.metadata
                .runtimeBootstrap
                .candidateObjectFacts,
        ).toEqual([
            {
                candidateObjectId:
                    'obj-atyrau-su-arnasy',
                evidenceDocumentIds: [
                    'doc-kazhydromet-2025-05',
                ],
            },
        ])
    })
})

function requiredById<
    T extends { id: string },
>(
    items: readonly T[],
    id: string,
): T {
    const item = items.find(
        (candidate) =>
            candidate.id === id,
    )

    if (item === undefined) {
        throw new Error(
            `Missing test entity: ${id}`,
        )
    }

    return item
}

function expectRuntimeBootstrapError(
    operation: () => unknown,
    expectedCode:
        RuntimeBootstrapErrorCode,
): void {
    try {
        operation()
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