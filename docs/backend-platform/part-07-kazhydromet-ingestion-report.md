# Backend Platform Part 07 — Kazhydromet ingestion

Дата проверки: 2026-08-06. Ветка: `feat/backend-platform`.

### 1. Result

Part 07 document ingestion — **COMPLETE**. Реализован защищённый синхронный `POST /api/admin/ingestion/kazhydromet`: официальный HTML discovery → SafeFetch PDF → SHA-256 immutable Storage → `SourceDocument` → pdf.js pages → immutable `SourcePage` → relevant pages → candidate-only validation → `IngestionRun`/`SourceHealth`. Финальная correctness-коррекция сделала cached fallback region-safe и устранила ложное обнуление ошибок `SourceHealth` при partial success.

Реальный сентябрьский PDF сохранён и воспроизводимо разобран. Код намеренно не создаёт и не обновляет `Measurement`, `StationRelation`, `Investigation` или результаты Backend 2. Demo measurements по-прежнему приходят только из verified seed; human gate остаётся **0/2 BLOCKED**.

### 2. Preflight

- `git status --short --branch`: исходно clean, `feat/backend-platform...origin/feat/backend-platform`.
- `git branch --show-current`: `feat/backend-platform`.
- `git log -1 --oneline`: `90f9c9e feat(api): add SSRF-safe external fetch service`.
- Node/npm: `v20.20.2` / `10.8.2`.
- Прочитаны Part 01–06 reports/TODO, Backend Platform P7/roadmap, Prisma schema/migrations, Part 03 seed, Sources/SafeFetch, error/Swagger/disposable/archive infrastructure и read-only `data/verified/**`.
- `data/verified/manifest.json`: manifest v1, human review `0/2`, `pending`.

### 3. Changed files

- `apps/api/.env.example` — runtime Kazhydromet placeholders и token длиной не менее 32 символов.
- `apps/api/package.json` — exact `pdfjs-dist@4.10.38`, `cheerio@1.0.0`, Part 07 unit/HTTP/DB scripts.
- `package.json` — root `test:kazhydromet`, clean и smoke scripts.
- `package-lock.json` — npm-generated lock для двух exact dependencies.
- `apps/api/src/app.module.ts` — подключение `IngestionModule`.
- `apps/api/src/config/environment.ts` — strict runtime validation token/listing/hosts/limits; token удалён из future-only config.
- `apps/api/src/sources/sources.service.ts` — private verified cached-snapshot reader.
- `apps/api/src/sources/sources.types.ts` — internal cached-snapshot type.
- `apps/api/src/ingestion/ingestion.module.ts` — feature-module composition.
- `apps/api/src/ingestion/ingestion.controller.ts` — admin endpoint и Swagger.
- `apps/api/src/ingestion/ingestion-token.guard.ts` — SHA-256 digest + `timingSafeEqual` guard.
- `apps/api/src/ingestion/ingestion.repository.ts` — explicit-select Prisma persistence for documents/pages/runs/health.
- `apps/api/src/ingestion/ingestion.errors.ts` — safe stable internal errors.
- `apps/api/src/ingestion/ingestion.types.ts` — internal request/result/persistence contracts.
- `apps/api/src/ingestion/dto/run-kazhydromet-ingestion.dto.ts` — DTO validation.
- `apps/api/src/ingestion/kazhydromet/kazhydromet.adapter.ts` — SafeFetch-only HTML/PDF adapter and controlled year archive URLs.
- `apps/api/src/ingestion/kazhydromet/kazhydromet-discovery.ts` — Cheerio discovery, period/region/language filtering and dedup.
- `apps/api/src/ingestion/kazhydromet/kazhydromet-document-identity.ts` — deterministic IDs and seed-compatible Atyrau IDs.
- `apps/api/src/ingestion/kazhydromet/kazhydromet-candidates.ts` — relevant pages and conservative candidate-only validation.
- `apps/api/src/ingestion/kazhydromet/kazhydromet-ingestion.service.ts` — orchestration, cache-before-parser, fallback and status logic.
- `apps/api/src/ingestion/kazhydromet/kazhydromet.types.ts` — Zod discovery boundary and parser types.
- `apps/api/src/ingestion/kazhydromet/pdf-text.service.ts` — Node 20 pdf.js page extraction and resource cleanup.
- `apps/api/test/config.spec.ts` — Kazhydromet config/token regressions.
- `apps/api/test/set-env.ts` — test runtime values.
- `apps/api/test/safe-fetch/test-environment.ts` — typed environment fixture extension.
- `apps/api/test/sources/sources.service.spec.ts` — cached snapshot SHA/path read tests.
- `apps/api/test/ingestion/kazhydromet.adapter.spec.ts` — SafeFetch policy/signature tests.
- `apps/api/test/ingestion/kazhydromet-discovery.spec.ts` — discovery security/filter tests.
- `apps/api/test/ingestion/kazhydromet-identity.spec.ts` — deterministic identity tests.
- `apps/api/test/ingestion/kazhydromet-candidates.spec.ts` — relevant/candidate provenance tests.
- `apps/api/test/ingestion/pdf-text.service.spec.ts` — real synthetic PDF and parser-limit tests.
- `apps/api/test/ingestion/kazhydromet-ingestion.service.spec.ts` — run/cache/fallback/health tests.
- `apps/api/test/ingestion/kazhydromet.http.e2e-spec.ts` — auth/DTO/Swagger HTTP e2e.
- `apps/api/test/kazhydromet-ingestion-db.e2e-spec.ts` — disposable PostgreSQL persistence/idempotency/conflict tests.
- `scripts/verify-kazhydromet-ingestion.mjs` — real September Nest-context smoke.
- `scripts/verify-prisma-clean-db.mjs` — isolated Part 07 disposable mode.
- `scripts/verify-api-clean-start.mjs` — new required runtime env for clean start.
- `scripts/create-backend-platform-archive.mjs` — smoke allowlist and raw PDF/body exclusions.
- `scripts/create-backend-platform-archive.test.mjs` — Part 07 inclusion/exclusion regressions.
- `docs/backend-platform/part-07-kazhydromet-ingestion-report.md` — этот отчёт.

Prisma schema/migrations не изменялись. `apps/web/**`, Backend 2 и `data/verified/**` не изменялись.

### 4. Architecture

`IngestionController` содержит только transport/Swagger concerns; `IngestionTokenGuard` закрывает endpoint; `KazhydrometIngestionService` оркестрирует use case; `KazhydrometAdapter` использует только `SafeFetchService`; `IngestionRepository` использует singleton `PrismaService`; raw snapshot проходит только через существующий `SourcesService`/private Storage. `PdfTextService` изолирует pdf.js и не пишет domain facts.

Применённые NestJS/Prisma guidelines привели к feature-module границе, отдельным guard/service/repository/parser компонентам, interface-backed Storage, явным Prisma `select` и одной транзакции immutable pages + metadata.

### 5. Discovery

- Configured base: `https://www.kazhydromet.kz/ru/ecology/ezhemesyachnyy-informacionnyy-byulleten-o-sostoyanii-okruzhayuschey-sredy`.
- Официальный сайт показывает текущий год на base page; архивный year path (`…/2025`) строится только из validated `YYYY-MM`, относительно env URL, и повторно проходит SafeFetch URL/DNS/IP/redirect policy.
- Exact hosts: `kazhydromet.kz`, `www.kazhydromet.kz`; wildcard/lookalike/external host/credentials/fragment запрещены.
- Поддерживаются numeric, Russian/English и используемые официальными filenames transliterated month markers; один год не превращается в месяц.
- Выбранный сентябрьский candidate: `https://www.kazhydromet.kz/uploads/files_calendar/9344/file/68f0e81dcc3caatyrau-russ-byulleten-za-sentyabr-2025g.pdf`.
- Dedup по canonical URL; для region/period предпочитается Russian, затем confidence и lexical URL.
- Mixed-region link сужается до пересечения detected regions и `request.regions` до построения candidate/identity. Поэтому Atyrau-only request не несёт лишний Mangystau marker и сохраняет seed-compatible `doc-kazhydromet-YYYY-MM`.
- Cached fallback читает регион только из `extractionMetadata.kazhydrometDiscovery.regions`; известный точный `doc-kazhydromet-YYYY-MM` считается Atyrau. Неизвестный/повреждённый region пропускается, ID substring не используется, default в Atyrau отсутствует. Фильтрация выполняется до `maxDocuments`, поэтому unrelated cached rows не вытесняют подходящий документ.

### 6. Source identity

- Russian Atyrau monthly: `doc-kazhydromet-YYYY-MM`; подтверждены `doc-kazhydromet-2025-05` и `doc-kazhydromet-2025-09`.
- Другие region/period получают deterministic URL-hash suffix; неизвестные — URL/content hash prefixes.
- Сначала переиспользуется `(canonicalUrl, sha256)`, затем проверяется deterministic ID; Prisma `P2002` сходится повторным read/immutable comparison.
- Known ID с другим URL/SHA/period даёт `KAZHYDROMET_SOURCE_CONFLICT`.

### 7. Snapshot and page consistency

Storage upload/duplicate SHA verification и DB attach завершаются до запуска parser. Parser failure оставляет `SourceDocument.cachePath` и raw object. Cached fallback скачивает только через `SourceStoragePort`, повторно проверяет persisted path, size и SHA; mismatch даёт `STORAGE_IMMUTABILITY_VIOLATION`.

Все извлечённые pages пишутся одной Prisma transaction. Existing same hash/text — unchanged; любое отличие — `KAZHYDROMET_PAGE_CONFLICT`, без overwrite/delete. `extractionMetadata` merge сохраняет неизвестные ключи.

### 8. Parser

- `pdfjs-dist` exact `4.10.38`, engines `node >=20`; runtime `20.20.2`.
- Dynamic legacy ESM loader, `isEvalSupported:false`, worker fetch disabled, copied `Uint8Array`, no temp files/OCR.
- Реальный сентябрь: 32 pages, deterministic SHA каждого текста.
- Relevant pages (score desc/page asc): `13, 22, 26, 15, 23, 24, 27, 28, 4`; page 22 выведена из текста, не hardcoded.
- 7 validated candidate matches на page text; comma raw values сохранены, normalization строковая, station не выводится при неоднозначности.
- Candidate count не означает official/human verification и не сохраняется как `Measurement`.

### 9. Runs/health

Последний live smoke run: `SUCCEEDED`, discovered/fetched/cached/accepted/rejected = `1/1/1/1/0`, pages `32`, candidates `7/0`. `SourceHealth(kazhydromet)`: `HEALTHY`, HTTP `200`, cache available `true`, consecutive errors `0`.

При origin/SafeFetch failure с успешным cached fallback run остаётся `PARTIAL`, а health становится `DEGRADED`: сохраняются только стабильный code и безопасное generic message, `consecutiveErrors` увеличивается даже при accepted document. Raw SDK/upstream detail не пишется. `cacheAvailable` вычисляется с учётом любых уже существующих Kazhydromet snapshots в БД, но отделён от признака snapshot текущего run: старый кэш не превращает run без кандидатов в ложный `PARTIAL`.

Token, raw HTML/PDF/page bodies, parser stack, signed URL и Storage SDK errors не входят в response/run/health metadata.

### 10. Tests

| Проверка | Реальный результат |
|---|---|
| `npm ci --include=optional` | PASS; 1093 packages; 6 existing audit advisories, none in added dependencies |
| `npm run test:kazhydromet` | PASS; 6 suites, 45 tests, включая 7 correctness regressions |
| `npm run test:e2e:api` | PASS; 4 suites, 45 tests |
| `npm run test:kazhydromet:clean` | PASS; 7 DB tests, clean deploy/status/drift |
| `npm run test:kazhydromet:smoke` | PASS; live source, 32 pages, page 22, 7 candidates, fixture SHA/raw values match |
| `npm run test -w api` | PASS; 25 suites, 301 tests |
| `npm run test:e2e:api-process` | PASS; 1/1 |
| `npm run test:api-clean-start` | PASS; production and dev start on clean DB |
| `npm run test:safe-fetch` / smoke | PASS; 95 tests; HTTP 200, 108463 HTML bytes |
| `npm run test:sources:clean` | PASS; 7/7 |
| `npm run test:supabase:storage` | PASS; private upload/duplicate/signed read/SHA/exact cleanup |
| `npm run test:incidents:clean` | PASS; 8/8 |
| `npm run test:seed:clean` | PASS; 11/11; production human gate unchanged |
| `npm run test:prisma:clean` | PASS; 10/10 plus clean build/start |
| `npm run test:supabase:readiness` | PASS; 2/2 read-only |
| `npm run test:database-guard` | PASS; 3/3 |
| API typecheck/lint/build | PASS |
| Workspace typecheck/lint/test/build | PASS; API 301 + contracts 26 tests; web build regression PASS |
| Archive regression/create | PASS; 6/6, 177 allowlisted files |

Первый DB run первоначальной реализации дал FAIL только из-за фиксированного test `finishedAt`, который был раньше DB `startedAt`; тест исправлен на монотонное время, полный clean run повторён и PASS. Первый live smoke первоначальной реализации дал `KAZHYDROMET_NO_CANDIDATES`, потому что base page отдаёт только текущий год; добавлен controlled official year archive discovery, после чего полный live smoke PASS. Первый archive test обнаружил, что `raw-response.html` не блокировался ошибочным pattern; matcher исправлен, повторный run 6/6 PASS. Во время correctness-коррекции первая команда с неверным полным workspace selector завершилась `No workspaces found` до запуска checks; команды повторены с фактическим workspace `api`. Первый lint после правок нашёл два type-safety нарушения в repository mapping; они исправлены, повторные lint/typecheck и все последующие regression commands — PASS. Эти промежуточные ошибки не скрыты.

### 11. Manual verification

Воспроизводимые команды (значение token не печатается):

```bash
PORT=3197 node --env-file=apps/api/.env apps/api/dist/main.js

curl -sS -X POST http://127.0.0.1:3197/api/admin/ingestion/kazhydromet \
  -H 'Content-Type: application/json' \
  -d '{"from":"2025-09","to":"2025-09","regions":["atyrau"],"maxDocuments":1}'

curl -sS -X POST http://127.0.0.1:3197/api/admin/ingestion/kazhydromet \
  -H "X-Ingestion-Token: $INGESTION_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"from":"2025-09","to":"2025-09","regions":["atyrau"],"maxDocuments":1}'
```

Фактически: unauthenticated `401 INGESTION_UNAUTHORIZED` с requestId; authenticated `200 succeeded`, ID `doc-kazhydromet-2025-09`, pages `32`, relevant page 22 `true`, candidates `7`; source open — `302`, `Cache-Control: private, no-store`, Location присутствует и не выводился.

### 12. Real September result

- Source ID: `doc-kazhydromet-2025-09`.
- URL: `https://www.kazhydromet.kz/uploads/files_calendar/9344/file/68f0e81dcc3caatyrau-russ-byulleten-za-sentyabr-2025g.pdf`.
- SHA-256: `360390d641e3e3d2b8a6b4157b3eebdf6386cb24bee08cdf9c38a1d6f01b4fbb`.
- Cache path: `kazhydromet_bulletin/2025/09/360390d641e3e3d2b8a6b4157b3eebdf6386cb24bee08cdf9c38a1d6f01b4fbb.pdf`.
- Page count: `32`; relevant pages: `13,22,26,15,23,24,27,28,4`.
- Pending fixture page 22 и все raw values `0,234`, `0,058`, `0,054`, `0,167`, `0,066`, `0,063`, `0,067` найдены автоматически.
- Это **automated match to pending verified fixture**. Human review остаётся **0/2**, human verification не заявляется.

### 13. Known limitations

- Parser candidate-only; universal table/station inference и automatic Measurement writes намеренно отсутствуют.
- OCR и scanned-PDF fallback отсутствуют.
- pdf.js сообщает non-fatal standard-font/TrueType warnings на реальном документе; 32 pages и expected text воспроизводятся.
- GDELT и `GET /api/live/status` остаются Part 08.
- `npm audit` после clean install: 4 moderate в Prisma dev toolchain и 2 high во frontend React Router; их обновление вне Part 07 и не связано с двумя добавленными dependencies.

### 14. Archive

Финальный clean archive: `caspian-trace-backend-platform-clean-2026-08-05T20-06-23-167Z.tar.gz`, 177 allowlisted files. Excluded: `.env`, secrets/tokens, signed URLs, real PDFs, raw HTML/page dumps, parser debug JSON, generated Prisma client, `dist`, coverage, artifacts внутри архива, frontend и Backend 2 zones.

### 15. Handoff

- Part 08: GDELT + SourceHealth read API.
- Backend 2: verified seed остаётся единственным источником demo measurements; human review 0/2 необходимо завершить без bypass.
- Frontend: существующий source-open endpoint теперь открывает private cached September PDF; frontend не изменялся.

### 16. Git status

Работа выполнена в `feat/backend-platform`. Commit/push/pull/merge/rebase/reset/clean не выполнялись. Финальный worktree содержит только Part 07 и связанные Backend 1 config/tests/archive/report изменения.

### 17. Completed stages

## Выполненные этапы Backend 1

- [x] Part 01 — NestJS platform/contracts
- [x] Part 02 — Prisma/Supabase foundation
- [x] Part 03 implementation — verified seed
- [ ] Part 03 production gate — human review, 0/2 BLOCKED
- [x] Part 04 — incidents read API
- [x] Part 05 — immutable source cache
- [x] Part 06 — SafeFetchService
- [x] Part 07 — Kazhydromet document ingestion
- [ ] Automated measurement writes — intentionally disabled
- [ ] Part 08 — GDELT/live status
