import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const ALLOWED_FILES = [
  '.gitignore',
  '.node-version',
  '.nvmrc',
  'AGENTS.md',
  'package.json',
  'package-lock.json',
  'apps/api/package.json',
  'apps/api/nest-cli.json',
  'apps/api/tsconfig.json',
  'apps/api/tsconfig.build.json',
  'apps/api/.env.example',
  'apps/api/prisma.config.ts',
  'apps/api/src/main.ts',
  'apps/api/src/app.module.ts',
  'scripts/create-backend-platform-archive.mjs',
  'scripts/create-backend-platform-archive.test.mjs',
  'scripts/verify-api-clean-start.mjs',
  'scripts/verify-prisma-clean-db.mjs',
  'scripts/verify-verified-seed.mjs',
  'scripts/verify-investigation-data.mjs',
  'scripts/verify-supabase-storage.mjs',
  'scripts/verify-safe-fetch.mjs',
  'scripts/verify-kazhydromet-ingestion.mjs',
  'scripts/verify-gdelt-ingestion.mjs',
  'scripts/disposable-database-guard.mjs',
  'scripts/disposable-database-guard.test.mjs',
  'docs/backend-investigation/part-02-investigation-report.md',
  'docs/backend-investigation/prisma-schema-request.md',
  '.github/workflows/ci.yml',
  'supabase/config.toml',
]

const ALLOWED_DIRECTORIES = [
  'apps/api/prisma',
  'apps/api/src/config',
  'apps/api/src/prisma',
  'apps/api/src/health',
  'apps/api/src/incidents',
  'apps/api/src/sources',
  'apps/api/src/ingestion',
  'apps/api/src/live',
  'apps/api/src/common/http',
  'apps/api/test',
  'packages/contracts',
  'docs/backend-platform',
  'data/verified',
]

const FORBIDDEN_PREFIXES = [
  '.git',
  '.claude',
  '.cursor',
  '.agents',
  'keys',
  'secrets',
  'artifacts',
  'tmp',
  'apps/web',
  'packages/investigation-core',
  'apps/api/src/generated',
  'apps/api/prisma/generated',
  'apps/api/src/investigations',
  'apps/api/src/replays',
  'apps/api/src/export',
  'apps/api/src/llm',
]

const FORBIDDEN_SEGMENTS = new Set([
  'node_modules',
  'dist',
  'coverage',
  'temp-fixtures',
])

export function normalizeArchivePath(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '')
}

export function isForbiddenArchivePath(value) {
  const normalized = normalizeArchivePath(value)
  const segments = normalized.split('/')

  if (!normalized || normalized.startsWith('../') || normalized === '..') return true
  if (FORBIDDEN_SEGMENTS.size > 0 && segments.some((segment) => FORBIDDEN_SEGMENTS.has(segment))) {
    return true
  }
  if (
    FORBIDDEN_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
    )
  ) {
    return true
  }
  if (normalized === 'CLAUDE.md' || normalized.endsWith(':Zone.Identifier')) return true
  if (normalized.endsWith('.log') || basename(normalized) === '.DS_Store') return true

  const filename = basename(normalized)
  const publicSourceDump =
    /^(?:gdelt-(?:raw|response|payload)|article-(?:body|text|snapshot|raw))(?:[.-]|$)/i.test(filename) &&
    !/\.(?:ts|mjs|md)$/i.test(filename)
  if (
    filename.endsWith('.dump') ||
    filename.endsWith('.pdf') ||
    filename.endsWith('.har') ||
    filename.endsWith('.html') ||
    /^(?:raw|source-body|downloaded-source)(?:[.-]|$)/i.test(filename) ||
    /^(?:dns-debug|response-body|cache-dump|parser-debug)(?:[.-]|$)/i.test(filename) ||
    publicSourceDump
  ) {
    return true
  }
  if (filename === '.env.example') return false
  return filename === '.env' || filename.startsWith('.env.')
}

function isInsideRepository(repositoryRoot, absolutePath) {
  const relativePath = relative(realpathSync(repositoryRoot), realpathSync(absolutePath))
  return relativePath !== '..' && !relativePath.startsWith(`..${sep}`)
}

export function findRepositoryRoot(startPath = process.cwd()) {
  let current = resolve(startPath)
  if (!lstatSync(current).isDirectory()) current = dirname(current)

  while (true) {
    const packagePath = join(current, 'package.json')
    try {
      if (lstatSync(packagePath).isFile()) return current
    } catch {
      // Continue walking towards the filesystem root.
    }

    const parent = dirname(current)
    if (parent === current) throw new Error('Repository root was not found')
    current = parent
  }
}

function collectFile(repositoryRoot, relativePath, entries) {
  const normalized = normalizeArchivePath(relativePath)
  if (isForbiddenArchivePath(normalized)) return

  const absolutePath = join(repositoryRoot, normalized)
  let stat
  try {
    stat = lstatSync(absolutePath)
  } catch {
    return
  }
  if (stat.isSymbolicLink() || !stat.isFile()) return
  if (!isInsideRepository(repositoryRoot, absolutePath)) return
  entries.add(normalized)
}

function walkAllowedDirectory(repositoryRoot, relativeDirectory, entries) {
  const normalized = normalizeArchivePath(relativeDirectory)
  if (isForbiddenArchivePath(normalized)) return

  const absoluteDirectory = join(repositoryRoot, normalized)
  let stat
  try {
    stat = lstatSync(absoluteDirectory)
  } catch {
    return
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) return
  if (!isInsideRepository(repositoryRoot, absoluteDirectory)) return

  for (const child of readdirSync(absoluteDirectory).sort()) {
    const childRelativePath = normalizeArchivePath(`${normalized}/${child}`)
    const childAbsolutePath = join(repositoryRoot, childRelativePath)
    const childStat = lstatSync(childAbsolutePath)
    if (childStat.isSymbolicLink() || isForbiddenArchivePath(childRelativePath)) continue
    if (childStat.isDirectory()) {
      walkAllowedDirectory(repositoryRoot, childRelativePath, entries)
    } else if (childStat.isFile()) {
      collectFile(repositoryRoot, childRelativePath, entries)
    }
  }
}

function collectMatchingFiles(repositoryRoot, directory, predicate, entries) {
  const absoluteDirectory = join(repositoryRoot, directory)
  let children
  try {
    children = readdirSync(absoluteDirectory)
  } catch {
    return
  }

  for (const child of children.sort()) {
    if (predicate(child)) collectFile(repositoryRoot, `${directory}/${child}`, entries)
  }
}

export function collectArchiveEntries(repositoryRoot) {
  const entries = new Set()
  for (const file of ALLOWED_FILES) collectFile(repositoryRoot, file, entries)
  for (const directory of ALLOWED_DIRECTORIES) {
    walkAllowedDirectory(repositoryRoot, directory, entries)
  }
  collectMatchingFiles(
    repositoryRoot,
    'apps/api',
    (name) => name.startsWith('eslint.config.'),
    entries,
  )
  collectMatchingFiles(
    repositoryRoot,
    'TODO',
    (name) =>
      name.endsWith('.md') &&
      name.includes('backend-platform') &&
      name.includes('part'),
    entries,
  )

  const sortedEntries = [...entries].sort()
  const forbiddenEntry = sortedEntries.find(isForbiddenArchivePath)
  if (forbiddenEntry !== undefined) {
    throw new Error(`Forbidden archive entry: ${forbiddenEntry}`)
  }
  return sortedEntries
}

export function createBackendPlatformArchive({
  repositoryRoot = findRepositoryRoot(),
  now = new Date(),
} = {}) {
  const entries = collectArchiveEntries(repositoryRoot)
  if (entries.length === 0) throw new Error('Archive allowlist resolved to no files')

  const artifactDirectory = join(repositoryRoot, 'artifacts')
  mkdirSync(artifactDirectory, { recursive: true })
  const timestamp = now.toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const archivePath = join(
    artifactDirectory,
    `caspian-trace-backend-platform-clean-${timestamp}.tar.gz`,
  )
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'caspian-trace-archive-'))
  const fileListPath = join(temporaryDirectory, 'files.list')

  try {
    writeFileSync(fileListPath, `${entries.join('\0')}\0`)
    const result = spawnSync(
      'tar',
      [
        '--create',
        '--gzip',
        '--file',
        archivePath,
        '--directory',
        repositoryRoot,
        '--null',
        '--files-from',
        fileListPath,
      ],
      { encoding: 'utf8' },
    )
    if (result.error) throw result.error
    if (result.status !== 0) {
      throw new Error(`tar failed (${result.status}): ${result.stderr.trim()}`)
    }
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }

  return { archivePath, entries }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  try {
    const { archivePath, entries } = createBackendPlatformArchive()
    console.log(`${archivePath}\n${entries.length} files`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Archive creation failed')
    process.exitCode = 1
  }
}
