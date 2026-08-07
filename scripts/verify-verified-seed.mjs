import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const result = spawnSync(
  process.execPath,
  ['scripts/verify-prisma-clean-db.mjs', '--verified-seed-only'],
  { cwd: repositoryRoot, env: process.env, stdio: 'inherit' },
)

if (result.error) throw result.error
if (result.status !== 0) process.exitCode = result.status ?? 1
