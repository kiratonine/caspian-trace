import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { ApiErrorSchema, HealthLiveSchema } from '@caspian-trace/contracts'

describe('compiled API with unavailable PostgreSQL (process e2e)', () => {
  let child: ChildProcess | undefined

  afterEach(async () => {
    if (child !== undefined) await stopProcess(child)
    child = undefined
  })

  it('starts, stays live, and returns normalized readiness failure', async () => {
    const apiPort = await reservePort()
    const unavailableDatabasePort = await reservePort()
    const apiRoot = join(__dirname, '..')
    child = spawn(process.execPath, [join(apiRoot, 'dist/main.js')], {
      cwd: apiRoot,
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(apiPort),
        API_PREFIX: 'api',
        WEB_ORIGIN: 'http://localhost:5173',
        HTTP_BODY_LIMIT: '1mb',
        DB_READINESS_TIMEOUT_MS: '250',
        DATABASE_URL: `postgresql://postgres:test@127.0.0.1:${unavailableDatabasePort}/unavailable`,
      },
      stdio: 'ignore',
    })

    await waitUntilLive(apiPort, child)

    const liveResponse = await fetchWithClosedConnection(
      `http://127.0.0.1:${apiPort}/api/health/live`,
    )
    expect(liveResponse.status).toBe(200)
    expect(HealthLiveSchema.parse(await liveResponse.json())).toEqual({
      status: 'ok',
      service: 'caspian-trace-api',
    })

    const startedAt = Date.now()
    const readyResponse = await fetchWithClosedConnection(
      `http://127.0.0.1:${apiPort}/api/health/ready`,
    )
    const elapsedMs = Date.now() - startedAt

    expect(readyResponse.status).toBe(503)
    expect(ApiErrorSchema.parse(await readyResponse.json())).toEqual({
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database is unavailable',
      requestId: readyResponse.headers.get('x-request-id'),
    })
    expect(elapsedMs).toBeLessThan(2_000)

    const liveAfterFailure = await fetchWithClosedConnection(
      `http://127.0.0.1:${apiPort}/api/health/live`,
    )
    expect(liveAfterFailure.status).toBe(200)
  })
})

async function reservePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') {
    server.close()
    throw new Error('Unable to reserve a local port')
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  return address.port
}

async function waitUntilLive(
  port: number,
  processUnderTest: ChildProcess,
): Promise<void> {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (processUnderTest.exitCode !== null) {
      throw new Error('Compiled API exited before liveness probe')
    }
    try {
      const response = await fetchWithClosedConnection(
        `http://127.0.0.1:${port}/api/health/live`,
      )
      if (response.ok) return
    } catch {
      // The compiled process may still be binding its port.
    }
    await delay(100)
  }
  throw new Error('Compiled API did not become live')
}

function fetchWithClosedConnection(url: string): Promise<Response> {
  return fetch(url, { headers: { connection: 'close' } })
}

async function stopProcess(processUnderTest: ChildProcess): Promise<void> {
  if (
    processUnderTest.exitCode !== null ||
    processUnderTest.signalCode !== null
  ) {
    return
  }
  const exited = new Promise<void>((resolve) => {
    processUnderTest.once('exit', () => resolve())
  })
  if (process.platform === 'win32') processUnderTest.kill('SIGTERM')
  else if (processUnderTest.pid !== undefined) {
    process.kill(-processUnderTest.pid, 'SIGTERM')
  }
  let stopTimeout: NodeJS.Timeout | undefined
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise<boolean>((resolve) => {
      stopTimeout = setTimeout(() => resolve(false), 5_000)
    }),
  ])
  if (stopTimeout !== undefined) clearTimeout(stopTimeout)
  if (!stopped && processUnderTest.exitCode === null) {
    if (process.platform === 'win32') processUnderTest.kill('SIGKILL')
    else if (processUnderTest.pid !== undefined) {
      process.kill(-processUnderTest.pid, 'SIGKILL')
    }
    await exited
  }
}
