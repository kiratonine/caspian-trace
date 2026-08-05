import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

import { assertDisposableDatabaseTarget } from './disposable-database-guard.mjs'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const dockerCommand = process.platform === 'win32' ? 'docker.exe' : 'docker'
const apiCleanOnly = process.argv.includes('--api-clean-start-only')
const verifiedSeedOnly = process.argv.includes('--verified-seed-only')
const incidentsOnly = process.argv.includes('--incidents-only')
const externalDatabaseUrl = process.env.PRISMA_CLEAN_DATABASE_URL
const externalDirectUrl =
  process.env.PRISMA_CLEAN_DIRECT_URL ?? externalDatabaseUrl

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    env: options.env ?? process.env,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const detail = options.capture
      ? `\n${result.stdout ?? ''}\n${result.stderr ?? ''}`
      : ''
    throw new Error(`${command} ${args.join(' ')} failed${detail}`)
  }
  return result.stdout?.trim() ?? ''
}

function dockerAvailable() {
  const result = spawnSync(dockerCommand, ['info'], { stdio: 'ignore' })
  return result.status === 0
}

async function waitForPostgres(containerName) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = spawnSync(
      dockerCommand,
      ['exec', containerName, 'pg_isready', '-U', 'postgres', '-d', 'caspian_trace'],
      { stdio: 'ignore' },
    )
    if (result.status === 0) return
    await delay(250)
  }
  throw new Error('Disposable PostgreSQL did not become ready')
}

function testEnvironment(databaseUrl, directUrl) {
  return {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    DIRECT_URL: directUrl,
    DATABASE_E2E_URL: databaseUrl,
    DIRECT_E2E_URL: directUrl,
    PRISMA_E2E_DATABASE_REQUIRED: 'true',
    PRISMA_E2E_DATABASE_DISPOSABLE: 'true',
    PRISMA_CLEAN_START_ALLOWED: 'true',
    DB_READINESS_TIMEOUT_MS: '3000',
  }
}

function verify(databaseUrl, directUrl) {
  const env = testEnvironment(databaseUrl, directUrl)
  run(npmCommand, ['run', 'prisma:migrate:deploy'], { env })
  run(npmCommand, ['run', 'prisma:migrate:status'], { env })
  run(
    npmCommand,
    [
      'exec',
      '-w',
      'api',
      '--',
      'prisma',
      'migrate',
      'diff',
      '--from-schema',
      'prisma/schema.prisma',
      '--to-config-datasource',
      '--exit-code',
    ],
    { env },
  )
  run(npmCommand, ['run', 'prisma:generate'], { env })

  if (verifiedSeedOnly) {
    run(npmCommand, ['run', 'test:e2e:seed', '-w', 'api'], { env })
    return
  }

  if (incidentsOnly) {
    run(npmCommand, ['run', 'test:e2e:incidents:db', '-w', 'api'], { env })
    return
  }

  if (!apiCleanOnly) {
    run(npmCommand, ['run', 'test:e2e:db'], { env })
  }
  run(process.execPath, ['scripts/verify-api-clean-start.mjs'], { env })
}

let containerName
try {
  if (externalDatabaseUrl) {
    if (!externalDirectUrl) {
      throw new Error('PRISMA_CLEAN_DIRECT_URL is required in external mode')
    }
    assertDisposableDatabaseTarget({
      databaseUrl: externalDatabaseUrl,
      directUrl: externalDirectUrl,
      explicitlyDisposable:
        process.env.PRISMA_CLEAN_DATABASE_DISPOSABLE === 'true',
    })
    console.log('Using explicitly configured external disposable PostgreSQL')
    verify(externalDatabaseUrl, externalDirectUrl)
  } else {
    if (!dockerAvailable()) {
      throw new Error(
        'Docker is unavailable and PRISMA_CLEAN_DATABASE_URL is not configured',
      )
    }
    const part = verifiedSeedOnly ? 'part03' : incidentsOnly ? 'part04' : 'part02'
    containerName = `caspian-trace-${part}-${process.pid}-${Date.now()}`
    const password = randomBytes(24).toString('base64url')
    run(dockerCommand, [
      'run',
      '--detach',
      '--rm',
      '--name',
      containerName,
      '--publish',
      '127.0.0.1::5432',
      '--env',
      `POSTGRES_PASSWORD=${password}`,
      '--env',
      'POSTGRES_DB=caspian_trace',
      'postgres:16-alpine',
    ])
    await waitForPostgres(containerName)
    const binding = run(
      dockerCommand,
      ['port', containerName, '5432/tcp'],
      { capture: true },
    )
    const port = binding.slice(binding.lastIndexOf(':') + 1)
    if (!/^\d+$/.test(port)) throw new Error('Docker returned an invalid port')
    const databaseUrl = `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/caspian_trace`
    console.log('Disposable PostgreSQL 16 is ready on a random loopback port')
    verify(databaseUrl, databaseUrl)
  }
  console.log(
    verifiedSeedOnly
      ? 'Clean migration and verified seed DB e2e passed'
      : incidentsOnly
      ? 'Clean migration and incidents read DB e2e passed'
      : apiCleanOnly
      ? 'API clean build/start passed against disposable PostgreSQL'
      : 'Clean migration, status, DB e2e, and API clean start passed',
  )
} finally {
  if (containerName) {
    spawnSync(dockerCommand, ['stop', '--time', '1', containerName], {
      stdio: 'ignore',
    })
  }
}
