# Backend Platform Part 05 — immutable Supabase Storage source cache

## 1. Результат

Part 05 runtime и data-consistency path реализованы:

```text
trusted bytes -> SHA-256 -> deterministic private Storage object
             -> controlled SourceDocument attachment
             -> short-lived signed URL -> 302
```

Техническая реализация, unit/HTTP/disposable-DB tests, regressions Part 01–04 и
реальный private Supabase Storage smoke завершены. Bucket `source-documents`
одноразово создан через Storage management API с `public=false`, лимитом 15 MiB
и MIME allowlist; runtime API не создаёт и не меняет bucket. Smoke реально проверил
upload, duplicate rejection, signed read, SHA/byte equality и exact-path cleanup.
Shared PostgreSQL содержит `0` SourceDocument с `cachePath`; production snapshots
не выдумывались и не backfill-ились.

## 2. Preflight

- Ветка: `feat/backend-platform`.
- Исходный commit: `e0f0174 feat(api): add incidents read endpoints`.
- Исходное рабочее дерево: чистое.
- Node `v20.20.2`, npm `10.8.2`.
- Прочитаны root `AGENTS.md`, TODO/reports Part 01–04, platform role и P5 sections
  roadmap, текущие config/HTTP/Swagger/Prisma/schema/migrations/seed/incidents и
  clean DB/archive scripts.
- Part 03 production gate остаётся `0/2 BLOCKED`; Part 04 implementation завершена.
- Перед финальной contract-коррекцией рабочее дерево содержало только ожидаемый
  незакоммиченный scope Part 05; повторный preflight подтвердил ту же ветку и Node.
- Frontend, Backend 2, `packages/investigation-core/**` и `data/verified/**` не менялись.
- Commit/push/pull/merge/rebase/reset/clean не выполнялись.

## 3. Изменённые файлы

Runtime/config:

- `apps/api/package.json` — exact Node-20-compatible `@supabase/supabase-js@2.95.3`,
  HTTP и DB source-cache test scripts.
- `package-lock.json` — npm-generated dependency graph.
- `package.json` — `test:sources:clean` и `test:supabase:storage`.
- `apps/api/.env.example` — `SOURCE_SIGNED_URL_TTL_SECONDS=120` placeholder.
- `apps/api/src/config/environment.ts` — required server-only Storage config,
  TTL/size bounds и secret-safe startup validation.
- `apps/api/test/config.spec.ts`, `apps/api/test/set-env.ts` — Storage config tests
  и non-secret test environment.
- `apps/api/src/app.module.ts` — подключён `SourcesModule` после существующих modules.
- `scripts/verify-api-clean-start.mjs` — non-secret Storage placeholders для clean start.

Sources feature:

- `apps/api/src/sources/sources.module.ts` — feature module и singleton port binding.
- `apps/api/src/sources/sources.controller.ts` — `GET /source-documents/:id/open`.
- `apps/api/src/sources/sources.service.ts` — cache/open use cases.
- `apps/api/src/sources/sources.repository.ts` — explicit Prisma selects и controlled
  serializable attachment transaction.
- `apps/api/src/sources/source-snapshot.ts` — pure media/SHA/path/integrity logic.
- `apps/api/src/sources/sources.errors.ts`, `sources.types.ts` — stable errors/internal types.
- `apps/api/src/sources/dto/open-source.dto.ts` — id/page validation.
- `apps/api/src/sources/storage/storage.constants.ts`, `storage.types.ts`,
  `storage.port.ts`, `storage.errors.ts` — server-side Storage boundary.
- `apps/api/src/sources/storage/supabase-storage.service.ts` — singleton private
  Supabase Storage adapter и legacy/new SDK error classifiers.

Tests/operations:

- `apps/api/test/sources/source-snapshot.spec.ts` — path/media/PDF/size/integrity.
- `apps/api/test/sources/supabase-storage.service.spec.ts` — immutable SDK behavior,
  duplicate/not-found legacy/new shapes и negative arbitrary-400 cases.
- `apps/api/test/sources/storage-provider.spec.ts` — singleton port binding.
- `apps/api/test/sources/sources.service.spec.ts` — conflicts/idempotency/recovery/open.
- `apps/api/test/sources/sources.http.e2e-spec.ts` — 302/headers/errors/page/Swagger.
- `apps/api/test/source-cache-db.e2e-spec.ts` — disposable PostgreSQL source-cache e2e.
- `scripts/verify-prisma-clean-db.mjs` — guarded `--sources-only` mode.
- `scripts/verify-supabase-storage.mjs` — private bucket immutable smoke with exact-path cleanup.
- `scripts/create-backend-platform-archive.mjs` и `.test.mjs` — Part 05 allowlist/assertions.
- `docs/backend-platform/part-05-supabase-storage-source-cache-report.md` — этот отчёт.

Prisma schema и все пять applied migrations не менялись.

## 4. Storage architecture

`SourcesModule` создаёт один default-scope `SupabaseStorageService` и связывает
его с symbol token `SOURCE_STORAGE` через `useExisting`. `SourcesService`
зависит только от `SourceStoragePort`; SDK client наружу не экспортируется.

Client создаётся один раз с `persistSession:false`, `autoRefreshToken:false`,
`detectSessionInUrl:false`. Service role читается только из server ConfigService.
В source-cache коде нет Data API calls, `getPublicUrl` и browser client.

Свежий SDK `2.109.0` в первом HTTP прогоне потребовал native WebSocket Node 22
даже для создания клиента. Он заменён на exact `2.95.3`, который объявляет
Node `>=20` и сохраняет Node-compatible transport transitively. Дополнительная
direct dependency `ws` не добавлялась; runtime использует только `.storage`.

## 5. Immutability

- SHA-256 вычисляется только внутри API по фактическим bytes.
- Path: `{sourceType}/{yyyy}/{mm}/{sha256}.{extension}`; title, URL, filename и
  document ID в имени объекта не участвуют.
- `publishedPeriod` имеет приоритет; иначе используются UTC year/month `fetchedAt`.
- Поддержаны PDF/HTML/JSON/TXT; content type parameters нормализуются.
- PDF должен начинаться с `%PDF-`; bytes non-empty и не больше `HTTP_MAX_BYTES`.
- Supabase upload всегда передаёт `upsert:false`, immutable cache control и только
  SHA/document ID metadata.
- Duplicate определяется только по HTTP 409 либо точному Storage token
  `Duplicate`, `ResourceAlreadyExists`, `KeyAlreadyExists`, `already_exists` в
  legacy/new `error`/`code`/`status`/`statusCode`; arbitrary HTTP 400 не считается
  duplicate. После классификации объект скачивается и повторно хэшируется.
  Mismatch -> `STORAGE_IMMUTABILITY_VIOLATION`.
- Existing `sha256`/`cachePath` никогда не заменяются; конфликт fail-closed 409.

## 6. DB consistency

Порядок строго Storage-first, DB-second. После upload repository открывает
serializable Prisma transaction, повторно читает SourceDocument explicit select,
снова проверяет SHA/path и выполняет conditional `updateMany`. Изменяются только
`sha256`, `cachePath`, `fetchedAt`, `httpStatus`; verification status сохраняется.

Если DB падает после upload, объект не удаляется: content-addressed orphan безопасен,
а retry получает duplicate, проверяет SHA и прикрепляет тот же path. DB e2e реально
проверил этот recovery. DB никогда не получает pointer до Storage success.

## 7. Open endpoint

`GET /api/source-documents/:id/open?page=N`:

- читает только `id/mediaType/sha256/cachePath/status`;
- не probe-ит и не открывает `originalUrl`;
- проверяет persisted path/hash/media extension;
- создаёт signed URL с TTL из env (`30..600`, default `120`);
- возвращает `302`, `Cache-Control: private, no-store`,
  `Referrer-Policy: no-referrer`;
- для PDF добавляет client fragment `#page=N`; non-PDF page -> 400;
- missing document/cache -> normalized 404.

Swagger документирует id/page и 302/400/404/500/503 без secret/token examples.

## 8. Security

- Bucket должен быть private; smoke fail-closed проверяет `public=false` до upload.
- Service role и signed URL не логируются и не сохраняются в PostgreSQL.
- SDK raw errors не выходят в HTTP; endpoint получает stable 503.
- Not-found аналогично распознаёт numeric/string HTTP 404 и точный allowlist
  legacy/new tokens; arbitrary HTTP 400 остаётся stable 503.
- Raw SDK error, service role и signed URL не пишутся в logs/error responses;
  signed URL используется только как обязательный `302 Location` endpoint-а.
- Нет public URL, `getPublicUrl`, signed upload URL, Data API или frontend client.
- Smoke использует `smoke-tests/part05/<uuid>/<sha>.txt`, удаляет только точный
  созданный path в `finally` и проверяет отсутствие после cleanup.
- Disposable DB использует только `test-part05-*`; Supabase-like DB URL и запуск
  без explicit disposable flags отклоняются до connection.

## 9. Tests

| Команда | Статус | Фактический результат |
|---|---:|---|
| Git/Node preflight | PASS | `feat/backend-platform`; ожидаемый незакоммиченный Part 05 diff; Node `v20.20.2`, npm `10.8.2`. |
| `npm ci --include=optional` | PASS | exit 0; только прежний dev-only `@prisma/streams-local` Node 22 warning. |
| Prisma format/validate/generate | PASS | Schema valid; Prisma Client 7.6.0 generated; migration/schema diff отсутствует. |
| `npm run prisma:migrate:status` | PASS | Shared PostgreSQL: 5 migrations, up to date. |
| API typecheck/lint/unit/build | PASS | 12 suites, 143/143 unit tests; typecheck/lint/build exit 0. |
| `npm run test:e2e:api` | PASS | 3 suites, 34/34 HTTP e2e. |
| `npm run test:e2e:api-process` | PASS | Compiled unavailable-DB process 1/1. |
| `npm run test:sources:clean` | PASS | Fresh PostgreSQL 16; 5 migrations/no drift; source DB e2e 7/7. |
| `npm run test:database-guard` | PASS | 3/3. |
| `npm run test:supabase:storage` | PASS | Private bucket; immutable upload; duplicate rejected; signed HTTPS read; exact bytes/SHA; exact-path cleanup. |
| `npm run test:incidents:clean` | PASS | Part 04 DB e2e 8/8. |
| `npm run test:seed:clean` | PASS | Part 03 DB e2e 11/11. |
| `npm run test:prisma:clean` | PASS | Foundation DB e2e 10/10; migration/status/no drift; clean-start also re-run separately. |
| `npm run test:api-clean-start` | PASS | Fresh DB; production and development compiled API live/ready. |
| `npm run test:supabase:readiness` | PASS | Shared read-only DB smoke 2/2. |
| `verify:investigation-data` / `seed:validate` | PASS | Structure valid; 2 docs/9 measurements/4 relations; writes 0. |
| `verify:investigation-data:human` | BLOCKED | Expected exit 1: human review `0/2`. |
| root typecheck/lint/test/build | PASS | API/contracts/frontend; API 143/143, contracts 26/26, only existing Vite chunk warning. |
| archive tests / creation | PASS | Archive tests 6/6; clean archive содержит 127 allowlisted files. |
| `git diff --check` | PASS | Whitespace errors отсутствуют. |

Первый HTTP e2e с SDK `2.109.0` был FAIL из-за Node-22-only WebSocket initialization;
после exact Node-20-compatible pin финальный результат 34/34 PASS. Первый smoke
script invocation не нашёл workspace-local package из root; resolution переведён
на API package boundary. В начале финальной коррекции реальный project ещё возвращал
пустой bucket list, поэтому первый smoke был FAIL `SUPABASE_SOURCE_BUCKET_NOT_FOUND`.
После одноразового создания именно private `source-documents` metadata проверены,
а два последующих smoke run завершились PASS. Raw SDK errors/credentials при
диагностике не выводились.

## 10. Manual verification

Фактически применённый одноразовый setup:

```text
Name: source-documents
Public bucket: OFF
Max file size: 15728640
Allowed MIME: application/pdf, text/html, application/json, text/plain
```

После setup:

```bash
nvm use
npm run test:supabase:storage
```

Для cached row endpoint проверяется только через NestJS:

```bash
curl -i 'http://localhost:3000/api/source-documents/DOCUMENT_ID/open?page=22'
```

Текущий shared document без cache честно вернёт
`404 SOURCE_SNAPSHOT_NOT_AVAILABLE`; ручные production DB writes не выполнялись.

## 11. Production data status

- Real Storage service-role access: PASS.
- Private `source-documents` bucket: **PASS / present / public=false**.
- Shared SourceDocument rows с `cachePath != null`: `0`.
- Cached source IDs: `[]`.
- Production source snapshots: **NOT YET CACHED**; зависит от manual bucket setup
  и будущего controlled ingestion/cache backfill.

## 12. Known limitations

- Production caching ещё не выполнялся: Part 05 принимает trusted bytes, а ingestion
  начинается только в следующих частях.
- SafeFetch/external URL probe не реализованы (Part 06).
- PDF parser/SourcePage extraction и source cache backfill не реализованы.
- Original URL availability fallback намеренно отсутствует до SafeFetch.

## 13. Archive

- Файл: `artifacts/caspian-trace-backend-platform-clean-2026-08-05T16-28-19-853Z.tar.gz`.
- Состав: `127` allowlisted files.
- Включает Part 01–05 platform source/tests/TODO/reports и Storage smoke script.
- Исключает `.env`, keys, signed downloads, temp smoke objects, generated client,
  node_modules/dist/coverage/artifacts, frontend и Backend 2 code.

## 14. Handoff

Part 06/SafeFetch передаёт доверенные downloaded bytes:

```text
fetchBuffer(...) -> cacheExistingSourceSnapshot(...)
```

SafeFetch не должен передавать caller-supplied SHA/path; их вычисляет Part 05.
Frontend открывает source только через NestJS endpoint и не получает Supabase key/client.

Infrastructure owner: сохранять `source-documents` private и не включать runtime
auto-provisioning. Smoke можно безопасно повторять: cleanup ограничен его точным path.

## 15. Git status

Работа выполнена в `feat/backend-platform`. Commit/push/pull/merge/rebase не
выполнялись. Финальный status приводится в ответе Codex.

## Выполненные этапы Backend 1

- [x] Part 01 — NestJS platform/contracts.
- [x] Part 02 — Prisma/Supabase foundation/readiness.
- [x] Part 03 implementation — verified seed.
- [ ] Part 03 production gate — BLOCKED: human review `0/2`.
- [x] Part 04 — incidents read API.
- [x] Part 05 implementation — immutable Supabase source cache.
- [x] Part 05 real Storage infrastructure — private bucket и real smoke PASS.
- [ ] Production source cache population — ingestion dependency.
- [ ] Part 06 — SafeFetch.
- [ ] Part 07+ — Kazhydromet/GDELT ingestion.
