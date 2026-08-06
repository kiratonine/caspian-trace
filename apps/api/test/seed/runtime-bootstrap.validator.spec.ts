import {
    RuntimeBootstrapError,
    type RuntimeBootstrapErrorCode,
} from '../../prisma/seed/runtime-bootstrap.errors'
import {
    loadRuntimeBootstrap,
} from '../../prisma/seed/runtime-bootstrap.loader'
import {
    validateRuntimeBootstrap,
} from '../../prisma/seed/runtime-bootstrap.validator'

describe('runtime bootstrap validator', () => {
    it('validates all three handoff cases', async () => {
        const loaded =
            await loadRuntimeBootstrap()

        const validated =
            validateRuntimeBootstrap(loaded)

        expect(
            validated.cases.map(
                ({ handoff }) =>
                    handoff.incident.id,
            ),
        ).toEqual([
            'inv-atyrau-2025-09',
            'inv-atyrau-2025-05',
            'inv-aktau-insufficient',
        ])

        expect(
            validated.cases.map(
                ({ result }) =>
                    result.evidenceLevel,
            ),
        ).toEqual([
            'L2',
            'L3',
            'L0',
        ])

        expect(
            validated.cases.every(
                ({ result }) =>
                    result.rulesetVersion ===
                    '1.2.1',
            ),
        ).toBe(true)
    })

    it('rejects an invalid investigation input', async () => {
        const loaded =
            await loadRuntimeBootstrap()
        const tampered =
            structuredClone(loaded)

        const input = asRecord(
            tampered.cases[0]!.input,
        )

        delete input.signals

        expectRuntimeBootstrapError(
            () =>
                validateRuntimeBootstrap(
                    tampered,
                ),
            'RUNTIME_BOOTSTRAP_INPUT_INVALID',
        )
    })

    it('rejects a golden result that differs from the ruleset', async () => {
        const loaded =
            await loadRuntimeBootstrap()

        const tampered =
            structuredClone(loaded)

        const targetCase =
            tampered.cases[0]!

        expect(
            targetCase.expectedResult,
        ).not.toBe(
            targetCase.handoff.expectedResult,
        )

        const golden = asRecord(
            targetCase.expectedResult,
        )

        targetCase.expectedResult = {
            ...golden,
            rulesetVersion: '0.0.0',
        }

        expect(
            targetCase.handoff
                .expectedResult.rulesetVersion,
        ).toBe('1.2.1')

        expectRuntimeBootstrapError(
            () =>
                validateRuntimeBootstrap(
                    tampered,
                ),
            'RUNTIME_BOOTSTRAP_GOLDEN_MISMATCH',
        )
    })

    it('rejects IDs that differ between input and handoff', async () => {
        const loaded =
            await loadRuntimeBootstrap()
        const tampered =
            structuredClone(loaded)

        tampered.cases[0]!
            .handoff.measurementIds = []

        expectRuntimeBootstrapError(
            () =>
                validateRuntimeBootstrap(
                    tampered,
                ),
            'RUNTIME_BOOTSTRAP_HANDOFF_MISMATCH',
        )
    })
})

function asRecord(
    value: unknown,
): Record<string, unknown> {
    if (
        typeof value !== 'object' ||
        value === null ||
        Array.isArray(value)
    ) {
        throw new Error(
            'Expected a JSON object',
        )
    }

    return value as Record<
        string,
        unknown
    >
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

        if (error.code !== expectedCode) {
            throw new Error(
                [
                    `Expected code: ${expectedCode}`,
                    `Received code: ${error.code}`,
                    `Original message: ${error.message}`,
                    `Original stack: ${error.stack ?? 'unavailable'}`,
                ].join('\n'),
                { cause: error },
            )
        }

        return
    }

    throw new Error(
        `Expected RuntimeBootstrapError with code ${expectedCode}`,
    )
}