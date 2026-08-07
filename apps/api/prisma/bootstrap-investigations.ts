import 'dotenv/config'

import { resolve } from 'node:path'

import { NestFactory } from '@nestjs/core'

import { AppModule } from '../src/app.module'
import { InvestigationsService } from '../src/investigations/investigations.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { RuntimeBootstrapError } from './seed/runtime-bootstrap.errors'
import { runRuntimeBootstrap } from './seed/runtime-bootstrap.orchestrator'

type BootstrapStage =
  | 'create_application_context'
  | 'resolve_dependencies'
  | 'persist_and_recompute'
  | 'print_summary'
  | 'close_application'
  | 'completed'

let currentStage: BootstrapStage =
  'create_application_context'

async function main(): Promise<void> {
  debugStage(currentStage)

  const application =
    await NestFactory.createApplicationContext(
      AppModule,
      {
        logger: false,
        abortOnError: false,
      },
    )

  let operationError: unknown
  let operationFailureStage:
    | BootstrapStage
    | null = null

  try {
    currentStage = 'resolve_dependencies'
    debugStage(currentStage)

    const prisma =
      application.get(PrismaService)

    const investigations =
      application.get(InvestigationsService)

    currentStage = 'persist_and_recompute'
    debugStage(currentStage)

    const summary = await runRuntimeBootstrap(
      prisma,
      (incidentId) =>
        investigations.recompute(incidentId),
      {
        repositoryRoot: resolve(
          process.cwd(),
          '..',
          '..',
        ),
      },
    )

    currentStage = 'print_summary'
    debugStage(currentStage)

    process.stdout.write(
      `${JSON.stringify(summary)}\n`,
    )
  } catch (error: unknown) {
    operationError = error
    operationFailureStage = currentStage
  }

  let closeError: unknown

  debugStage('close_application')

  try {
    await application.close()
  } catch (error: unknown) {
    closeError = error
  }

  if (operationError !== undefined) {
    currentStage =
      operationFailureStage ??
      'persist_and_recompute'

    throw normalizeError(
      operationError,
      'Runtime bootstrap operation failed',
    )
  }

  if (closeError !== undefined) {
    currentStage = 'close_application'
    throw normalizeError(
      closeError,
      'Failed to close bootstrap application',
    )
  }

  currentStage = 'completed'
}

function normalizeError(
  value: unknown,
  fallbackMessage: string,
): Error {
  if (value instanceof Error) {
    return value
  }

  if (typeof value === 'string') {
    return new Error(value)
  }

  return new Error(
    fallbackMessage,
    {
      cause: value,
    },
  )
}

function debugStage(
  stage: BootstrapStage,
): void {
  if (
    process.env.RUNTIME_BOOTSTRAP_DEBUG !== '1'
  ) {
    return
  }

  process.stderr.write(
    `RUNTIME_BOOTSTRAP_STAGE=${stage}\n`,
  )
}

function formatBootstrapError(
  error: unknown,
): string {
  const messages: string[] = []
  let current: unknown = error

  for (
    let depth = 0;
    depth < 5 && current !== undefined;
    depth += 1
  ) {
    messages.push(formatSingleError(current))
    current = readErrorCause(current)
  }

  return messages.join('\nCAUSED_BY: ')
}

function formatSingleError(
  error: unknown,
): string {
  if (error instanceof RuntimeBootstrapError) {
    return [
      error.code,
      redactSecrets(error.message),
    ].join(': ')
  }

  if (error instanceof Error) {
    const code = readErrorCode(error)
    const prefix =
      code === null
        ? error.name
        : `${code}: ${error.name}`

    return [
      prefix,
      redactSecrets(error.message),
    ].join(': ')
  }

  if (typeof error === 'string') {
    return redactSecrets(error)
  }

  return 'Unknown non-Error failure'
}

function readErrorCode(
  error: Error,
): string | null {
  const code = (
    error as Error & {
      code?: unknown
    }
  ).code

  return typeof code === 'string'
    ? code
    : null
}

function readErrorCause(
  error: unknown,
): unknown {
  return error instanceof Error
    ? error.cause
    : undefined
}

function redactSecrets(
  message: string,
): string {
  return message
    .replace(
      /postgres(?:ql)?:\/\/[^\s]+/gi,
      'postgresql://[REDACTED]',
    )
    .replace(
      /(service[_-]?role[_-]?key|ingestion[_-]?token)\s*[:=]\s*[^\s,;]+/gi,
      '$1=[REDACTED]',
    )
}

void main().catch((error: unknown) => {
  process.stderr.write(
    [
      `RUNTIME_BOOTSTRAP_FAILED_AT=${currentStage}`,
      formatBootstrapError(error),
    ].join('\n') + '\n',
  )

  process.exitCode = 1
})
