import { spawn, spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const npmCli = process.env.npm_execpath
const npmCommand = npmCli === undefined
  ? (process.platform === 'win32' ? 'npm.cmd' : 'npm')
  : process.execPath
const generatedDirectories = [
  join(repositoryRoot, 'apps/api/dist'),
  join(repositoryRoot, 'packages/contracts/dist'),
  join(repositoryRoot, 'packages/investigation-core/dist'),
]

function npmArgs(args) {
  return npmCli === undefined ? args : [npmCli, ...args]
}

function removeGeneratedOutput() {
  for (const directory of generatedDirectories) {
    rmSync(directory, { recursive: true, force: true })
  }
}

function runBuild() {
  const result = spawnSync(npmCommand, npmArgs(['run', 'build', '-w', 'api']), {
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
    join(repositoryRoot, 'packages/investigation-core/dist/index.js'),
    join(repositoryRoot, 'packages/investigation-core/dist/index.d.ts'),
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
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    })
  } else {
    process.kill(-child.pid, 'SIGTERM')
  }

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
  const child = spawn(npmCommand, npmArgs(args), {
    cwd: repositoryRoot,
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      API_PREFIX: 'api',
      WEB_ORIGIN: 'http://localhost:5173',
      HTTP_BODY_LIMIT: '1mb',
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
        const response = await fetch(
          `http://127.0.0.1:${port}/api/health/live`,
        )
        if (response.ok) {
          const body = await response.json()
          if (body.status !== 'ok' || body.service !== 'caspian-trace-api') {
            throw new Error(`${label} returned an invalid health response`)
          }
          await probeInvestigationEndpoints(port, label)
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

async function probeInvestigationEndpoints(port, label) {
  const base = `http://127.0.0.1:${port}/api`
  const evidence = await fetch(
    `${base}/investigations/inv-atyrau-2025-09/evidence`,
  )
  if (!evidence.ok || (await evidence.json()).investigationId !== 'inv-atyrau-2025-09') {
    throw new Error(`${label} returned an invalid evidence response`)
  }
  const replay = await fetch(`${base}/replays/inv-atyrau-2025-09/start`, {
    method: 'POST',
  })
  const replayBody = await replay.json()
  if (!replay.ok || replayBody.steps?.at(-1)?.offsetMs !== 25_000) {
    throw new Error(`${label} returned an invalid replay response`)
  }
  const dossier = await fetch(
    `${base}/investigations/inv-atyrau-2025-09/export?format=json`,
  )
  if (!dossier.ok || (await dossier.json()).evidenceLevel !== 'L2') {
    throw new Error(`${label} returned an invalid dossier response`)
  }
}

removeGeneratedOutput()
runBuild()
await startAndProbe(['run', 'start', '-w', 'api'], 'API production start')

removeGeneratedOutput()
await startAndProbe(['run', 'dev:api'], 'API development start')

console.log('API clean build, production start, and development start passed')
