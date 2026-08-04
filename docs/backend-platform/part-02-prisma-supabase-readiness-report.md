# Backend Platform Part 02 — Prisma 7 и Supabase readiness

## 1. Результат

Part 02 реализован и скорректирован. Prisma client больше не подключается к DB во время Nest bootstrap: compiled API стартует при недоступной PostgreSQL, `/api/health/live` остаётся `200`, а `/api/health/ready` возвращает normalized `503`. Readiness ограничен одновременно pg connection timeout, Prisma transaction timeout, PostgreSQL `statement_timeout` и внешним HTTP-safe timeout.

Applied initial migration не редактировалась: checksum до и после коррекции `75db4e7097b2133a1886a50d615c494034fb1c05be270392dd3fd1bbe4aed367`. Защита immutable provenance оформлена отдельной additive migration `20260804160000_harden_provenance`, проверена на чистом PostgreSQL и применена к Supabase. Итоговый migration status чистый, runtime smoke через Session Pooler прошёл.

Seed, demo rows, incidents API, Storage, ingestion и вычисления Backend 2 не создавались.

## 2. Preflight

- Ветка: `feat/backend-platform`; переключение ветки не выполнялось.
- Начальный `git status --short --branch`: `## feat/backend-platform...origin/feat/backend-platform`, рабочее дерево было чистым.
- Runtime проверок: Node `v20.20.2`, npm `11.6.1`.
- Prisma CLI/client/adapter: exact `7.6.0`; `pg` `8.22.0`.
- До правок прочитаны `AGENTS.md`, TODO Part 02, отчёт Part 01, актуальные manifests/API/contracts/tests/archive scripts и все документы `docs/context-backend-1/`: platform role, investigation role, frontend role, roadmap и spec.
- На preflight финальной коррекции присутствовал ожидаемый незакоммиченный diff ранее выполненного Part 02; он сохранён и продолжен без перезаписи.
- Локальные skills: Prisma CLI, Prisma database setup и NestJS best practices; они определили Prisma 7 custom generator, adapter-pg и singleton module lifecycle.

## 3. Изменённые файлы

- `.gitignore` — generated Prisma client исключён из Git.
- `package.json`, `package-lock.json` — root Prisma/test scripts и exact dependency graph.
- `apps/api/package.json` — Prisma lifecycle/scripts, DB e2e и Supabase smoke scripts, Prisma/pg dependencies.
- `apps/api/.env.example` — placeholders для runtime/CLI DB и bounded readiness timeout; runtime pooler пример использует libpq-compatible TLS mode.
- `apps/api/prisma.config.ts` — Prisma 7 CLI configuration через `DIRECT_URL`.
- `apps/api/prisma/schema.prisma` — полная MVP schema.
- `apps/api/prisma/migrations/migration_lock.toml` — PostgreSQL migration provider.
- `apps/api/prisma/migrations/20260804000000_initial_schema/migration.sql` — initial DDL, indexes, constraints и RLS.
- `apps/api/prisma/migrations/20260804160000_harden_provenance/migration.sql` — additive RESTRICT/composite provenance FK; initial migration не изменена.
- `apps/api/src/app.module.ts` — единственное подключение глобального `PrismaModule`.
- `apps/api/src/config/environment.ts` — обязательный runtime `DATABASE_URL`, timeout bounds и secret-safe errors.
- `apps/api/src/prisma/prisma.constants.ts` — adapter factory injection token.
- `apps/api/src/prisma/prisma-connection.ts` — точечная libpq semantics normalization для `sslmode=require` в `pg 8.22`.
- `apps/api/src/prisma/prisma.module.ts` — глобальный singleton provider и `PrismaPg` factory.
- `apps/api/src/prisma/prisma.service.ts` — lazy generated client, DB/transaction-bounded readiness и shutdown disconnect.
- `apps/api/src/health/health.controller.ts`, `health.module.ts`, `health.service.ts`, `dto/health-ready.dto.ts` — real readiness query/timeout/Swagger.
- `apps/api/eslint.config.mjs`, `apps/api/tsconfig.build.json` — generated exclusion и корректный production output layout.
- `apps/api/test/set-env.ts`, `config.spec.ts`, `prisma.spec.ts`, `health.spec.ts` — safe test env и unit coverage.
- `apps/api/test/app.e2e-spec.ts` — fast HTTP readiness e2e с provider override.
- `apps/api/test/api-process-unavailable-db.e2e-spec.ts` — compiled-process negative DB e2e: boot/live/normalized ready.
- `apps/api/test/prisma-db.e2e-spec.ts` — mandatory real PostgreSQL CRUD/constraints/RLS suite.
- `apps/api/test/supabase-readiness.e2e-spec.ts` — read-only Supabase runtime/migration/RLS smoke.
- `packages/contracts/src/schemas.ts`, `packages/contracts/test/contracts.spec.ts` — additive `HealthReadySchema`/type и regression test.
- `scripts/verify-prisma-clean-db.mjs` — disposable PostgreSQL 16 migration/DB e2e/cleanup harness.
- `scripts/verify-api-clean-start.mjs` — production/dev clean-start теперь требует disposable DB и проверяет live+ready.
- `scripts/create-backend-platform-archive.mjs`, `scripts/create-backend-platform-archive.test.mjs` — Part 02 allowlist/assertions, включая `.gitignore` и исключение generated client.
- `docs/backend-platform/part-02-prisma-supabase-readiness-report.md` — этот единственный отчёт Part 02.

`apps/web/**`, `packages/investigation-core/**`, `data/verified/**` и внутренние модули Backend 2 не изменялись.

## 4. Prisma configuration

- `prisma`, `@prisma/client`, `@prisma/adapter-pg`: exact `7.6.0`; runtime driver — `pg 8.22.0`.
- Generator: `prisma-client`, output `../src/generated/prisma`, `runtime = "nodejs"`, `moduleFormat = "cjs"` для CommonJS Nest build.
- Generated client создаётся lifecycle scripts после чистого install, игнорируется Git и archive.
- Runtime Nest читает только `DATABASE_URL`; Prisma CLI/migrations читает только `DIRECT_URL` из `prisma.config.ts`.
- `SUPABASE_SERVICE_ROLE_KEY` не участвует в Prisma connection.
- `pg 8.22` трактует bare `sslmode=require` как verify-full. Runtime добавляет `uselibpqcompat=true` только для `require`; `verify-full` не ослабляется.

## 5. Schema

Реализованы все обязательные модели: `SourceDocument`, `SourcePage`, `Station`, `StationRelation`, `Measurement`, `IncidentSignal`, `Incident`, `IncidentSignalLink`, `CandidateObject`, `Investigation`, `InvestigationMeasurement`, `InvestigationCandidateObject`, `EvidenceStatement`, `EvidenceStatementMeasurement`, `EvidenceStatementSource`, `InvestigationUnknown`, `ReplayScenario`, `ReplayStep`, `IngestionRun`, `SourceHealth`. Для contract `evidenceDocumentIds` добавлена явная `CandidateObjectSource`.

Закрытые состояния оформлены 15 Prisma enums. Prisma names — camel/PascalCase, все таблицы и колонки PostgreSQL последовательно mapped в snake_case. IDs — `String @id`/`text`, без auto-increment. Неизвестные page/date/coordinates/provenance остаются `null`; `(0,0)` запрещён. Measurement хранит `Decimal(18,6)` и отдельный `rawValueText`; relation IDs не спрятаны в JSON.

Добавлены explicit joins, FK/onDelete, provenance uniques, partial unique current investigation и read indexes для measurements, incidents, investigations, signals, replay и ingestion. Schema хранит snapshot Backend 2, но не вычисляет delta, L0–L3, corridor, evidence rules, replay или виновность.

Document provenance теперь immutable: ссылки `Measurement`, `IncidentSignal` и `CandidateObjectSource` на `SourceDocument` используют `RESTRICT`; используемая `SourcePage` также не удаляется. Composite FK `(source_page_id, source_document_id)` гарантирует, что measurement page принадлежит тому же документу.

## 6. Migration

- Applied initial: `apps/api/prisma/migrations/20260804000000_initial_schema/migration.sql`, checksum сохранён без изменений.
- Новая additive migration: `apps/api/prisma/migrations/20260804160000_harden_provenance/migration.sql`.
- База DDL сформирована `prisma migrate diff --from-empty --to-schema ... --script`, затем SQL прочитан и дополнен вручную.
- CHECK покрывают SHA/period, positive page/river order, coordinate pair/range/`(0,0)`, exact-date xor period, verified provenance/excerpt, corridor bounds, no self-relation, non-negative offsets/counts и HTTP status.
- RLS включён на всех 21 application tables; permissive policies не созданы.
- Additive migration заменяет только четыре FK и добавляет composite unique/FK; удаления данных, seed и новых ролей/password нет.
- Disposable schema-to-database diff: `No difference detected`.

## 7. PrismaModule/Service

`PrismaModule` помечен `@Global()`, импортирован один раз в `AppModule`, предоставляет и экспортирует один default-scoped `PrismaService`. Service наследует единственный generated `PrismaClient`, получает adapter через testable factory seam и использует `PrismaPg`. Eager `$connect()` удалён: создание Nest application не зависит от доступности DB. `$disconnect()` остаётся shutdown hook. Controllers/services не создают второй client; unsafe raw SQL отсутствует.

## 8. Readiness

`GET /api/health/ready` выполняет tagged-template `SELECT 1` внутри bounded interactive transaction. Timeout берётся из `DB_READINESS_TIMEOUT_MS`, default `3000`, bounds `250..10000`: он передаётся в `PrismaPg.connectionTimeoutMillis`, Prisma `maxWait`/transaction `timeout`, а внутри transaction задаётся PostgreSQL `statement_timeout` через параметризованный `set_config`. Внешний `Promise.race` остаётся последней границей HTTP response.

Успех: `200 {"status":"ok","service":"caspian-trace-api","database":"ready"}`. Ошибка/timeout: `503 {"code":"DATABASE_UNAVAILABLE","message":"Database is unavailable","requestId":"..."}`. Prisma error, SQL, host, user, password и URL наружу не выходят. `/api/health/live` не вызывает DB.

## 9. Tests

| Команда | Результат | Фактический output/примечание |
|---|---|---|
| `node --version` (Node package 20.20.2) | PASS | `v20.20.2`. |
| `npm ci --include=optional` | PASS | 1128 packages; exit 0. npm сообщил 6 audit findings и engine warning транзитивного dev-only `@prisma/streams-local`; Prisma CLI/client официально требуют и приняли Node `^20.19`. |
| `npm ls prisma @prisma/client @prisma/adapter-pg pg --depth=0` | PASS | Prisma packages exact `7.6.0`, pg `8.22.0`. |
| `prisma:format`, `prisma:validate`, `prisma:generate` | PASS | Schema valid; client regenerated после clean install. |
| contracts `typecheck`, `test`, `build` | PASS | 26/26 tests; exit 0. |
| API `typecheck`, `lint`, `test`, `test:e2e`, `build` | PASS | unit 20/20; HTTP e2e 13/13; exit 0. |
| `npm run test:e2e:process -w api` | PASS | 1/1; compiled API с unreachable local DB стартовал, live `200`, ready normalized `503` за 781 ms, live после failure `200`. |
| `npm run test:prisma:clean` | PASS | fresh PostgreSQL 16, обе migrations, deploy/status/diff, DB e2e 10/10, production/dev clean-start. |
| `npm run test:e2e:db -w api` | PASS | Реально вызван harness с `PRISMA_E2E_DATABASE_REQUIRED=true`; suite не skip. |
| `npm run test:api-clean-start` | PASS | Отдельная fresh DB; build, production start и dev start, live+ready. |
| Supabase fallback `prisma:migrate:deploy` + status | PASS | Применена только additive migration; final status `Database schema is up to date`. |
| `npm run test:supabase:readiness` | PASS | 2/2 read-only e2e; real ready, обе migrations, RLS и новые FK видимы. |
| workspace `typecheck`, `lint`, `test`, `build` | PASS | API, contracts и frontend regression; web 2070 modules, только existing chunk-size warning. |
| `node --test scripts/create-backend-platform-archive.test.mjs` | PASS | 6/6; exit 0. |
| `npm run archive:backend-platform` | PASS | 60-entry clean archive; exit 0. |
| `tar -tzf ...` forbidden/include scan | PASS | Required Part 02 files присутствуют; secrets/generated/foreign zones отсутствуют. |
| `git diff --check` | PASS | Exit 0 после финального report update. |

Итоговые counts: unit API 20, HTTP e2e 13, process e2e 1, disposable DB e2e 10, Supabase smoke 2, contracts 26. DB e2e дополнительно проверяют RESTRICT документов/страниц и отклонение cross-document source page.

## 10. Disposable PostgreSQL

Preferred Docker mode реально использован с `postgres:16-alpine`: unique container name, random password, random loopback-only port, `pg_isready`, `migrate deploy`, `migrate status`, schema diff, DB e2e и guaranteed cleanup в `finally`. Password и полный URL не печатаются. External disposable mode поддержан через явные `PRISMA_CLEAN_DATABASE_URL`/`PRISMA_CLEAN_DIRECT_URL`; отсутствие обоих режимов завершает команду ошибкой, не skip.

## 11. Supabase

- Runtime: Supavisor Session Pooler `:5432` через `DATABASE_URL`.
- Migration: direct host `:5432` был недоступен из WSL; по инструкции использован Session Pooler `:5432` как временный `DIRECT_URL` fallback. Transaction pooler `:6543` не использовался.
- До correction deploy status показывал только `20260804160000_harden_provenance` как pending; `migrate deploy` применил её без reset/db push/dev.
- Финальный migration status: PASS/up to date.
- Runtime readiness: PASS, 2/2 read-only smoke; обе migrations, не менее 21 RLS table, три document RESTRICT FK и composite page/document RESTRICT FK видимы.
- URL, hostname, project reference, username, password и keys в отчёте не приведены.

## 12. Manual checks

Готовые WSL команды:

```bash
nvm use
npm run prisma:generate -w api
npm run start:dev -w api
curl -i http://localhost:3000/api/health/live
curl -i -H 'x-request-id: manual-part-02' http://localhost:3000/api/health/ready
```

Эквивалентные реальные проверки автоматизированы: clean-start поднял production/dev API с disposable DB; process e2e поднял реальный compiled API с unreachable local DB и проверил live/ready/live; HTTP e2e проверил forwarded request ID; Supabase e2e проверил real ready. Отдельный ручной `curl` не запускался (`NOT RUN`), поскольку те же transport assertions выполнены Supertest/fetch.

## 13. Archive

Итоговый clean archive коррекции: `artifacts/caspian-trace-backend-platform-clean-2026-08-04T14-52-42-805Z.tar.gz`, 60 entries. `.gitignore`, schema, обе migrations, PrismaModule, process/DB tests, Part 02 TODO/report и verifier включены; `.env`, generated client, frontend, Backend 2, `data/verified`, node_modules/dist/coverage исключены. После обновления отчёта archive детерминированно перезаписывается с тем же timestamp.

## 14. Known limitations

- Seed и demo rows отсутствуют — Part 03 не начинался.
- Incidents API не реализован — Part 04 не начинался.
- Storage/source cache и ingestion не реализованы.
- PostGIS не добавлялся: Part 02 не требует spatial SQL.
- Backend 2 calculations (delta, L0–L3, corridor, evidence, replay, LLM) не реализовывались.
- npm clean install сообщает существующие audit findings, включая frontend advisories; `npm audit fix --force` не запускался.

## 15. Handoff

Backend 2:

- импорт generated client: `apps/api/src/generated/prisma/client` (файл генерируется, не коммитится);
- использовать модели `Investigation`, explicit joins, `EvidenceStatement*`, `InvestigationUnknown`, `ReplayScenario/ReplayStep` без второго PrismaClient;
- Prisma enums внутренние и должны mapper-ом переводиться в стабильные lowercase API values;
- любые schema changes передавать Backend 1 и оформлять новой migration, не редактировать initial migration после применения.

Frontend:

- исходники не изменены, full regression прошёл;
- доступен additive `GET /api/health/ready` и `HealthReadySchema`; frontend по-прежнему не обращается к Supabase напрямую.

## 16. Final Git status

Работа остаётся в `feat/backend-platform`. Изменения ограничены разрешённой зоной Part 02; `.env` и generated client не отслеживаются.

```text
## feat/backend-platform...origin/feat/backend-platform
 M .gitignore
 M apps/api/.env.example
 M apps/api/eslint.config.mjs
 M apps/api/package.json
 M apps/api/src/app.module.ts
 M apps/api/src/config/environment.ts
 M apps/api/src/health/health.controller.ts
 M apps/api/src/health/health.module.ts
 M apps/api/test/app.e2e-spec.ts
 M apps/api/test/config.spec.ts
 M apps/api/test/set-env.ts
 M apps/api/tsconfig.build.json
 M package-lock.json
 M package.json
 M packages/contracts/src/schemas.ts
 M packages/contracts/test/contracts.spec.ts
 M scripts/create-backend-platform-archive.mjs
 M scripts/create-backend-platform-archive.test.mjs
 M scripts/verify-api-clean-start.mjs
?? apps/api/prisma.config.ts
?? apps/api/prisma/
?? apps/api/src/health/dto/health-ready.dto.ts
?? apps/api/src/health/health.service.ts
?? apps/api/src/prisma/
?? apps/api/test/api-process-unavailable-db.e2e-spec.ts
?? apps/api/test/health.spec.ts
?? apps/api/test/prisma-db.e2e-spec.ts
?? apps/api/test/prisma.spec.ts
?? apps/api/test/supabase-readiness.e2e-spec.ts
?? docs/backend-platform/part-02-prisma-supabase-readiness-report.md
?? scripts/verify-prisma-clean-db.mjs
```

Commit, push, merge и rebase не выполнялись.

## Выполненные этапы Backend 1

- [x] Критический bootstrap
- [x] Общие contracts
- [x] Этап P1 — NestJS platform
- [x] Этап P2 — Prisma и Supabase
- [x] Clean archive Backend 1
- [ ] Этап P3 — verified seed — не входил в Part 02
- [ ] Этап P4 — incidents read API — не входил в Part 02
- [ ] Этап P5+ — Storage, SafeFetch и ingestion — не входили в Part 02
