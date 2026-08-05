import { spawn, spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const generatedDirectories = [
  join(repositoryRoot, 'apps/api/dist'),
  join(repositoryRoot, 'packages/contracts/dist'),
]

if (process.env.PRISMA_CLEAN_START_ALLOWED !== 'true') {
  throw new Error(
    'API clean-start must be launched by the disposable PostgreSQL verifier',
  )
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for API clean-start')
}

function removeGeneratedOutput() {
  for (const directory of generatedDirectories) {
    rmSync(directory, { recursive: true, force: true })
  }
}

function runBuild() {
  const result = spawnSync(npmCommand, ['run', 'build', '-w', 'api'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: process.env,
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`API build failed:\n${result.stdout}\n${result.stderr}`)
  }

  const expectedFiles = [
    join(repositoryRoot, 'apps/api/dist/main.js'),
    join(repositoryRoot, 'packages/contracts/dist/index.js'),
    join(repositoryRoot, 'packages/contracts/dist/index.d.ts'),
  ]
  for (const expectedFile of expectedFiles) {
    if (!existsSync(expectedFile)) {
      throw new Error(`Build did not create ${expectedFile}`)
    }
  }
}

async function reservePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') {
    server.close()
    throw new Error('Unable to reserve a local port')
  }
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  return address.port
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return

  const exited = new Promise((resolve) => child.once('exit', resolve))
  if (process.platform === 'win32') child.kill('SIGTERM')
  else process.kill(-child.pid, 'SIGTERM')

  const stopped = await Promise.race([
    exited.then(() => true),
    delay(5_000).then(() => false),
  ])
  if (!stopped && child.exitCode === null && child.signalCode === null) {
    if (process.platform === 'win32') child.kill('SIGKILL')
    else process.kill(-child.pid, 'SIGKILL')
    await exited
  }
}

async function startAndProbe(args, label) {
  const port = await reservePort()
  const child = spawn(npmCommand, args, {
    cwd: repositoryRoot,
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      API_PREFIX: 'api',
      WEB_ORIGIN: 'http://localhost:5173',
      HTTP_BODY_LIMIT: '1mb',
      SUPABASE_URL: 'https://clean-start.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'clean-start-placeholder',
      SUPABASE_SOURCE_BUCKET: 'source-documents',
      SOURCE_SIGNED_URL_TTL_SECONDS: '120',
      HTTP_MAX_BYTES: '15728640',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (chunk) => {
    output += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    output += chunk.toString()
  })

  try {
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(`${label} exited before health check:\n${output}`)
      }
      try {
        const liveResponse = await fetch(
          `http://127.0.0.1:${port}/api/health/live`,
        )
        const readyResponse = await fetch(
          `http://127.0.0.1:${port}/api/health/ready`,
        )
        if (liveResponse.ok && readyResponse.ok) {
          const body = await liveResponse.json()
          const readyBody = await readyResponse.json()
          if (
            body.status !== 'ok' ||
            body.service !== 'caspian-trace-api' ||
            readyBody.database !== 'ready'
          ) {
            throw new Error(`${label} returned an invalid health response`)
          }
          return
        }
      } catch {
        // The process may still be compiling or binding its port.
      }
      await delay(150)
    }
    throw new Error(`${label} did not become healthy:\n${output}`)
  } finally {
    await stopProcess(child)
  }
}

removeGeneratedOutput()
runBuild()
await startAndProbe(['run', 'start', '-w', 'api'], 'API production start')

removeGeneratedOutput()
await startAndProbe(['run', 'dev:api'], 'API development start')

console.log('API clean build, production start, and development start passed')
