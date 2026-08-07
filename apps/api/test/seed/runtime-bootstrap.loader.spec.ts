import {
    loadRuntimeBootstrap,
    parseRuntimeBootstrapManifest,
    safeRepositoryPath,
} from '../../prisma/seed/runtime-bootstrap.loader'
import {
    RuntimeBootstrapError,
    type RuntimeBootstrapErrorCode,
} from '../../prisma/seed/runtime-bootstrap.errors'

describe('runtime bootstrap loader', () => {
    it('loads all three checked handoff cases', async () => {
        const loaded = await loadRuntimeBootstrap()

        expect(
            loaded.cases.map(
                ({ handoff }) => handoff.incident.id,
            ),
        ).toEqual([
            'inv-atyrau-2025-09',
            'inv-atyrau-2025-05',
            'inv-aktau-insufficient',
        ])

        expect(
            loaded.cases.every(
                ({ input, expectedResult }) =>
                    typeof input === 'object' &&
                    input !== null &&
                    typeof expectedResult === 'object' &&
                    expectedResult !== null,
            ),
        ).toBe(true)
    })

    it('rejects a duplicate incident ID', async () => {
        const loaded = await loadRuntimeBootstrap()
        const manifest = structuredClone(
            loaded.manifest,
        )

        manifest.cases[1]!.incident.id =
            manifest.cases[0]!.incident.id

        expectRuntimeBootstrapError(
            () => parseRuntimeBootstrapManifest(manifest),
            'RUNTIME_BOOTSTRAP_DUPLICATE_INCIDENT',
        )
    })

    it('rejects a path outside the repository', () => {
        expectRuntimeBootstrapError(
            () =>
                safeRepositoryPath(
                    '/tmp/caspian-trace',
                    '../secret.json',
                ),
            'RUNTIME_BOOTSTRAP_PATH_INVALID',
        )
    })

    it('rejects an absolute path', () => {
        expectRuntimeBootstrapError(
            () =>
                safeRepositoryPath(
                    '/tmp/caspian-trace',
                    '/etc/passwd',
                ),
            'RUNTIME_BOOTSTRAP_PATH_INVALID',
        )
    })

    it('rejects malformed manifest data', () => {
        expectRuntimeBootstrapError(
            () =>
                parseRuntimeBootstrapManifest({
                    version: 1,
                    purpose: '',
                    cases: [],
                }),
            'RUNTIME_BOOTSTRAP_MANIFEST_INVALID',
        )
    })
})

function expectRuntimeBootstrapError(
    operation: () => unknown,
    expectedCode: RuntimeBootstrapErrorCode,
): void {
    try {
        operation()
    } catch (error: unknown) {
        expect(error).toBeInstanceOf(
            RuntimeBootstrapError,
        )

        if (!(error instanceof RuntimeBootstrapError)) {
            throw error
        }

        expect(error.code).toBe(expectedCode)
        return
    }

    throw new Error(
        `Expected RuntimeBootstrapError with code ${expectedCode}`,
    )
}