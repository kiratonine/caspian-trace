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
  writeFixture(root, '.gitignore', 'apps/api/src/generated/prisma/\n')
  writeFixture(root, '.nvmrc', '20.20.2\n')
  writeFixture(root, '.node-version', '20.20.2\n')
  writeFixture(root, 'AGENTS.md', '# Instructions')
  writeFixture(root, 'apps/api/package.json', '{}')
  writeFixture(root, 'apps/api/.env.example', 'PORT=3000')
  writeFixture(root, 'apps/api/.env', 'SECRET=value')
  writeFixture(root, 'apps/api/src/main.ts', 'export {}')
  writeFixture(root, 'apps/api/src/health/health.module.ts', 'export {}')
  writeFixture(root, 'apps/api/src/incidents/incidents.module.ts', 'export {}')
  writeFixture(root, 'apps/api/src/sources/sources.module.ts', 'export {}')
  writeFixture(root, 'apps/api/src/sources/sources.service.ts', 'export {}')
  writeFixture(root, 'apps/api/src/sources/sources.controller.ts', 'export {}')
  writeFixture(root, 'apps/api/src/sources/storage/storage.port.ts', 'export {}')
  writeFixture(root, 'apps/api/src/common/http/safe-fetch.module.ts', 'export {}')
  writeFixture(root, 'apps/api/src/common/http/safe-fetch/safe-fetch.service.ts', 'export {}')
  writeFixture(root, 'apps/api/src/common/http/safe-fetch/safe-url.ts', 'export {}')
  writeFixture(root, 'apps/api/src/common/http/safe-fetch/public-ip.ts', 'export {}')
  writeFixture(root, 'apps/api/src/common/http/safe-fetch/node-dns-resolver.service.ts', 'export {}')
  writeFixture(root, 'apps/api/src/common/http/safe-fetch/node-https-transport.service.ts', 'export {}')
  writeFixture(root, 'apps/api/src/common/http/safe-fetch/response-cache.ts', 'export {}')
  writeFixture(
    root,
    'apps/api/src/sources/storage/supabase-storage.service.ts',
    'export {}',
  )
  writeFixture(root, 'apps/api/test/incidents/incidents.mapper.spec.ts', 'export {}')
  writeFixture(root, 'apps/api/test/incidents/incidents.http.e2e-spec.ts', 'export {}')
  writeFixture(root, 'apps/api/test/incidents-read-db.e2e-spec.ts', 'export {}')
  writeFixture(root, 'apps/api/test/sources/sources.http.e2e-spec.ts', 'export {}')
  writeFixture(root, 'apps/api/test/sources/sources.service.spec.ts', 'export {}')
  writeFixture(root, 'apps/api/test/source-cache-db.e2e-spec.ts', 'export {}')
  writeFixture(root, 'apps/api/test/safe-fetch/safe-url.spec.ts', 'export {}')
  writeFixture(root, 'apps/api/test/safe-fetch/public-ip.spec.ts', 'export {}')
  writeFixture(root, 'apps/api/test/safe-fetch/node-https-transport.spec.ts', 'export {}')
  writeFixture(root, 'apps/api/test/safe-fetch/response-body.dump', 'secret body')
  writeFixture(root, 'apps/api/test/safe-fetch/dns-debug.json', '{}')
  writeFixture(root, 'apps/api/test/safe-fetch/cache-dump.bin', 'cached bytes')
  writeFixture(root, 'apps/api/prisma.config.ts', 'export default {}')
  writeFixture(root, 'apps/api/prisma/seed.ts', 'export {}')
  writeFixture(root, 'apps/api/prisma/seed/verified-data.schemas.ts', 'export {}')
  writeFixture(root, 'apps/api/prisma/seed/verified-data.loader.ts', 'export {}')
  writeFixture(root, 'apps/api/prisma/seed/verified-seed.service.ts', 'export {}')
  writeFixture(root, 'apps/api/prisma/schema.prisma', 'datasource db {}')
  writeFixture(
    root,
    'apps/api/prisma/migrations/20260804000000_initial_schema/migration.sql',
    'CREATE TABLE example();',
  )
  writeFixture(
    root,
    'apps/api/prisma/migrations/20260804160000_harden_provenance/migration.sql',
    'ALTER TABLE example ADD CONSTRAINT example_fk;',
  )
  writeFixture(
    root,
    'apps/api/prisma/migrations/20260805170000_station_relation_evidence/migration.sql',
    'CREATE TABLE station_relation_evidence();',
  )
  writeFixture(
    root,
    'apps/api/prisma/migrations/20260805200000_source_independent_station_relations/migration.sql',
    'ALTER TABLE station_relations ALTER COLUMN source_document_id DROP NOT NULL;',
  )
  writeFixture(
    root,
    'apps/api/prisma/migrations/20260805220000_relation_evidence_page_dedup/migration.sql',
    'ALTER TABLE station_relation_evidence ADD CONSTRAINT evidence_page_key UNIQUE NULLS NOT DISTINCT;',
  )
  writeFixture(root, 'apps/api/src/prisma/prisma.module.ts', 'export {}')
  writeFixture(root, 'apps/api/src/generated/prisma/client.ts', 'secret generated')
  writeFixture(root, 'apps/api/dist/main.js', 'generated')
  writeFixture(root, 'apps/api/coverage/result.json', '{}')
  writeFixture(root, 'apps/web/src/main.tsx', 'frontend')
  writeFixture(root, 'packages/contracts/src/index.ts', 'export {}')
  writeFixture(root, 'packages/contracts/node_modules/zod/index.js', 'dependency')
  writeFixture(root, 'packages/investigation-core/src/index.ts', 'backend 2')
  writeFixture(root, 'packages/investigation-core/test/investigation-core.spec.ts', 'export {}')
  writeFixture(root, 'data/verified/manifest.json', '{}')
  writeFixture(root, 'data/verified/atyrau-2025-09.json', '{}')
  writeFixture(root, 'data/fixtures/investigation/temp.json', '{}')
  writeFixture(root, 'data/fixtures/investigation/api/dossier-september.html', '<main>safe export fixture</main>')
  writeFixture(root, 'apps/api/test/seed/temp-fixtures/generated.json', '{}')
  writeFixture(root, 'scripts/verify-api-clean-start.mjs', 'export {}')
  writeFixture(root, 'scripts/verify-prisma-clean-db.mjs', 'export {}')
  writeFixture(root, 'scripts/verify-verified-seed.mjs', 'export {}')
  writeFixture(root, 'scripts/disposable-database-guard.mjs', 'export {}')
  writeFixture(root, 'scripts/disposable-database-guard.test.mjs', 'export {}')
  writeFixture(root, 'scripts/verify-investigation-data.mjs', 'export {}')
  writeFixture(root, 'scripts/verify-supabase-storage.mjs', 'export {}')
  writeFixture(root, 'scripts/verify-safe-fetch.mjs', 'export {}')
  writeFixture(root, 'scripts/verify-kazhydromet-ingestion.mjs', 'export {}')
  writeFixture(root, 'scripts/verify-gdelt-ingestion.mjs', 'export {}')
  writeFixture(
    root,
    'docs/backend-investigation/part-02-investigation-report.md',
    '# Handoff',
  )
  writeFixture(root, 'apps/api/src/ingestion/ingestion.module.ts', 'export {}')
  writeFixture(root, 'apps/api/src/ingestion/ingestion.controller.ts', 'export {}')
  writeFixture(root, 'apps/api/src/ingestion/ingestion-token.guard.ts', 'export {}')
  writeFixture(root, 'apps/api/src/ingestion/kazhydromet/kazhydromet.adapter.ts', 'export {}')
  writeFixture(root, 'apps/api/src/ingestion/kazhydromet/pdf-text.service.ts', 'export {}')
  writeFixture(root, 'apps/api/test/ingestion/kazhydromet-discovery.spec.ts', 'export {}')
  writeFixture(root, 'apps/api/test/ingestion/downloaded-source.pdf', '%PDF-secret')
  writeFixture(root, 'apps/api/test/ingestion/raw-response.html', '<html>secret</html>')
  writeFixture(root, 'apps/api/test/ingestion/parser-debug.json', '{"text":"secret"}')
  writeFixture(root, 'apps/api/test/kazhydromet-ingestion-db.e2e-spec.ts', 'export {}')
  writeFixture(root, 'apps/api/src/ingestion/gdelt/gdelt.adapter.ts', 'export {}')
  writeFixture(root, 'apps/api/src/ingestion/gdelt/gdelt-query.ts', 'export {}')
  writeFixture(root, 'apps/api/src/ingestion/gdelt/gdelt.schemas.ts', 'export {}')
  writeFixture(root, 'apps/api/src/ingestion/direct-sources/direct-source-registry.ts', 'export {}')
  writeFixture(root, 'apps/api/src/ingestion/direct-sources/direct-source.adapter.ts', 'export {}')
  writeFixture(root, 'apps/api/src/ingestion/article/article-text.service.ts', 'export {}')
  writeFixture(root, 'apps/api/src/ingestion/article/article-document-identity.ts', 'export {}')
  writeFixture(root, 'apps/api/src/live/live.module.ts', 'export {}')
  writeFixture(root, 'apps/api/test/ingestion/gdelt/gdelt-query-adapter.spec.ts', 'export {}')
  writeFixture(root, 'apps/api/test/ingestion/direct-sources/direct-source-registry.spec.ts', 'export {}')
  writeFixture(root, 'apps/api/test/ingestion/direct-sources/direct-source-region.service.spec.ts', 'export {}')
  writeFixture(root, 'apps/api/test/ingestion/article/article-text.service.spec.ts', 'export {}')
  writeFixture(root, 'apps/api/test/live/live.spec.ts', 'export {}')
  writeFixture(root, 'apps/api/test/gdelt-ingestion-db.e2e-spec.ts', 'export {}')
  writeFixture(root, 'apps/api/test/ingestion/gdelt/raw-gdelt-response.json', '{}')
  writeFixture(root, 'apps/api/test/ingestion/article/article-body.txt', 'secret body')
  writeFixture(root, 'apps/api/src/llm/llm.service.ts', 'backend 2')
  writeFixture(root, 'apps/api/src/llm/disabled-llm.provider.ts', 'export {}')
  writeFixture(root, 'apps/api/src/llm/gemini-llm.provider.ts', 'forbidden transport')
  writeFixture(root, 'apps/api/src/investigations/investigations.module.ts', 'export {}')
  writeFixture(root, 'apps/api/src/replays/replays.module.ts', 'export {}')
  writeFixture(root, 'apps/api/src/export/export.module.ts', 'export {}')
  writeFixture(root, 'apps/api/test/integration/investigation-integration-db.e2e-spec.ts', 'export {}')
  writeFixture(root, 'scripts/generate-investigation-samples.mjs', 'export {}')
  writeFixture(root, 'scripts/verify-gemini-free-tier.mjs', 'forbidden transport')
  writeFixture(
    root,
    'apps/api/prisma/migrations/20260806010000_integrate_investigation_persistence/migration.sql',
    'CREATE TABLE investigation_candidate_object_evidence();',
  )
  writeFixture(root, 'TODO/backend-platform-integration-01-platform-investigation.md', '# Integration')
  writeFixture(root, 'docs/backend-platform/integration-01-platform-investigation-report.md', '# Report')
  writeFixture(root, 'TODO/backend-platform-part-08-gdelt-direct-live-status.md', '# Part 08')
  writeFixture(root, 'docs/backend-platform/part-08-gdelt-direct-live-status-report.md', '# Report')
  writeFixture(root, 'TODO/backend-platform-part-07-kazhydromet-ingestion.md', '# Part 07')
  writeFixture(root, 'docs/backend-platform/part-07-kazhydromet-ingestion-report.md', '# Report')
  writeFixture(root, 'docs/backend-investigation/prisma-schema-request.md', '# Request')
  writeFixture(
    root,
    'TODO/backend-platform-part-02-prisma-supabase-readiness.md',
    '# Part 02',
  )
  writeFixture(
    root,
    'docs/backend-platform/part-02-prisma-supabase-readiness-report.md',
    '# Report',
  )
  writeFixture(
    root,
    'TODO/backend-platform-part-03-verified-seed.md',
    '# Part 03',
  )
  writeFixture(
    root,
    'docs/backend-platform/part-03-verified-seed-report.md',
    '# Seed report',
  )
  writeFixture(
    root,
    'TODO/backend-platform-part-04-incidents-read-api.md',
    '# Part 04',
  )
  writeFixture(
    root,
    'docs/backend-platform/part-04-incidents-read-api-report.md',
    '# Incidents report',
  )
  writeFixture(
    root,
    'TODO/backend-platform-part-05-supabase-storage-source-cache.md',
    '# Part 05',
  )
  writeFixture(
    root,
    'docs/backend-platform/part-05-supabase-storage-source-cache-report.md',
    '# Source cache report',
  )
  writeFixture(
    root,
    'TODO/backend-platform-part-06-safe-fetch.md',
    '# Part 06',
  )
  writeFixture(
    root,
    'docs/backend-platform/part-06-safe-fetch-report.md',
    '# SafeFetch report',
  )
  writeFixture(root, 'tmp/storage-smoke/source.txt', 'temporary bytes')
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
  assert.ok(entries.includes('.gitignore'))
  assert.ok(entries.includes('.nvmrc'))
  assert.ok(entries.includes('.node-version'))
  assert.ok(entries.includes('apps/api/src/main.ts'))
  assert.ok(entries.includes('apps/api/src/health/health.module.ts'))
  assert.ok(entries.includes('apps/api/src/incidents/incidents.module.ts'))
  assert.ok(entries.includes('apps/api/src/sources/sources.module.ts'))
  assert.ok(entries.includes('apps/api/src/sources/sources.service.ts'))
  assert.ok(entries.includes('apps/api/src/sources/sources.controller.ts'))
  assert.ok(entries.includes('apps/api/src/sources/storage/storage.port.ts'))
  assert.ok(entries.includes('apps/api/src/common/http/safe-fetch.module.ts'))
  assert.ok(entries.includes('apps/api/src/common/http/safe-fetch/safe-fetch.service.ts'))
  assert.ok(entries.includes('apps/api/src/common/http/safe-fetch/safe-url.ts'))
  assert.ok(entries.includes('apps/api/src/common/http/safe-fetch/public-ip.ts'))
  assert.ok(entries.includes('apps/api/src/common/http/safe-fetch/node-dns-resolver.service.ts'))
  assert.ok(entries.includes('apps/api/src/common/http/safe-fetch/node-https-transport.service.ts'))
  assert.ok(entries.includes('apps/api/src/common/http/safe-fetch/response-cache.ts'))
  assert.ok(
    entries.includes(
      'apps/api/src/sources/storage/supabase-storage.service.ts',
    ),
  )
  assert.ok(entries.includes('apps/api/test/incidents/incidents.mapper.spec.ts'))
  assert.ok(entries.includes('apps/api/test/incidents/incidents.http.e2e-spec.ts'))
  assert.ok(entries.includes('apps/api/test/incidents-read-db.e2e-spec.ts'))
  assert.ok(entries.includes('apps/api/test/sources/sources.http.e2e-spec.ts'))
  assert.ok(entries.includes('apps/api/test/sources/sources.service.spec.ts'))
  assert.ok(entries.includes('apps/api/test/source-cache-db.e2e-spec.ts'))
  assert.ok(entries.includes('apps/api/test/safe-fetch/safe-url.spec.ts'))
  assert.ok(entries.includes('apps/api/test/safe-fetch/public-ip.spec.ts'))
  assert.ok(entries.includes('apps/api/test/safe-fetch/node-https-transport.spec.ts'))
  assert.ok(entries.includes('packages/contracts/src/index.ts'))
  assert.ok(entries.includes('scripts/verify-api-clean-start.mjs'))
  assert.ok(entries.includes('scripts/verify-prisma-clean-db.mjs'))
  assert.ok(entries.includes('scripts/disposable-database-guard.mjs'))
  assert.ok(entries.includes('scripts/disposable-database-guard.test.mjs'))
  assert.ok(entries.includes('apps/api/prisma/schema.prisma'))
  assert.ok(entries.includes('apps/api/prisma/seed.ts'))
  assert.ok(entries.includes('apps/api/prisma/seed/verified-data.schemas.ts'))
  assert.ok(entries.includes('apps/api/prisma/seed/verified-data.loader.ts'))
  assert.ok(entries.includes('apps/api/prisma/seed/verified-seed.service.ts'))
  assert.ok(entries.includes('scripts/verify-verified-seed.mjs'))
  assert.ok(entries.includes('scripts/verify-investigation-data.mjs'))
  assert.ok(entries.includes('scripts/verify-supabase-storage.mjs'))
  assert.ok(entries.includes('scripts/verify-safe-fetch.mjs'))
  assert.ok(entries.includes('scripts/verify-kazhydromet-ingestion.mjs'))
  assert.ok(entries.includes('scripts/verify-gdelt-ingestion.mjs'))
  assert.ok(entries.includes('apps/api/src/ingestion/ingestion.module.ts'))
  assert.ok(entries.includes('apps/api/src/ingestion/ingestion.controller.ts'))
  assert.ok(entries.includes('apps/api/src/ingestion/ingestion-token.guard.ts'))
  assert.ok(entries.includes('apps/api/src/ingestion/kazhydromet/kazhydromet.adapter.ts'))
  assert.ok(entries.includes('apps/api/src/ingestion/kazhydromet/pdf-text.service.ts'))
  assert.ok(entries.includes('apps/api/test/ingestion/kazhydromet-discovery.spec.ts'))
  assert.ok(entries.includes('apps/api/test/kazhydromet-ingestion-db.e2e-spec.ts'))
  assert.ok(entries.includes('apps/api/src/ingestion/gdelt/gdelt.adapter.ts'))
  assert.ok(entries.includes('apps/api/src/ingestion/gdelt/gdelt-query.ts'))
  assert.ok(entries.includes('apps/api/src/ingestion/gdelt/gdelt.schemas.ts'))
  assert.ok(entries.includes('apps/api/src/ingestion/direct-sources/direct-source-registry.ts'))
  assert.ok(entries.includes('apps/api/src/ingestion/direct-sources/direct-source.adapter.ts'))
  assert.ok(entries.includes('apps/api/src/ingestion/article/article-text.service.ts'))
  assert.ok(entries.includes('apps/api/src/ingestion/article/article-document-identity.ts'))
  assert.ok(entries.includes('apps/api/src/live/live.module.ts'))
  assert.ok(entries.includes('apps/api/test/ingestion/gdelt/gdelt-query-adapter.spec.ts'))
  assert.ok(entries.includes('apps/api/test/ingestion/direct-sources/direct-source-registry.spec.ts'))
  assert.ok(entries.includes('apps/api/test/ingestion/direct-sources/direct-source-region.service.spec.ts'))
  assert.ok(entries.includes('apps/api/test/ingestion/article/article-text.service.spec.ts'))
  assert.ok(entries.includes('apps/api/test/live/live.spec.ts'))
  assert.ok(entries.includes('apps/api/test/gdelt-ingestion-db.e2e-spec.ts'))
  assert.ok(entries.includes('TODO/backend-platform-part-08-gdelt-direct-live-status.md'))
  assert.ok(entries.includes('docs/backend-platform/part-08-gdelt-direct-live-status-report.md'))
  assert.ok(!entries.includes('apps/api/test/ingestion/gdelt/raw-gdelt-response.json'))
  assert.ok(!entries.includes('apps/api/test/ingestion/article/article-body.txt'))
  assert.ok(entries.includes('apps/api/src/llm/llm.service.ts'))
  assert.ok(entries.includes('apps/api/src/llm/disabled-llm.provider.ts'))
  assert.ok(!entries.includes('apps/api/src/llm/gemini-llm.provider.ts'))
  assert.ok(!entries.includes('scripts/verify-gemini-free-tier.mjs'))
  assert.ok(entries.includes('TODO/backend-platform-part-07-kazhydromet-ingestion.md'))
  assert.ok(entries.includes('docs/backend-platform/part-07-kazhydromet-ingestion-report.md'))
  assert.ok(!entries.includes('apps/api/test/ingestion/downloaded-source.pdf'))
  assert.ok(!entries.includes('apps/api/test/ingestion/raw-response.html'))
  assert.ok(!entries.includes('apps/api/test/ingestion/parser-debug.json'))
  assert.ok(entries.includes('data/verified/manifest.json'))
  assert.ok(entries.includes('data/verified/atyrau-2025-09.json'))
  assert.ok(
    entries.includes('docs/backend-investigation/part-02-investigation-report.md'),
  )
  assert.ok(entries.includes('docs/backend-investigation/prisma-schema-request.md'))
  assert.ok(
    entries.includes(
      'apps/api/prisma/migrations/20260804000000_initial_schema/migration.sql',
    ),
  )
  assert.ok(
    entries.includes(
      'apps/api/prisma/migrations/20260804160000_harden_provenance/migration.sql',
    ),
  )
  assert.ok(
    entries.includes(
      'apps/api/prisma/migrations/20260805170000_station_relation_evidence/migration.sql',
    ),
  )
  assert.ok(
    entries.includes(
      'apps/api/prisma/migrations/20260805200000_source_independent_station_relations/migration.sql',
    ),
  )
  assert.ok(
    entries.includes(
      'apps/api/prisma/migrations/20260805220000_relation_evidence_page_dedup/migration.sql',
    ),
  )
  assert.ok(entries.includes('apps/api/src/prisma/prisma.module.ts'))
  assert.ok(
    entries.includes('TODO/backend-platform-part-02-prisma-supabase-readiness.md'),
  )
  assert.ok(
    entries.includes(
      'docs/backend-platform/part-02-prisma-supabase-readiness-report.md',
    ),
  )
  assert.ok(!entries.some((entry) => entry.startsWith('apps/web/')))
  assert.ok(entries.includes('packages/investigation-core/src/index.ts'))
  assert.ok(entries.includes('packages/investigation-core/test/investigation-core.spec.ts'))
  assert.ok(entries.includes('data/fixtures/investigation/temp.json'))
  assert.ok(entries.includes('data/fixtures/investigation/api/dossier-september.html'))
  assert.ok(entries.includes('apps/api/src/investigations/investigations.module.ts'))
  assert.ok(entries.includes('apps/api/src/replays/replays.module.ts'))
  assert.ok(entries.includes('apps/api/src/export/export.module.ts'))
  assert.ok(entries.includes('apps/api/test/integration/investigation-integration-db.e2e-spec.ts'))
  assert.ok(entries.includes('scripts/generate-investigation-samples.mjs'))
  assert.ok(entries.includes('TODO/backend-platform-integration-01-platform-investigation.md'))
  assert.ok(entries.includes('docs/backend-platform/integration-01-platform-investigation-report.md'))
  assert.ok(entries.includes('apps/api/prisma/migrations/20260806010000_integrate_investigation_persistence/migration.sql'))
  assert.ok(!entries.some((entry) => entry.includes('/temp-fixtures/')))
  assert.ok(!entries.some((entry) => entry.startsWith('apps/api/src/generated/')))
  assert.ok(
    entries.includes('TODO/backend-platform-part-03-verified-seed.md'),
  )
  assert.ok(
    entries.includes(
      'docs/backend-platform/part-03-verified-seed-report.md',
    ),
  )
  assert.ok(entries.includes('TODO/backend-platform-part-04-incidents-read-api.md'))
  assert.ok(
    entries.includes(
      'docs/backend-platform/part-04-incidents-read-api-report.md',
    ),
  )
  assert.ok(
    entries.includes('TODO/backend-platform-part-05-supabase-storage-source-cache.md'),
  )
  assert.ok(
    entries.includes(
      'docs/backend-platform/part-05-supabase-storage-source-cache-report.md',
    ),
  )
  assert.ok(entries.includes('TODO/backend-platform-part-06-safe-fetch.md'))
  assert.ok(
    entries.includes('docs/backend-platform/part-06-safe-fetch-report.md'),
  )
  assert.ok(!entries.includes('apps/api/test/safe-fetch/response-body.dump'))
  assert.ok(!entries.includes('apps/api/test/safe-fetch/dns-debug.json'))
  assert.ok(!entries.includes('apps/api/test/safe-fetch/cache-dump.bin'))
  assert.ok(!entries.some((entry) => entry.startsWith('tmp/')))
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
