import { readFile } from 'node:fs/promises'
import {
    isAbsolute,
    relative,
    resolve,
} from 'node:path'

import { z } from 'zod'

import {
    RuntimeBootstrapError,
} from './runtime-bootstrap.errors'
import {
    RuntimeBootstrapManifestSchema,
    type LoadedRuntimeBootstrap,
    type RuntimeBootstrapManifest,
} from './runtime-bootstrap.types'

const defaultRepositoryRoot = resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
)

const manifestRelativePath =
    'data/fixtures/investigation/' +
    'runtime-bootstrap-handoff.json'

interface LoaderOptions {
    repositoryRoot?: string
}

export async function loadRuntimeBootstrap(
    options: LoaderOptions = {},
): Promise<LoadedRuntimeBootstrap> {
    const repositoryRoot =
        options.repositoryRoot ?? defaultRepositoryRoot

    const manifestPath = safeRepositoryPath(
        repositoryRoot,
        manifestRelativePath,
    )

    const manifest = await readJson(
        manifestPath,
        'manifest',
    )

    const parsedManifest =
        parseRuntimeBootstrapManifest(manifest)

    const cases = await Promise.all(
        parsedManifest.cases.map(
            async (handoff) => ({
                handoff,
                input: await readJson(
                    safeRepositoryPath(
                        repositoryRoot,
                        handoff.inputPath,
                    ),
                    handoff.inputPath,
                ),
                expectedResult: await readJson(
                    safeRepositoryPath(
                        repositoryRoot,
                        handoff.expectedResultPath,
                    ),
                    handoff.expectedResultPath,
                ),
            }),
        ),
    )

    return {
        manifest: parsedManifest,
        cases,
    }
}

export function parseRuntimeBootstrapManifest(
    value: unknown,
): RuntimeBootstrapManifest {
    const parsed =
        RuntimeBootstrapManifestSchema.safeParse(value)

    if (!parsed.success) {
        throw new RuntimeBootstrapError(
            'RUNTIME_BOOTSTRAP_MANIFEST_INVALID',
            formatZodError(parsed.error),
        )
    }

    assertUniqueCaseValues(parsed.data)

    return parsed.data
}

export function safeRepositoryPath(
    repositoryRoot: string,
    relativePath: string,
): string {
    if (isAbsolute(relativePath)) {
        throw invalidPath(relativePath)
    }

    const resolvedRoot = resolve(repositoryRoot)
    const resolvedPath = resolve(
        resolvedRoot,
        relativePath,
    )

    const pathFromRoot = relative(
        resolvedRoot,
        resolvedPath,
    )

    if (
        pathFromRoot === '' ||
        pathFromRoot === '..' ||
        pathFromRoot.startsWith(`..${separator()}`) ||
        isAbsolute(pathFromRoot)
    ) {
        throw invalidPath(relativePath)
    }

    return resolvedPath
}

async function readJson(
    path: string,
    label: string,
): Promise<unknown> {
    let source: string

    try {
        source = await readFile(path, 'utf8')
    } catch (error: unknown) {
        throw new RuntimeBootstrapError(
            'RUNTIME_BOOTSTRAP_FILE_INVALID',
            `Unable to read runtime bootstrap file: ${label}`,
            { cause: error },
        )
    }

    try {
        return JSON.parse(source) as unknown
    } catch (error: unknown) {
        throw new RuntimeBootstrapError(
            'RUNTIME_BOOTSTRAP_FILE_INVALID',
            `Invalid JSON in runtime bootstrap file: ${label}`,
            { cause: error },
        )
    }
}

function assertUniqueCaseValues(
    manifest: RuntimeBootstrapManifest,
): void {
    assertUnique(
        manifest.cases.map(({ incident }) => incident.id),
        'incident ID',
    )

    assertUnique(
        manifest.cases.map(({ inputPath }) => inputPath),
        'input path',
    )

    assertUnique(
        manifest.cases.map(
            ({ expectedResultPath }) =>
                expectedResultPath,
        ),
        'expected result path',
    )

    for (const handoff of manifest.cases) {
        assertUnique(
            handoff.signalIds,
            `${handoff.incident.id} signal ID`,
        )
        assertUnique(
            handoff.stationIds,
            `${handoff.incident.id} station ID`,
        )
        assertUnique(
            handoff.stationRelationIds,
            `${handoff.incident.id} relation ID`,
        )
        assertUnique(
            handoff.measurementIds,
            `${handoff.incident.id} measurement ID`,
        )
        assertUnique(
            handoff.candidateObjectIds,
            `${handoff.incident.id} candidate ID`,
        )
        assertUnique(
            handoff.sourceDocumentIds,
            `${handoff.incident.id} source ID`,
        )
    }
}

function assertUnique(
    values: readonly string[],
    label: string,
): void {
    if (new Set(values).size === values.length) {
        return
    }

    throw new RuntimeBootstrapError(
        'RUNTIME_BOOTSTRAP_DUPLICATE_INCIDENT',
        `Duplicate runtime bootstrap ${label}`,
    )
}

function invalidPath(
    path: string,
): RuntimeBootstrapError {
    return new RuntimeBootstrapError(
        'RUNTIME_BOOTSTRAP_PATH_INVALID',
        `Unsafe runtime bootstrap path: ${path}`,
    )
}

function formatZodError(
    error: z.ZodError,
): string {
    const paths = [
        ...new Set(
            error.issues.map((issue) =>
                issue.path.length === 0
                    ? 'root'
                    : issue.path.join('.'),
            ),
        ),
    ].sort()

    return (
        'Runtime bootstrap manifest is invalid: ' +
        paths.join(', ')
    )
}

function separator(): string {
    return process.platform === 'win32'
        ? '\\'
        : '/'
}