export type RuntimeBootstrapErrorCode =
    | 'RUNTIME_BOOTSTRAP_MANIFEST_INVALID'
    | 'RUNTIME_BOOTSTRAP_FILE_INVALID'
    | 'RUNTIME_BOOTSTRAP_PATH_INVALID'
    | 'RUNTIME_BOOTSTRAP_DUPLICATE_INCIDENT'
    | 'RUNTIME_BOOTSTRAP_INPUT_INVALID'
    | 'RUNTIME_BOOTSTRAP_GOLDEN_MISMATCH'
    | 'RUNTIME_BOOTSTRAP_HANDOFF_MISMATCH'
    | 'RUNTIME_BOOTSTRAP_PLAN_CONFLICT'
    | 'RUNTIME_BOOTSTRAP_PREREQUISITE_MISSING'
    | 'RUNTIME_BOOTSTRAP_PREREQUISITE_CONFLICT'

export class RuntimeBootstrapError extends Error {
    constructor(
        readonly code: RuntimeBootstrapErrorCode,
        message: string,
        options?: ErrorOptions,
    ) {
        super(message, options)
        this.name = RuntimeBootstrapError.name
    }
}