"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const node_path_1 = require("node:path");
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const investigations_service_1 = require("../src/investigations/investigations.service");
const prisma_service_1 = require("../src/prisma/prisma.service");
const runtime_bootstrap_errors_1 = require("./seed/runtime-bootstrap.errors");
const runtime_bootstrap_orchestrator_1 = require("./seed/runtime-bootstrap.orchestrator");
let currentStage = 'create_application_context';
async function main() {
    debugStage(currentStage);
    const application = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, {
        logger: false,
        abortOnError: false,
    });
    let operationError;
    let operationFailureStage = null;
    try {
        currentStage = 'resolve_dependencies';
        debugStage(currentStage);
        const prisma = application.get(prisma_service_1.PrismaService);
        const investigations = application.get(investigations_service_1.InvestigationsService);
        currentStage = 'persist_and_recompute';
        debugStage(currentStage);
        const summary = await (0, runtime_bootstrap_orchestrator_1.runRuntimeBootstrap)(prisma, (incidentId) => investigations.recompute(incidentId), {
            repositoryRoot: (0, node_path_1.resolve)(process.cwd(), '..', '..'),
        });
        currentStage = 'print_summary';
        debugStage(currentStage);
        process.stdout.write(`${JSON.stringify(summary)}\n`);
    }
    catch (error) {
        operationError = error;
        operationFailureStage = currentStage;
    }
    let closeError;
    debugStage('close_application');
    try {
        await application.close();
    }
    catch (error) {
        closeError = error;
    }
    if (operationError !== undefined) {
        currentStage =
            operationFailureStage ??
                'persist_and_recompute';
        throw normalizeError(operationError, 'Runtime bootstrap operation failed');
    }
    if (closeError !== undefined) {
        currentStage = 'close_application';
        throw normalizeError(closeError, 'Failed to close bootstrap application');
    }
    currentStage = 'completed';
}
function normalizeError(value, fallbackMessage) {
    if (value instanceof Error) {
        return value;
    }
    if (typeof value === 'string') {
        return new Error(value);
    }
    return new Error(fallbackMessage, {
        cause: value,
    });
}
function debugStage(stage) {
    if (process.env.RUNTIME_BOOTSTRAP_DEBUG !== '1') {
        return;
    }
    process.stderr.write(`RUNTIME_BOOTSTRAP_STAGE=${stage}\n`);
}
function formatBootstrapError(error) {
    const messages = [];
    let current = error;
    for (let depth = 0; depth < 5 && current !== undefined; depth += 1) {
        messages.push(formatSingleError(current));
        current = readErrorCause(current);
    }
    return messages.join('\nCAUSED_BY: ');
}
function formatSingleError(error) {
    if (error instanceof runtime_bootstrap_errors_1.RuntimeBootstrapError) {
        return [
            error.code,
            redactSecrets(error.message),
        ].join(': ');
    }
    if (error instanceof Error) {
        const code = readErrorCode(error);
        const prefix = code === null
            ? error.name
            : `${code}: ${error.name}`;
        return [
            prefix,
            redactSecrets(error.message),
        ].join(': ');
    }
    if (typeof error === 'string') {
        return redactSecrets(error);
    }
    return 'Unknown non-Error failure';
}
function readErrorCode(error) {
    const code = error.code;
    return typeof code === 'string'
        ? code
        : null;
}
function readErrorCause(error) {
    return error instanceof Error
        ? error.cause
        : undefined;
}
function redactSecrets(message) {
    return message
        .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, 'postgresql://[REDACTED]')
        .replace(/(service[_-]?role[_-]?key|ingestion[_-]?token)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]');
}
void main().catch((error) => {
    process.stderr.write([
        `RUNTIME_BOOTSTRAP_FAILED_AT=${currentStage}`,
        formatBootstrapError(error),
    ].join('\n') + '\n');
    process.exitCode = 1;
});
//# sourceMappingURL=bootstrap-investigations.js.map