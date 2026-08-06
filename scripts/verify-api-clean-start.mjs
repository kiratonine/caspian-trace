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
      LLM_PROVIDER: 'disabled',
      PORT: String(port),
      API_PREFIX: 'api',
      WEB_ORIGIN: 'http://localhost:5173',
      HTTP_BODY_LIMIT: '1mb',
      SUPABASE_URL: 'https://clean-start.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'clean-start-placeholder',
      SUPABASE_SOURCE_BUCKET: 'source-documents',
      SOURCE_SIGNED_URL_TTL_SECONDS: '120',
      HTTP_MAX_BYTES: '15728640',
      HTTP_TIMEOUT_MS: '10000',
      SAFE_FETCH_USER_AGENT: 'caspian-trace-clean-start/1.0',
      SAFE_FETCH_CACHE_MAX_ENTRIES: '4',
      SAFE_FETCH_CACHE_MAX_BYTES: '1048576',
      SAFE_FETCH_RETRY_BASE_DELAY_MS: '10',
      SAFE_FETCH_RETRY_MAX_DELAY_MS: '100',
      INGESTION_TOKEN: 'clean-start-ingestion-token-at-least-32-characters',
      KAZHYDROMET_BULLETINS_URL:
        'https://www.kazhydromet.kz/ru/ecology/ezhemesyachnyy-informacionnyy-byulleten-o-sostoyanii-okruzhayuschey-sredy',
      KAZHYDROMET_ALLOWED_HOSTS: 'kazhydromet.kz,www.kazhydromet.kz',
      KAZHYDROMET_MAX_DOCUMENTS_PER_RUN: '3',
      KAZHYDROMET_PDF_MAX_PAGES: '300',
      KAZHYDROMET_PDF_MAX_TEXT_CHARS: '5000000',
      GDELT_ENDPOINT_URL: 'https://api.gdeltproject.org/api/v2/doc/doc',
      GDELT_ALLOWED_HOSTS: 'api.gdeltproject.org',
      GDELT_CACHE_TTL_SECONDS: '1800',
      GDELT_STALE_IF_ERROR_SECONDS: '86400',
      GDELT_MAX_RECORDS: '25',
      GDELT_MAX_ARTICLES_PER_RUN: '10',
      GDELT_MAX_WINDOW_DAYS: '31',
      DIRECT_SOURCE_ALLOWED_HOSTS: 'kazhydromet.kz,www.kazhydromet.kz,inform.kz,www.inform.kz,gov.kz,www.gov.kz,azh.kz,www.azh.kz,atpress.kz,www.atpress.kz,lada.kz,www.lada.kz,inaktau.kz,www.inaktau.kz,tumba.kz,www.tumba.kz,mangystaumedia.kz,www.mangystaumedia.kz,uralskweek.kz,www.uralskweek.kz,mgorod.kz,www.mgorod.kz,diapazon.kz,www.diapazon.kz,zakon.kz,www.zakon.kz',
      DIRECT_SOURCE_FALLBACK_URLS: 'https://www.zakon.kz/obshestvo/6490267-v-atyrau-zelenaya-voda-v-reke-okazalas-sledom-neftyanogo-zagryazneniya.html,https://www.inform.kz/ru/v-stochnih-vodah-atirau-obnaruzheni-ostatki-nefteproduktov-adef40,https://azh.kz/ru/news/view/120575',
      DIRECT_SOURCE_MAX_ARTICLES_PER_RUN: '10',
      DIRECT_SOURCE_MAX_ARTICLES_PER_DOMAIN: '2',
      DIRECT_SOURCE_HTML_MAX_BYTES: '2097152',
      DIRECT_SOURCE_TEXT_MAX_CHARS: '100000',
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
