# Part 09 — Live status and ingestion administration

Date: 2026-08-06

## Result

- Status: COMPLETE
- Public live status endpoint: COMPLETE
- Kazhydromet administration endpoint: COMPLETE
- GDELT administration endpoint: COMPLETE
- Ingestion token protection: COMPLETE
- Centralized source-health persistence: COMPLETE
- Disposable PostgreSQL verification: PASS
- Queue/Redis: NOT ADDED
- Prisma schema change: NOT REQUIRED
- Database migration: NOT REQUIRED

## Scope

P09 covers:

- `GET /api/live/status`
- `POST /api/admin/ingestion/kazhydromet`
- `POST /api/admin/ingestion/gdelt`
- `X-Ingestion-Token` authorization
- source attempt tracking
- source success tracking
- degraded-source tracking
- source failure tracking
- rate-limit tracking
- durable cache visibility
- stable public source ordering

No queue, Redis, cron worker, second PostgreSQL client, or direct
frontend-to-Supabase access was added.

## Public endpoints

### Live status

```http
GET /api/live/status
```

The endpoint returns the three registered sources in stable order:

1. `kazhydromet-bulletins`
2. `gdelt`
3. `direct-sources`

The response exposes only the public contract:

- source ID;
- display name;
- last successful response timestamp;
- cache availability;
- public health status.

Internal fields are not exposed:

- `detail`;
- `metadata`;
- `consecutiveErrors`;
- internal database source IDs;
- upstream exception data.

### Kazhydromet administration

```http
POST /api/admin/ingestion/kazhydromet
X-Ingestion-Token: <token>
```

### GDELT administration

```http
POST /api/admin/ingestion/gdelt
X-Ingestion-Token: <token>
```

Both POST endpoints require the configured `X-Ingestion-Token`.

Missing or invalid credentials return the stable API error shape:

```json
{
  "code": "INGESTION_UNAUTHORIZED",
  "message": "Invalid ingestion credentials",
  "requestId": "<request-id>"
}
```

The configured token is not returned in API errors or logs.

## Architecture

The final source-health write path is:

```text
Kazhydromet / GDELT / direct-source ingestion
                    |
                    v
           SourceHealthService
                    |
                    v
         SourceHealthRepository
                    |
                    v
                  Prisma
                    |
                    v
          PostgreSQL source_health
```

The read path is:

```text
GET /api/live/status
          |
          v
      LiveService
          |
          v
 SourceHealthService.getAll()
          |
          v
 SourceHealthRepository
          |
          v
        Prisma
```

`IngestionRepository` no longer reads or writes the `source_health`
table.

There is one application persistence implementation for source health:

```text
apps/api/src/sources/source-health/source-health.repository.ts
```

## Registered sources

### Kazhydromet

Internal database ID:

```text
kazhydromet
```

Public API ID:

```text
kazhydromet-bulletins
```

Display name:

```text
Казгидромет: ежемесячные бюллетени
```

### GDELT

Internal and public ID:

```text
gdelt
```

Display name:

```text
GDELT DOC 2.0
```

### Direct public sources

Internal and public ID:

```text
direct-sources
```

Display name:

```text
Прямые публичные источники
```

The registry acts as an allowlist and defines stable API ordering.

## SourceHealthService operations

Implemented operations:

```ts
SourceHealthService.startAttempt(sourceId, at?)
SourceHealthService.markSuccess(sourceId, input)
SourceHealthService.markFailure(sourceId, input)
SourceHealthService.markRateLimited(sourceId, input)
SourceHealthService.getAll()
```

## Transition semantics

### startAttempt

`startAttempt`:

- creates a missing source row as `NEVER_RUN`;
- updates `lastAttemptAt`;
- preserves the previous status;
- preserves `lastSuccessAt`;
- preserves cache availability;
- does not reset error counters.

### markSuccess

`markSuccess`:

- sets `HEALTHY` for a normal usable response;
- may set `DEGRADED` for usable partial data;
- updates `lastAttemptAt`;
- updates `lastSuccessAt`;
- resets `consecutiveErrors` to zero;
- updates HTTP and cache state;
- merges metadata instead of replacing unrelated metadata.

### markFailure

`markFailure`:

- sets `FAILED` when no usable response exists;
- sets `DEGRADED` when fallback data remains usable;
- increments `consecutiveErrors`;
- preserves the previous `lastSuccessAt` for an unusable failure;
- may update `lastSuccessAt` when cached fallback data was successfully
  used;
- stores only a safe error code and safe message;
- does not store stack traces or secrets.

### markRateLimited

`markRateLimited`:

- preserves the explicit `RATE_LIMITED` status;
- increments `consecutiveErrors`;
- does not convert an empty 429 response into success;
- may update `lastSuccessAt` when stale cached data was usable;
- preserves cache availability;
- stores `retryAt` in metadata only when it is available.

## Kazhydromet semantics

Kazhydromet now uses `SourceHealthService` for every source-health
transition.

### Successful bulletin processing

Result:

```text
run status: SUCCEEDED
source health: HEALTHY
```

### Parser partial without an upstream error

When a snapshot is valid and usable but the parser produces partial
results without an actual upstream failure:

```text
run status: PARTIAL
source health: DEGRADED
actual source error: false
```

This does not increment the source error counter.

### Origin unavailable with cached snapshot

When the origin is unavailable but a cached immutable snapshot is
successfully used:

```text
run status: PARTIAL
source health: DEGRADED
cache available: true
usable response: true
```

The error counter increments, while `lastSuccessAt` reflects the usable
cached response.

### Rate limiting

A Kazhydromet rate limit remains:

```text
source health: RATE_LIMITED
```

It is not treated as proof that no bulletin or event exists.

## GDELT semantics

GDELT has an independent source-health row.

### Healthy response with accepted articles

```text
run status: SUCCEEDED
source health: HEALTHY
```

### Valid empty GDELT response

A valid response with no matching allowed articles can produce:

```text
run status: FAILED
source health: HEALTHY
```

The run failed to find usable investigation input, but the source itself
responded successfully.

Run outcome and upstream source health are intentionally separate.

### Stale response after 429

When GDELT is rate limited but stale cached results are usable:

```text
run status: RATE_LIMITED
source health: RATE_LIMITED
usable response: true
cache available: true
```

`lastSuccessAt` may be updated, but the upstream 429 is not hidden.

### Invalid response or unusable failure

```text
source health: FAILED
usable response: false
```

### Optional enrichment failure

Optional LLM signal enrichment failure does not change GDELT source
health when ingestion and provenance persistence succeeded.

```text
LLM enrichment failure != public source failure
```

Only enrichment counters are persisted in the ingestion run metadata.
Transient signal candidates and article bodies are not persisted by
source-health administration.

## Direct-source semantics

Direct public sources use their own source ID:

```text
direct-sources
```

A successful direct fallback never overwrites the GDELT source status.

Example:

```text
GDELT health: RATE_LIMITED
direct-source health: HEALTHY
top-level ingestion result: PARTIAL
```

### Temporal exclusions

A successfully fetched article can be excluded because:

- it is outside the requested period;
- its publication time is not sufficiently precise.

These exclusions may make the direct ingestion run `PARTIAL`, but do not
automatically make the source unhealthy.

```text
direct run: PARTIAL
direct source health: HEALTHY
actual source error: false
```

## Persistence guarantees

`SourceHealthRepository` provides:

- explicit Prisma `select`;
- allowlisted source IDs;
- atomic transition updates;
- metadata merge;
- deterministic error-counter updates;
- preservation of `lastSuccessAt` on unusable failure;
- support for usable cached responses with degraded or rate-limited
  source status.

No unsafe raw SQL is used.

No additional database client was added.

## Cleanup

Removed the old source-health persistence methods from
`IngestionRepository`:

```text
markHealthAttempt
finalizeHealth
markPublicHealthAttempt
finalizePublicHealth
```

The old dedicated live repository and live internal row type were also
removed after the live read path moved to `SourceHealthService`.

Repository search confirms that application Prisma access to
`source_health` is centralized in:

```text
apps/api/src/sources/source-health/source-health.repository.ts
```

## Tests

### SourceHealthService unit tests

Verified:

- registered source names;
- healthy success;
- degraded usable success;
- failure transitions;
- rate-limit transitions;
- retry timestamp metadata;
- registered-source reads.

Result:

```text
PASS
```

### SourceHealthRepository unit tests

Verified:

- attempt creation without state reset;
- metadata merge;
- success error-counter reset;
- failure error-counter increment;
- preservation of `lastSuccessAt`;
- usable stale cache with `RATE_LIMITED`;
- explicit Prisma read selection.

Result:

```text
PASS
```

### Live status unit tests

Verified:

- stable three-source ordering;
- missing rows mapped to `never_run`;
- explicit enum mapping;
- no internal fields in the public response;
- one source-health read per request;
- final Zod contract validation.

Result:

```text
PASS
```

### Kazhydromet unit tests

Verified:

- successful health transition;
- usable parser partial;
- parser failure;
- origin failure with cached snapshot;
- rate limiting;
- no-candidate failure;
- cache availability;
- safe error messages.

Result:

```text
PASS
```

### GDELT/direct unit tests

Verified:

- healthy GDELT ingestion;
- stale 429 response;
- no-stale 429 response;
- direct fallback independence;
- mixed temporal coverage;
- invalid GDELT schema;
- valid empty response;
- parser failure;
- optional enrichment failure;
- transient candidate behavior.

Result:

```text
PASS
```

### HTTP API e2e

Verified:

- `GET /api/live/status`;
- `POST /api/admin/ingestion/kazhydromet`;
- `POST /api/admin/ingestion/gdelt`;
- missing ingestion token returns 401;
- invalid ingestion token returns 401;
- valid ingestion token invokes the service;
- stable API error shape;
- request ID propagation;
- Swagger endpoint/header documentation;
- token value is not leaked.

Result:

```text
PASS
```

### Disposable Kazhydromet PostgreSQL e2e

The DB e2e test was migrated from the removed
`IngestionRepository` health methods to the real
`SourceHealthService`.

Verified against disposable PostgreSQL:

- `startAttempt`;
- healthy success;
- `lastAttemptAt`;
- `lastSuccessAt`;
- HTTP status persistence;
- cache availability;
- metadata persistence;
- error-counter reset;
- degraded cached success;
- error-counter increment;
- safe error detail;
- cleanup of the fixed `kazhydromet` source-health row.

The ingestion run finalization test derives `finishedAt` from the actual
PostgreSQL `startedAt`, preserving the database chronology constraint.

Result:

```text
PASS
```

### Disposable GDELT PostgreSQL e2e

Verified the real GDELT/direct persistence path through:

```text
SourceHealthService
SourceHealthRepository
Prisma
PostgreSQL
```

Result:

```text
PASS
```

## Verification commands

The following commands completed successfully:

```bash
npm run typecheck -w api
npm run lint -w api

npm run test -w api -- \
  --runTestsByPath \
  test/sources/source-health.repository.spec.ts \
  test/sources/source-health.service.spec.ts \
  test/live/live.spec.ts \
  test/ingestion/kazhydromet-ingestion.service.spec.ts \
  test/ingestion/gdelt/gdelt-ingestion.service.spec.ts

npm run test -w api
npm run test:kazhydromet
npm run test:gdelt
npm run test:e2e:api

npm run test:e2e:kazhydromet:db -w api
npm run test:kazhydromet:clean
npm run test:gdelt:clean

npm run build -w api

node --test scripts/create-backend-platform-archive.test.mjs
npm run test:database-guard

git diff --check
```

Result:

```text
PASS
```

## Architectural checks

The following obsolete methods are absent from source and tests:

```text
markHealthAttempt
finalizeHealth
markPublicHealthAttempt
finalizePublicHealth
```

No queue or Redis infrastructure was introduced.

No changes were made to:

```text
apps/api/prisma/**
packages/contracts/**
data/verified/**
packages/investigation-core/**
apps/api/src/llm/**
apps/web/**
package.json
package-lock.json
```

## Database changes

- Prisma schema changed: NO
- Migration added: NO
- Raw SQL added: NO
- Additional PostgreSQL client added: NO
- Database reset required: NO
- Verified seed required for P09 tests: NO

## Known external dependency

Verified demo seed is outside P09.

It was not used to validate source-health administration because verified
fixtures have a separate human-review workflow owned by Backend 2.

P09 does not weaken, bypass, or modify that workflow.

## Responsibility boundaries

Backend 1 owns:

- live status;
- ingestion administration;
- token protection;
- source-health persistence;
- public-source ingestion;
- PostgreSQL read/write path for source health.

Backend 1 does not:

- calculate investigation evidence level;
- calculate corridor conclusions;
- assign fault to a candidate object;
- persist unverified LLM signal candidates as verified evidence;
- modify Backend 2 verified fixtures.

## Final status

P09 is complete and ready for integration.

The public live-status response contract remains unchanged, so no
frontend migration is required.
