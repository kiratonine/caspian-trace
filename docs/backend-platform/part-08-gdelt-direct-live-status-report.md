# Backend Platform Part 08 — GDELT, direct sources and live status

## 1. Result

- GDELT/direct raw article ingestion — **COMPLETE**. `POST /api/admin/ingestion/gdelt` is protected by the existing constant-time token guard, accepts only a bounded window/region/limits, and does not accept a URL or query.
- GDELT live smoke — **FAILED upstream, handled honestly**. The run remained `FAILED`; no stale GDELT response was available and GDELT health was not promoted.
- Direct fallback — **PASS**. Three curated Atyrau articles were fetched through `SafeFetchService` and retained as private immutable snapshots. Only the September Zakon article was accepted for the September request; the October Kazinform article and undated Ak Zhaiyk article were excluded.
- Region-aware relevance correction — **PASS**. Article acceptance now requires a pollution marker plus a marker for one of the requested regions. A raw snapshot is retained when the article belongs to another region, but that document is excluded from accepted fallback/GDELT results.
- GDELT top-level validation correction — **PASS**. Missing `articles` and error-shaped objects fail closed as `GDELT_RESPONSE_INVALID`; explicit `{ "articles": [] }` remains a valid no-results response.
- Direct temporal correction — **PASS**. Direct fallback accepts only exact source-derived `publishedAt` inside the inclusive request window. Out-of-window and unknown dates retain provenance but cannot satisfy fallback.
- Live source status — **COMPLETE**. `GET /api/live/status` returns the existing `LiveStatusSchema` shape for Kazhydromet, GDELT and direct sources without internal health details.
- Structured LLM extraction — **NOT INTEGRATED**. Part 08 creates no `IncidentSignal`, `Measurement`, or `Investigation` rows.

## 2. Preflight

- Branch: `feat/backend-platform` (confirmed before and after implementation).
- Starting commit / Part 07: `be657fd feat(api): add Kazhydromet document ingestion`.
- Runtime: Node `v20.20.2`, npm `10.8.2`.
- Initial Part 08 worktree was clean; this correction started from the existing uncommitted Part 08 implementation.
- No pull, merge, cherry-pick, rebase, commit, or push was performed. No content was imported from `feat/backend-investigation`.

## 3. Changed files

Configuration and wiring:

- `apps/api/.env.example` — placeholder-only GDELT/direct-source settings.
- `apps/api/package.json` — Part 08 unit, HTTP and DB e2e scripts.
- `apps/api/src/app.module.ts` — connects the new `LiveModule` only.
- `apps/api/src/config/environment.ts` — strict GDELT endpoint/cache/limit and exact direct-host/fallback validation.
- `apps/api/src/ingestion/ingestion.module.ts` — singleton adapters/services and shared ingestion clock.
- `apps/api/src/ingestion/ingestion.constants.ts` — injectable clock used by both ingestion flows.
- `apps/api/src/ingestion/ingestion.controller.ts` — protected GDELT route and complete Swagger request/response description.
- `apps/api/src/ingestion/dto/run-gdelt-ingestion.dto.ts` — strict UTC window, region and limit DTO.
- `apps/api/src/ingestion/ingestion.errors.ts` — safe stable public-ingestion errors.
- `apps/api/src/ingestion/ingestion.types.ts` — internal GDELT/direct run result types.
- `apps/api/src/ingestion/ingestion.repository.ts` — explicit-select run, health and controlled SourceDocument persistence.

GDELT/direct/article implementation:

- `apps/api/src/ingestion/gdelt/gdelt-query.ts` — fixed DOC 2.0 query via `URL`/`URLSearchParams`.
- `apps/api/src/ingestion/gdelt/gdelt.schemas.ts` — Zod response/item schemas.
- `apps/api/src/ingestion/gdelt/gdelt.types.ts` — discovery transport types.
- `apps/api/src/ingestion/gdelt/gdelt.adapter.ts` — SafeFetch, actual-URL authorization, validation, sorting/dedup and bounds.
- `apps/api/src/ingestion/gdelt/gdelt-ingestion.service.ts` — GDELT/direct orchestration and honest run/health semantics.
- `apps/api/src/ingestion/direct-sources/direct-source-registry.ts` — exact Tier 1/2 media registry and coverage.
- `apps/api/src/ingestion/direct-sources/direct-source.adapter.ts` — env-only fallback candidate and region filtering.
- `apps/api/src/ingestion/direct-sources/direct-source.service.ts` — bounded sequential processing plus inclusive exact-publication-time classification.
- `apps/api/src/ingestion/article/article-url.ts` — credential-free HTTPS parsing and tracking-parameter canonicalization.
- `apps/api/src/ingestion/article/article-document-identity.ts` — deterministic versioned identity from canonical URL plus content SHA.
- `apps/api/src/ingestion/article/article.types.ts` — internal candidate/extraction/provenance types.
- `apps/api/src/ingestion/article/article-text.service.ts` — strict UTF-8, bounded DOM extraction, source-derived title/date and deterministic relevance metadata.
- `apps/api/src/ingestion/article/article-ingestion.service.ts` — SafeFetch → SourceDocument → private immutable snapshot → parser pipeline.
- `apps/api/src/sources/sources.service.ts` — validates and reuses an already attached immutable path when later publication metadata changes the derivable year/month.

Live API:

- `apps/api/src/live/live.types.ts` — explicit repository projection.
- `apps/api/src/live/live.repository.ts` — bounded Prisma health select.
- `apps/api/src/live/live.mapper.ts` — fixed source registry and explicit enum mapper.
- `apps/api/src/live/live.service.ts` — `LiveStatusSchema` runtime validation.
- `apps/api/src/live/live.controller.ts` — public Swagger endpoint.
- `apps/api/src/live/live.module.ts` — live feature module.

Tests and operational scripts:

- `apps/api/test/config.spec.ts` — GDELT/direct env positive and negative cases.
- `apps/api/test/set-env.ts`, `apps/api/test/safe-fetch/test-environment.ts` — deterministic Part 08 test configuration.
- `apps/api/test/ingestion/gdelt/gdelt-query-adapter.spec.ts` — fixed query, Zod and untrusted-domain tests.
- `apps/api/test/ingestion/gdelt/gdelt-ingestion.service.spec.ts` — fresh/stale/429/direct health semantics.
- `apps/api/test/ingestion/gdelt/gdelt-live.http.e2e-spec.ts` — auth, DTO/errors, Swagger and live HTTP contract.
- `apps/api/test/ingestion/direct-sources/direct-source-registry.spec.ts` — exact registry and region coverage.
- `apps/api/test/ingestion/direct-sources/direct-source-region.service.spec.ts` — region and temporal fallback filtering, including matched/mismatch/unknown batches.
- `apps/api/test/ingestion/article/article-url-identity.spec.ts` — URL canonicalization and deterministic versioning.
- `apps/api/test/ingestion/article/article-text.service.spec.ts` — UTF-8/title/date/text/relevance bounds.
- `apps/api/test/ingestion/article/article-ingestion.service.spec.ts` — snapshot-before-parser and redirect/region safety.
- `apps/api/test/live/live.spec.ts` — fixed order, enum mapping and contract validation.
- `apps/api/test/gdelt-ingestion-db.e2e-spec.ts` — disposable PostgreSQL persistence/idempotency/429/health/no-domain-writes.
- `apps/api/test/sources/sources.service.spec.ts` — immutable attached-path regression.
- `scripts/verify-gdelt-ingestion.mjs` — real/cache-backed Nest context smoke.
- `scripts/verify-api-clean-start.mjs` — Part 08 clean-start env.
- `scripts/verify-prisma-clean-db.mjs` — isolated `--gdelt-only` disposable DB path.
- `package.json` — root Part 08 scripts.
- `scripts/create-backend-platform-archive.mjs`, `scripts/create-backend-platform-archive.test.mjs` — Part 08 allowlist and raw article/GDELT dump exclusions.
- `docs/backend-platform/part-08-gdelt-direct-live-status-report.md` — this report.

No Prisma schema/migration, contracts, `data/verified/**`, frontend, Backend 2, or LLM file was changed.

## 4. Architecture

`GdeltAdapter` owns the fixed DOC 2.0 query and SafeFetch/Zod boundary. It authorizes the actual article URL hostname through the exact registry and ignores GDELT's `domain` field. `DirectSourceAdapter` can only read curated URLs from validated server env. Both feed `ArticleIngestionService`, which creates a deterministic unverified SourceDocument, stores bytes through the existing `SourcesService`, and only then invokes `ArticleTextService`.

`ArticleTextService` receives the requested regions and reports only matching requested-region markers. Atyrau markers are Атырау/Atyrau, Жайык/Жайық and Урал/Ural River; Mangystau markers are Актау/Aktau and Мангистау/Маңғыстау/Mangystau. Каспий/Caspian are shared geography markers and cannot establish either region. Relevance requires both a requested-region match and a pollution marker.

Controllers remain transport-only. Persistence is centralized in `IngestionRepository` with the existing singleton `PrismaService` and explicit selects. GDELT and direct fallback use separate `IngestionRun` and `SourceHealth` records. The NestJS best-practices guidance influenced the thin controller/module/provider split; Prisma client guidance influenced explicit projections and repository-only DB access.

Temporal filtering is deliberately confined to `DirectSourceService`. It consumes the already normalized request window and the parser's exact source-derived `publishedAt`; it does not infer dates from URL, title, GDELT `seendate`, or fetch time. The GDELT-discovered article flow is unchanged.

## 5. GDELT

- Endpoint: exactly `https://api.gdeltproject.org/api/v2/doc/doc`; its exact host must be present in `GDELT_ALLOWED_HOSTS`.
- Parameters: fixed `query`, `mode=artlist`, `format=json`, `maxrecords<=25`, `sort=datedesc`, `startdatetime`, `enddatetime`.
- Request: strict timezone-Z instants, ordered interval, at most 31 days and not beyond five minutes in the future.
- Cache: SafeFetch TTL 1,800 seconds; stale-if-error 86,400 seconds. Stale `429` remains `rate_limited` even when cached articles are processable.
- Top-level validation is fail-closed: `articles` is required. `{}` and `{ "error": "..." }` become the safe `GDELT_RESPONSE_INVALID`; raw payloads and Zod issues are not persisted. `{ "articles": [] }` is valid and updates successful no-results health.
- Latest real result: `FAILED`, `lastHttpStatus=null`, `cacheAvailable=false`, `consecutiveErrors=7`, safe detail `GDELT_INGESTION_FAILED: GDELT ingestion failed`, and no `lastSuccessAt`. No raw upstream error or response was persisted.

## 6. Direct sources

Tier 1: Kazhydromet, Kazinform, gov.kz, Ak Zhaiyk, AtyrauPress, Lada.kz, InAktau.kz, Tumba. Tier 2: Mangystau Media, Uralsk Week, Moy Gorod, Diapazon and Zakon.kz. Canonical and `www` aliases are enumerated explicitly; there is no wildcard or suffix authorization.

The validated default host list contains 26 exact hostnames. Curated env fallbacks used by the smoke were Zakon.kz, Kazinform and Ak Zhaiyk. Candidates are filtered by requested region against fixed coverage, deduplicated canonically, limited to two per domain and ten per run (the smoke requested three). Direct success creates/updates only the `direct-sources` row and cannot change GDELT health.

Latest real direct result: health `HEALTHY`, HTTP 200, `cacheAvailable=true`, `consecutiveErrors=0`; run `PARTIAL`, fetched/snapshotted 3, accepted 1, temporal mismatch 1, temporal unknown 1, rejected 0.

Coverage authorization and content relevance are intentionally separate. National hosts can be requested for both regions, but their parsed content is accepted only when `matchedRequestedRegions` intersects the request. A Mangystau request therefore cannot accept default Atyrau Zakon/Kazinform fallbacks; an Aktau/Mangystau article can be accepted. A mismatch still produces an immutable SourceDocument/Storage snapshot for auditability.

Temporal outcome is also separate from health. An exact `publishedAt` inside inclusive `[from,to]` is `matched`; an exact date outside is `mismatch`; `publishedAt=null` is `unknown`. Mismatch/unknown are not transport or SourceHealth errors. When at least one document matches and another is temporally excluded, the direct run is `PARTIAL` while source health remains `HEALTHY`.

## 7. Article provenance

These are raw discovery articles, not verified incident evidence.

| SourceDocument | Publisher / discovery | Original and canonical URL | SHA / private cache path | Parser/date/relevance |
|---|---|---|---|---|
| `doc-article-azh-kz-91a6bc43c8ee-b39d67a1d916` | Ak Zhaiyk / `direct_fallback` | `https://azh.kz/ru/news/view/120575` | `b39d67a1d9168226418e08f0d8b6d4afd26e9963e933f793a4cf8a2fd3982be4`; `public_article/2026/08/b39d67a1d9168226418e08f0d8b6d4afd26e9963e933f793a4cf8a2fd3982be4.html` | parser succeeded; date mode `none`, `publishedAt=null`; temporal `unknown`, snapshot retained, not accepted |
| `doc-article-inform-kz-55a968d19109-18340c2821fd` | Kazinform / `direct_fallback` | `https://www.inform.kz/ru/v-stochnih-vodah-atirau-obnaruzheni-ostatki-nefteproduktov-adef40` | `18340c2821fd951959d05b3e5f6fbd9382b28d416aac6a9875ba81fbb178f76f`; `public_article/2026/08/18340c2821fd951959d05b3e5f6fbd9382b28d416aac6a9875ba81fbb178f76f.html` | parser succeeded; `json_ld`, `2025-10-08T21:10:00.000Z`; temporal `mismatch`, snapshot retained, not accepted |
| `doc-article-zakon-kz-c02a101ad5c9-c735c254c384` | Zakon.kz / `direct_fallback` | `https://www.zakon.kz/obshestvo/6490267-v-atyrau-zelenaya-voda-v-reke-okazalas-sledom-neftyanogo-zagryazneniya.html` | `c735c254c38461d1d89cbb297212369a5b7c079010f3a3c65cd2f278e1e326ec`; `public_article/2026/08/c735c254c38461d1d89cbb297212369a5b7c079010f3a3c65cd2f278e1e326ec.html` | parser succeeded; `article_published_time`, `2025-09-09T10:16:00.000Z`; temporal `matched`, relevance true, accepted |

Only bounded hashes/counts/modes/keyword lists are stored in extraction metadata. Full article text remains only in the private raw HTML snapshot. GDELT `seendate` is discovery metadata and never becomes `publishedAt`.

## 8. Immutability and idempotency

- Identity is `doc-article-{host}-{canonical-url-hash-prefix}-{content-sha-prefix}`.
- Same canonical URL and bytes reuse the SourceDocument and private object; changed bytes create another version and do not overwrite the first.
- P2002 convergence re-reads and verifies immutable identity for concurrent creation races.
- Snapshot upload/DB attachment completes before parsing; parser failure leaves the raw object and a safe failed parser status.
- A successful parser result for the wrong requested region is stored with `matchedRequestedRegions=[]`, but is not counted or returned as an accepted region-matched document.
- Direct temporal mismatch/unknown snapshots remain immutable and queryable by provenance, but only temporal `matched` documents enter `acceptedCount` and the response.
- A discovered publication month may appear after first cache attachment. The existing path is now structurally validated against source type/media/SHA and reused, preventing a false path conflict without weakening hash/path verification.

## 9. Runs and health

- GDELT and direct fallback always use distinct adapters, run IDs and health IDs.
- A fresh valid GDELT response can be healthy; a stale degraded response is degraded; stale/no-stale 429 remains `RATE_LIMITED`; no accepted response on another failure is `FAILED`.
- Direct success never overwrites GDELT status. The latest real smoke demonstrated `gdelt=FAILED` together with `direct-sources=HEALTHY`, direct run `PARTIAL`, and top-level `partial`.
- A malformed top-level GDELT response records a failed run/health with `actualError=true`, increments errors, and does not update `lastSuccessAt`; explicit empty articles is a clean success.
- `cacheAvailable` is durable through prior accepted runs. Actual errors increment `consecutiveErrors`; clean successes reset only their own health row.
- Error details are stable safe strings; raw SDK/network errors are neither logged nor persisted.

## 10. Live API

The fixed public order is `kazhydromet-bulletins`, `gdelt`, `direct-sources`. `LiveRepository` selects only source ID, status, last success and cache availability. `live.mapper.ts` explicitly maps Prisma enum values. `LiveService` validates the final value using `LiveStatusSchema`; the public response exposes no detail, HTTP code, consecutive error count or metadata.

Manual response on the compiled API was HTTP 200. In the latest smoke, Kazhydromet remained healthy/cache true, GDELT was failed/cache false, and direct sources were healthy/cache true.

## 11. Tests

| Command / scope | Result |
|---|---|
| `npm ci --include=optional` | **PASS** — 1,093 packages installed; npm reported 4 moderate and 2 high audit findings without changing the requested scope |
| Prisma format / validate / generate | **PASS** |
| Supabase `prisma migrate status` | **PASS** — five migrations, schema up to date; no Part 08 migration |
| `npm run test:gdelt` | **PASS** — 8 suites, 45 tests |
| `npm run test -w api` | **PASS** — 33 suites, 361 tests |
| `npm run test:e2e:api` | **PASS** — 5 suites, 57 tests |
| `npm run test:e2e:api-process` | **PASS** — 1 test |
| `npm run test:gdelt:clean` | **PASS** — clean migrations/status/no drift; 9 DB e2e tests, including temporal filtering and no domain writes |
| `npm run test:gdelt:smoke` | **PASS** — 3 direct snapshots retained, September Zakon accepted; direct run `PARTIAL`, GDELT honestly `FAILED` |
| `npm run test:api-clean-start` | **PASS** — compiled production and development starts on disposable PostgreSQL |
| `npm run test:kazhydromet` / `:clean` / `:smoke` | **PASS** — 45 unit, 7 DB e2e; real September smoke 32 pages/7 candidates, human review still 0/2 |
| `npm run test:safe-fetch` / `:smoke` | **PASS** — 95 tests; real Kazhydromet HTML 200/108,463 bytes |
| `npm run test:sources:clean` | **PASS** — 7 DB e2e tests |
| `npm run test:supabase:storage` | **PASS** — private upload, duplicate verification, signed read, SHA and exact cleanup |
| `npm run test:incidents:clean` | **PASS** — 8 DB e2e tests |
| `npm run test:seed:clean` | **PASS** — 11 DB e2e tests |
| `npm run test:prisma:clean` | **PASS** — 10 DB e2e plus clean production/development start |
| `npm run test:supabase:readiness` | **PASS** — 2 read-only tests |
| `npm run test:database-guard` | **PASS** — 3 tests |
| contracts typecheck/test/build | **PASS** — 26 tests |
| API typecheck/lint/build | **PASS** |
| workspace typecheck/lint/test/build | **PASS** — includes unchanged frontend typecheck/lint/build; frontend build completed with an existing chunk-size warning |
| `npm run test:archive` | **FAIL** — такого npm script в workspace нет; использована фактическая команда archive tests ниже |
| archive test / create | **PASS** — 6 archive tests; 211 allowlisted files |

## 12. Manual verification

Copyable commands (with `BASE_URL=http://127.0.0.1:3098`):

```bash
curl -sS -i "$BASE_URL/api/live/status"
curl -sS -i -X POST -H 'Content-Type: application/json' \
  --data '{"from":"2025-09-01T00:00:00Z","to":"2025-09-30T23:59:59Z","regions":["atyrau"],"maxRecords":25,"maxArticles":3,"includeDirectFallback":true}' \
  "$BASE_URL/api/admin/ingestion/gdelt"
curl -sS -i "$BASE_URL/api/fetch?url=https://example.com"
```

Actual compiled API results: live status `200`; missing ingestion token `401 INGESTION_UNAUTHORIZED`; non-existent public fetch route `404 ROUTE_NOT_FOUND`. Valid token execution was covered by HTTP e2e and the real Nest-context smoke; the token itself was never printed.

## 13. Security

- Request DTO has no query/URL field and global validation rejects unknown fields.
- GDELT and article requests use only `SafeFetchService`; no direct fetch/axios transport was added.
- Every hostname is exact. Redirects are revalidated by SafeFetch; GDELT `domain` is ignored.
- Raw HTML is written to private Storage before parser; bucket is not made public and no public URL method is used.
- Raw body, service role key, ingestion token and signed URL are not logged or returned.
- Full article text is not stored in DB metadata or the clean archive.

## 14. Known limitations

- The latest real GDELT request failed without stale cache; its honest failed health remains visible while direct fallback retains raw provenance and accepts only the in-window Zakon article.
- SafeFetch last-success cache is process-local.
- The bounded DOM parser does not execute JavaScript or bypass paywalls.
- There is no scheduler, queue, Open-Meteo integration, structured LLM extraction or automatic signal creation.
- npm audit reported six dependency findings; no out-of-scope forced dependency upgrade was attempted.

## 15. Backend 2 handoff

No merge performed in Part 08.

Future additive integration:
SourcesService.readCachedSourceSnapshot
→ ArticleTextService.extract
→ LlmService.extractIncidentSignal

Backend 1 retains ownership of:
AppModule
environment
Prisma
contracts
package manifests/lock

## 16. Archive

Final archive: `artifacts/caspian-trace-backend-platform-clean-2026-08-05T23-13-50-000Z.tar.gz` (211 files). The allowlist includes Part 01–08 Backend 1 source/tests/report/TODO and excludes `.env`, secrets, raw GDELT/HTML/article dumps, generated Prisma client, `dist`, `coverage`, artifacts, frontend, investigation-core and Backend 2 modules.

## 17. Git status

Branch remains `feat/backend-platform`. The worktree contains only the uncommitted Part 08 implementation/report and the scoped immutable-cache regression. No Git history-changing or remote operation was performed.

## Выполненные этапы Backend 1

- [x] Part 01 — NestJS platform/contracts
- [x] Part 02 — Prisma/Supabase foundation
- [x] Part 03 implementation — verified seed
- [ ] Part 03 production gate — human review, still blocked at 0/2
- [x] Part 04 — incidents read API
- [x] Part 05 — immutable source cache
- [x] Part 06 — SafeFetchService
- [x] Part 07 — Kazhydromet document ingestion
- [x] Part 08 — GDELT/direct raw articles/live status
- [ ] Structured LLM extraction — Backend 2 handoff
- [ ] Automated IncidentSignal creation — intentionally disabled
