"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRuntimeBootstrap = loadRuntimeBootstrap;
exports.parseRuntimeBootstrapManifest = parseRuntimeBootstrapManifest;
exports.safeRepositoryPath = safeRepositoryPath;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const runtime_bootstrap_errors_1 = require("./runtime-bootstrap.errors");
const runtime_bootstrap_types_1 = require("./runtime-bootstrap.types");
const defaultRepositoryRoot = (0, node_path_1.resolve)(__dirname, '..', '..', '..', '..');
const manifestRelativePath = 'data/fixtures/investigation/' +
    'runtime-bootstrap-handoff.json';
async function loadRuntimeBootstrap(options = {}) {
    const repositoryRoot = options.repositoryRoot ?? defaultRepositoryRoot;
    const manifestPath = safeRepositoryPath(repositoryRoot, manifestRelativePath);
    const manifest = await readJson(manifestPath, 'manifest');
    const parsedManifest = parseRuntimeBootstrapManifest(manifest);
    const cases = await Promise.all(parsedManifest.cases.map(async (handoff) => ({
        handoff,
        input: await readJson(safeRepositoryPath(repositoryRoot, handoff.inputPath), handoff.inputPath),
        expectedResult: await readJson(safeRepositoryPath(repositoryRoot, handoff.expectedResultPath), handoff.expectedResultPath),
    })));
    return {
        manifest: parsedManifest,
        cases,
    };
}
function parseRuntimeBootstrapManifest(value) {
    const parsed = runtime_bootstrap_types_1.RuntimeBootstrapManifestSchema.safeParse(value);
    if (!parsed.success) {
        throw new runtime_bootstrap_errors_1.RuntimeBootstrapError('RUNTIME_BOOTSTRAP_MANIFEST_INVALID', formatZodError(parsed.error));
    }
    assertUniqueCaseValues(parsed.data);
    return parsed.data;
}
function safeRepositoryPath(repositoryRoot, relativePath) {
    if ((0, node_path_1.isAbsolute)(relativePath)) {
        throw invalidPath(relativePath);
    }
    const resolvedRoot = (0, node_path_1.resolve)(repositoryRoot);
    const resolvedPath = (0, node_path_1.resolve)(resolvedRoot, relativePath);
    const pathFromRoot = (0, node_path_1.relative)(resolvedRoot, resolvedPath);
    if (pathFromRoot === '' ||
        pathFromRoot === '..' ||
        pathFromRoot.startsWith(`..${separator()}`) ||
        (0, node_path_1.isAbsolute)(pathFromRoot)) {
        throw invalidPath(relativePath);
    }
    return resolvedPath;
}
async function readJson(path, label) {
    let source;
    try {
        source = await (0, promises_1.readFile)(path, 'utf8');
    }
    catch (error) {
        throw new runtime_bootstrap_errors_1.RuntimeBootstrapError('RUNTIME_BOOTSTRAP_FILE_INVALID', `Unable to read runtime bootstrap file: ${label}`, { cause: error });
    }
    try {
        return JSON.parse(source);
    }
    catch (error) {
        throw new runtime_bootstrap_errors_1.RuntimeBootstrapError('RUNTIME_BOOTSTRAP_FILE_INVALID', `Invalid JSON in runtime bootstrap file: ${label}`, { cause: error });
    }
}
function assertUniqueCaseValues(manifest) {
    assertUnique(manifest.cases.map(({ incident }) => incident.id), 'incident ID');
    assertUnique(manifest.cases.map(({ inputPath }) => inputPath), 'input path');
    assertUnique(manifest.cases.map(({ expectedResultPath }) => expectedResultPath), 'expected result path');
    for (const handoff of manifest.cases) {
        assertUnique(handoff.signalIds, `${handoff.incident.id} signal ID`);
        assertUnique(handoff.stationIds, `${handoff.incident.id} station ID`);
        assertUnique(handoff.stationRelationIds, `${handoff.incident.id} relation ID`);
        assertUnique(handoff.measurementIds, `${handoff.incident.id} measurement ID`);
        assertUnique(handoff.candidateObjectIds, `${handoff.incident.id} candidate ID`);
        assertUnique(handoff.sourceDocumentIds, `${handoff.incident.id} source ID`);
    }
}
function assertUnique(values, label) {
    if (new Set(values).size === values.length) {
        return;
    }
    throw new runtime_bootstrap_errors_1.RuntimeBootstrapError('RUNTIME_BOOTSTRAP_DUPLICATE_INCIDENT', `Duplicate runtime bootstrap ${label}`);
}
function invalidPath(path) {
    return new runtime_bootstrap_errors_1.RuntimeBootstrapError('RUNTIME_BOOTSTRAP_PATH_INVALID', `Unsafe runtime bootstrap path: ${path}`);
}
function formatZodError(error) {
    const paths = [
        ...new Set(error.issues.map((issue) => issue.path.length === 0
            ? 'root'
            : issue.path.join('.'))),
    ].sort();
    return ('Runtime bootstrap manifest is invalid: ' +
        paths.join(', '));
}
function separator() {
    return process.platform === 'win32'
        ? '\\'
        : '/';
}
//# sourceMappingURL=runtime-bootstrap.loader.js.map