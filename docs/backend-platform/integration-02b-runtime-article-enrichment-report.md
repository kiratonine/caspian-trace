# Integration 02B — Runtime Article Enrichment

## Result

- accepted article runtime hook: COMPLETE
- transient signal candidates: COMPLETE
- bounded enrichment counters: COMPLETE
- Prisma candidate persistence: NOT IMPLEMENTED
- external LLM transport: NOT IMPLEMENTED

## Acceptance boundary

Enrichment runs only after:

- parser success;
- explicit requested-region match;
- pollution relevance match;
- direct-source publication time match.

## Failure policy

- null candidate does not fail ingestion;
- provider or validation failure does not fail ingestion;
- enrichment failure increments only `enrichmentFailedCount`;
- ingestion run status and source health remain source/parser based;
- no raw provider error is persisted.

## Persistence boundary

Only these counters may be written to run metadata:

- `enrichmentAttemptedCount`;
- `enrichmentCandidateCount`;
- `enrichmentFailedCount`.

Candidate bodies, excerpts, quotes and source text are transient.

## Verification

### Typecheck

Command:

`npm run typecheck -w api`

Result:

- PASS

### Lint

Command:

`npm run lint -w api`

Result:

- PASS
- Errors: 0
- Warnings: 0

### GDELT/article unit suite

Command:

`npm run test:gdelt`

Result:

- PASS
- Test suites: <ACTUAL>
- Tests: <ACTUAL>
- Snapshots: <ACTUAL>

### Full API unit suite

Command:

`npm run test -w api`

Result:

- PASS
- Test suites: <ACTUAL>
- Tests: <ACTUAL>
- Skipped: <ACTUAL>

### API HTTP e2e

Command:

`npm run test:e2e:api`

Result:

- PASS
- Test suites: <ACTUAL>
- Tests: <ACTUAL>

### Disposable PostgreSQL GDELT e2e

Command:

`npm run test:gdelt:clean`

Result:

- PASS
- Test suites: <ACTUAL>
- Tests: <ACTUAL>

### Build

Command:

`npm run build -w api`

Result:

- PASS

### Archive tests

Commands:

`node --test scripts/create-backend-platform-archive.test.mjs`

`npm run test:database-guard`

Result:

- archive allowlist/security: 6/6 PASS
- disposable database guard: 3/3 PASS

### Git validation

Command:

`git diff --check`

Result:

- PASS

## Artifact

- Archive: `caspian-trace-backend-platform-clean-<NEW_TIMESTAMP>.tar.gz`
- External LLM provider transport: NOT IMPLEMENTED
- Prisma migration: NOT REQUIRED

## Next

Integration 02C may add a real provider transport only after a separate
Backend 2 review of timeout, quota, prompt and secret handling.