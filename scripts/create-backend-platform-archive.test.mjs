import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'

import {
  collectArchiveEntries,
  findRepositoryRoot,
  isForbiddenArchivePath,
  normalizeArchivePath,
} from './create-backend-platform-archive.mjs'

const temporaryRoots = []

function createFixtureRepository() {
  const root = mkdtempSync(join(tmpdir(), 'caspian-trace-archive-test-'))
  temporaryRoots.push(root)
  writeFixture(root, 'package.json', '{}')
  writeFixture(root, '.nvmrc', '20\n')
  writeFixture(root, '.node-version', '20\n')
  writeFixture(root, 'AGENTS.md', '# Instructions')
  writeFixture(root, 'apps/api/package.json', '{}')
  writeFixture(root, 'apps/api/.env.example', 'PORT=3000')
  writeFixture(root, 'apps/api/.env', 'SECRET=value')
  writeFixture(root, 'apps/api/src/main.ts', 'export {}')
  writeFixture(root, 'apps/api/src/health/health.module.ts', 'export {}')
  writeFixture(root, 'apps/api/src/generated/prisma/client.ts', 'secret generated')
  writeFixture(root, 'apps/api/dist/main.js', 'generated')
  writeFixture(root, 'apps/api/coverage/result.json', '{}')
  writeFixture(root, 'apps/web/src/main.tsx', 'frontend')
  writeFixture(root, 'packages/contracts/src/index.ts', 'export {}')
  writeFixture(root, 'packages/contracts/node_modules/zod/index.js', 'dependency')
  writeFixture(root, 'packages/investigation-core/src/index.ts', 'backend 2')
  writeFixture(root, 'data/verified/manifest.json', '{}')
  writeFixture(root, 'scripts/verify-api-clean-start.mjs', 'export {}')
  return root
}

function writeFixture(root, relativePath, content) {
  const absolutePath = join(root, relativePath)
  mkdirSync(join(absolutePath, '..'), { recursive: true })
  writeFileSync(absolutePath, content)
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

test('resolves the repository root from root and scripts', () => {
  const root = createFixtureRepository()
  mkdirSync(join(root, 'scripts'), { recursive: true })
  assert.equal(findRepositoryRoot(root), root)
  assert.equal(findRepositoryRoot(join(root, 'scripts')), root)
})

test('collects only Backend 1 allowlisted files', () => {
  const root = createFixtureRepository()
  const entries = collectArchiveEntries(root)

  assert.ok(entries.includes('AGENTS.md'))
  assert.ok(entries.includes('.nvmrc'))
  assert.ok(entries.includes('.node-version'))
  assert.ok(entries.includes('apps/api/src/main.ts'))
  assert.ok(entries.includes('apps/api/src/health/health.module.ts'))
  assert.ok(entries.includes('packages/contracts/src/index.ts'))
  assert.ok(entries.includes('scripts/verify-api-clean-start.mjs'))
  assert.ok(!entries.some((entry) => entry.startsWith('apps/web/')))
  assert.ok(!entries.some((entry) => entry.startsWith('packages/investigation-core/')))
  assert.ok(!entries.some((entry) => entry.startsWith('data/verified/')))
})

test('allows .env.example while excluding secrets and generated output', () => {
  const entries = collectArchiveEntries(createFixtureRepository())

  assert.ok(entries.includes('apps/api/.env.example'))
  assert.ok(!entries.includes('apps/api/.env'))
  assert.ok(!entries.some((entry) => entry.includes('node_modules')))
  assert.ok(!entries.some((entry) => entry.includes('/dist/')))
  assert.ok(!entries.some((entry) => entry.includes('/coverage/')))
  assert.ok(!entries.some((entry) => entry.startsWith('apps/api/src/generated/')))
})

test('normalizes Windows separators and rejects forbidden paths', () => {
  assert.equal(normalizeArchivePath('apps\\api\\src\\main.ts'), 'apps/api/src/main.ts')
  assert.equal(isForbiddenArchivePath('apps\\web\\src\\main.tsx'), true)
  assert.equal(isForbiddenArchivePath('apps/api/.env.example'), false)
})

test('deduplicates entries and ignores symlinks outside the repository', () => {
  const root = createFixtureRepository()
  const externalRoot = mkdtempSync(join(tmpdir(), 'caspian-trace-external-'))
  temporaryRoots.push(externalRoot)
  writeFixture(externalRoot, 'outside.ts', 'outside')
  symlinkSync(join(externalRoot, 'outside.ts'), join(root, 'packages/contracts/outside.ts'))

  const entries = collectArchiveEntries(root)
  assert.equal(entries.length, new Set(entries).size)
  assert.ok(!entries.includes('packages/contracts/outside.ts'))
})

test('missing future allowlist paths do not fail collection', () => {
  const root = createFixtureRepository()
  assert.doesNotThrow(() => collectArchiveEntries(root))
})
