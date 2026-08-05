import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
require('reflect-metadata')

const { ExportService } = require('../apps/api/dist/export/export.service.js')
const { FileInvestigationRepository } = require('../apps/api/dist/investigations/file-investigation.repository.js')
const { InvestigationsService } = require('../apps/api/dist/investigations/investigations.service.js')
const { ReplaysRepository } = require('../apps/api/dist/replays/replays.repository.js')
const { ReplaysService } = require('../apps/api/dist/replays/replays.service.js')
const { runInvestigation } = require('../packages/investigation-core/dist/index.js')

const id = 'inv-atyrau-2025-09'
const repository = new FileInvestigationRepository()
const investigations = new InvestigationsService(repository, repository)
const replays = new ReplaysService(investigations, new ReplaysRepository())
const exporter = new ExportService(investigations)

const evidence = await investigations.getEvidenceGraph(id)
const replay = await replays.start(id)
const dossier = await exporter.buildDossierModel(id)
dossier.generatedAt = null
assert.ok(replay.steps.at(-1).offsetMs >= 25_000)
assert.ok(replay.steps.at(-1).offsetMs <= 30_000)

const outputDir = resolve(
  root,
  'data',
  'fixtures',
  'investigation',
  'api',
)
const fixtureDir = resolve(root, 'data', 'fixtures', 'investigation')
await mkdir(outputDir, { recursive: true })
const goldenWrites = [
  ['september-input.json', 'september-golden.json'],
  ['may-input.json', 'may-golden.json'],
  ['aktau-input.json', 'aktau-golden.json'],
].map(async ([inputName, outputName]) => {
  const input = JSON.parse(
    await readFile(resolve(fixtureDir, inputName), 'utf8'),
  )
  return writeJson(resolve(fixtureDir, outputName), runInvestigation(input))
})
await Promise.all([
  ...goldenWrites,
  writeJson(resolve(outputDir, 'evidence-september.json'), evidence),
  writeJson(resolve(outputDir, 'replay-september.json'), replay),
  writeJson(resolve(outputDir, 'dossier-september.json'), dossier),
  writeFile(
    resolve(outputDir, 'dossier-september.html'),
    `${exporter.renderHtml(dossier)}\n`,
    'utf8',
  ),
])
console.log(`Generated stable investigation API samples in ${outputDir}`)

function writeJson(path, value) {
  return writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}
