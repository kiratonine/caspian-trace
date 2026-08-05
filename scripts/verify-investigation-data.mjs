import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const verifiedDir = resolve(root, 'data', 'verified')
const manifest = JSON.parse(
  await readFile(resolve(verifiedDir, 'manifest.json'), 'utf8'),
)
const requireHuman = process.argv.includes('--require-human')
let minimumHumanReviewers = Number.POSITIVE_INFINITY

for (const entry of manifest.fixtures) {
  const fixture = JSON.parse(
    await readFile(resolve(verifiedDir, entry.path), 'utf8'),
  )
  assert.equal(fixture.document.sha256, entry.documentSha256)
  assert.equal(fixture.document.sourcePage, entry.sourcePage)
  const evidenceItems = fixture.measurements ?? fixture.relations
  assert.ok(Array.isArray(evidenceItems) && evidenceItems.length > 0)
  for (const evidenceItem of evidenceItems) {
    assert.equal(evidenceItem.sourceSha256, entry.documentSha256)
    assert.equal(evidenceItem.sourcePage, entry.sourcePage)
    assert.ok(evidenceItem.sourceExcerpt.length > 0)
    const humans = new Set(
      evidenceItem.checkedBy.filter(
        (reviewer) => !reviewer.startsWith('codex-automated-'),
      ),
    )
    minimumHumanReviewers = Math.min(minimumHumanReviewers, humans.size)
  }
}

const completed = Number.isFinite(minimumHumanReviewers)
  ? minimumHumanReviewers
  : 0
assert.equal(manifest.reviewPolicy.completedHumanReviewers, completed)
const isComplete = completed >= manifest.reviewPolicy.requiredHumanReviewers
assert.equal(manifest.reviewPolicy.status, isComplete ? 'complete' : 'pending')

if (requireHuman && !isComplete) {
  throw new Error(
    `Human verification is incomplete: ${completed}/${manifest.reviewPolicy.requiredHumanReviewers}`,
  )
}

console.log(
  `Investigation data verified structurally; human review ${completed}/${manifest.reviewPolicy.requiredHumanReviewers} (${manifest.reviewPolicy.status}).`,
)
