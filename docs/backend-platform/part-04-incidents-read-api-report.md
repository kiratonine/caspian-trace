# Backend Platform Part 04 — incidents read API

## 1. Результат

Реализованы production read endpoints:

```http
GET /api/incidents
GET /api/incidents/:id
```

API читает PostgreSQL только через общий `PrismaService`, возвращает frozen
`@caspian-trace/contracts`, использует `Investigation.id` как public ID и
показывает только `isCurrent=true`. Фильтры `status`, `region`, `from`, `to`,
`limit` валидируются; 400/404/invalid persisted data нормализованы.

Техническая реализация Part 04 — **COMPLETE**. Production data path —
**BLOCKED**: verified handoff остаётся `0/2`, strict seed не разрешён, current
Investigation snapshots Backend 2 в shared Supabase отсутствуют. Реальный
read-only smoke вернул `GET /api/incidents -> 200 []` и unknown detail ->
`404 INVESTIGATION_NOT_FOUND`; runtime fixture fallback не добавлялся.

## 2. Preflight

- Ветка: `feat/backend-platform`.
- Исходный commit: `1b0450e feat(backend-platform): add verified Prisma seed pipeline`.
- Исходное рабочее дерево было чистым.
- Node `v20.20.2`, npm `10.8.2`.
- Прочитаны root `AGENTS.md`, TODO/reports Part 01–03, platform/roadmap/spec
  context, contracts/fixtures/tests, schema и все пять migrations, seed,
  Prisma service/tests/clean harness и Backend 2 handoff.
- `apps/web/**`, `packages/investigation-core/**`, `data/verified/**` и модули
  Backend 2 не изменялись.
- Commit/push/pull/merge/rebase/reset/clean не выполнялись.

## 3. Изменённые файлы

Runtime:

- `apps/api/src/app.module.ts` — подключён `IncidentsModule`.
- `apps/api/src/incidents/incidents.module.ts` — feature module.
- `apps/api/src/incidents/incidents.controller.ts` — два GET endpoint и Swagger.
- `apps/api/src/incidents/incidents.service.ts` — orchestration, 404 и data error mapping.
- `apps/api/src/incidents/incidents.repository.ts` — два explicit Prisma read query.
- `apps/api/src/incidents/incidents.mapper.ts` — frozen contract mapping, Decimal/enums/nulls/provenance.
- `apps/api/src/incidents/incidents.types.ts` — internal Prisma payload/select types и filters.
- `apps/api/src/incidents/incidents.errors.ts` — internal invalid-data error.
- `apps/api/src/incidents/dto/list-incidents.dto.ts` — query/path validation и UTC range conversion.

Tests/harness:

- `apps/api/test/incidents/incidents-row.fixture.ts` — synthetic test-only typed rows.
- `apps/api/test/incidents/list-incidents.dto.spec.ts` — query validation/bounds/dates.
- `apps/api/test/incidents/incidents.mapper.spec.ts` — contract/Decimal/null/corridor/provenance mapping.
- `apps/api/test/incidents/incidents.repository.spec.ts` — exact selects, filters и current-only query.
- `apps/api/test/incidents/incidents.service.spec.ts` — list/404/data-invalid behavior.
- `apps/api/test/incidents/incidents.http.e2e-spec.ts` — real Nest HTTP/ValidationPipe/filter/Swagger.
- `apps/api/test/incidents-read-db.e2e-spec.ts` — real disposable PostgreSQL read API e2e.
- `apps/api/package.json` — HTTP и incidents DB e2e scripts.
- `package.json` — `test:incidents:clean`.
- `scripts/verify-prisma-clean-db.mjs` — минимальный reusable `--incidents-only` mode.
- `scripts/create-backend-platform-archive.test.mjs` — Part 04 archive assertions.
- `docs/backend-platform/part-04-incidents-read-api-report.md` — этот отчёт.

Dependencies, lockfile, Prisma schema и migrations не менялись.

## 4. Architecture

```text
HTTP/DTO -> IncidentsController -> IncidentsService
         -> IncidentsRepository -> singleton PrismaService
         -> explicit row payload -> incidents.mapper -> contracts response
```

Controller содержит только transport/Swagger concerns. Repository владеет
Prisma query shape. Service переводит отсутствие current row в stable 404 и
mapper inconsistency в safe 500. Mapper не выполняет core rules.

## 5. Contract mapping

Summary:

- `id <- Investigation.id`;
- title/region/indicator берутся из `Incident`;
- evidence level и `updatedAt` — сохранённые `Investigation` fields;
- period определяется только из linked `InvestigationMeasurement`; один
  уникальный `YYYY-MM` возвращается, mixed/empty -> `null`;
- nullable incident indicator заменяется единственным linked indicator, иначе
  честным `"не определён"`.

Detail:

- conclusion, evidence level, statements, unknowns и corridor station IDs
  только отображаются из сохранённых rows;
- `investigation.corridor` всегда `null`: geometry не реконструируется;
- `NONE`, `BETWEEN_STATIONS`, `OPEN_UPSTREAM` отображаются по persisted IDs;
  `OPEN_DOWNSTREAM`/несогласованные bounds -> `INCIDENT_DATA_INVALID`;
- Decimal преобразуется через `Number(decimal.toString())` только на API
  boundary после `Number.isFinite`; `rawValueText` остаётся неизменным;
- page: persisted `SourcePage.pageNumber`, затем owned metadata `sourcePage`,
  иначе `null`;
- coordinates появляются только парой, `(0,0)` отклоняется;
- enums преобразуются explicit switch; unsupported media/data отклоняются;
- stations, documents и IDs дедуплицируются и стабильно сортируются;
- source documents собираются из signal/measurement/statement/candidate links;
- candidate без evidence document и non-unknown statement без source provenance
  считаются invalid persisted data.

Mapper не вычисляет delta, L0–L3, corridor, conclusion, causal/spatial rules и
не импортирует `investigation-core`.

## 6. Queries

List выполняет один `investigation.findMany`:

```text
where: isCurrent=true, evidenceLevel?, incident.region?, generatedAt gte/lt
orderBy: generatedAt DESC, id ASC
take: validated limit 1..100
select: id/level/generatedAt + incident summary + linked measurement period/indicator
```

`status` явно мапится на `Investigation.evidenceLevel`, не `Incident.status`.
`from` — inclusive UTC midnight; `to` преобразуется в exclusive midnight
следующего UTC дня.

Detail выполняет один `investigation.findFirst({id,isCurrent:true})` с explicit
nested select всех нужных relations. В DB e2e spy подтвердил один repository
Prisma call; N+1 из business layer отсутствует.

## 7. Errors

- invalid query/path -> `400 VALIDATION_ERROR`;
- неизвестный или historical investigation ID ->
  `404 INVESTIGATION_NOT_FOUND`;
- inconsistent persisted corridor/media/coordinates/provenance/contract ->
  `500 INCIDENT_DATA_INVALID`;
- все ответы имеют `{code,message,requestId}`; DB URL/SQL/Prisma records наружу
  не выходят.

## 8. Swagger

Swagger содержит `/api/incidents` и `/api/incidents/{id}`. List документирует
status/region/from/to/limit, default `50`, bounds `1..100`, response и 400.
Detail документирует current `Investigation.id`, response, 404 и data-invalid.

## 9. Tests

| Команда | Статус | Фактический результат |
|---|---:|---|
| Git/Node preflight | PASS | `feat/backend-platform`, clean tree, Node `v20.20.2`, npm `10.8.2`. |
| `npm ci --include=optional` | PASS | 1057 packages; existing 4 moderate/2 high audit findings и dev-only `@prisma/streams-local` engine warning. |
| Prisma format/validate/generate | PASS | Schema valid; Prisma Client 7.6.0 generated; Part 04 schema diff отсутствует. |
| `npm run prisma:migrate:status` | PASS | Shared Supabase: 5 migrations, up to date. |
| contracts typecheck/test/build | PASS | 26/26 contract tests. |
| API typecheck/lint/unit/build | PASS | 8 suites, 98/98 unit tests; typecheck/lint/build exit 0. |
| `npm run test:e2e:api` | PASS | 2 suites, 24/24 HTTP e2e. |
| `npm run test:e2e:api-process` | PASS | 1/1 compiled API unavailable-DB e2e. |
| `npm run test:incidents:clean` | PASS | Fresh PostgreSQL 16, 5 migrations, status/no drift, incidents DB e2e 8/8. |
| `npm run test:prisma:clean` | PASS | Fresh PostgreSQL 16, foundation DB 10/10, clean production/dev start. |
| `npm run test:seed:clean` | PASS | Part 03 regression: fresh DB seed e2e 11/11. |
| `npm run test:database-guard` | PASS | 3/3; Supabase-like URLs и отсутствие explicit disposable flag отклоняются до connection. |
| `npm run test:supabase:readiness` | PASS | Read-only shared Supabase 2/2. |
| `npm run typecheck && npm run lint && npm run test && npm run build` | PASS | API/contracts/frontend full workspace; web 2070 modules, only existing chunk warning. |
| Shared Supabase incidents smoke | PASS | Real compiled API: list `200 []`; unknown detail `404 INVESTIGATION_NOT_FOUND`. |
| `npm run verify:investigation-data` / `seed:validate` | PASS | Structure valid, 2 docs/9 measurements/4 relations, databaseWrites 0, human 0/2. |
| `npm run verify:investigation-data:human` | BLOCKED | Expected exit 1: human verification incomplete `0/2`. |
| archive tests / archive creation | PASS | Archive tests 6/6; fixed-timestamp clean archive created with 105 entries. |
| `git diff --check` | PASS | No whitespace errors before report/archive finalization. |

Part 04-specific counts: DTO/mapper/service/repository unit regressions are part
of 98 unit tests; HTTP total 24; incidents disposable DB 8. Filters, 404,
period isolation, current-only semantics and both response contracts are
covered.

## 10. Manual verification

```bash
nvm use
npm run build -w api
PORT=3094 node --env-file=apps/api/.env apps/api/dist/main.js
curl -sS 'http://127.0.0.1:3094/api/incidents?region=atyrau&limit=50'
curl -i http://127.0.0.1:3094/api/incidents/unknown
```

Этот smoke реально выполнен read-only: `[]` и normalized 404.

## 11. Production data status

- Part 03 structure/validate-only: PASS.
- Human review: **BLOCKED, 0/2**.
- Strict verified seed в shared Supabase: не разрешён; bypass отсутствует.
- Backend 2 current Investigation snapshots: отсутствуют в shared DB.
- Фактический production-like list: `[]`.

После human `2/2` Backend 2 должен сохранить current immutable snapshots через
свой versioned transaction; Part 04 автоматически прочитает их без fixtures.

## 12. Known limitations

- Public history endpoint отсутствует: historical ID намеренно 404.
- Public contract не поддерживает open-downstream corridor; такой persisted row
  fail-closed как `INCIDENT_DATA_INVALID`.
- Production demo cases не появятся до human gate и Backend 2 persistence.

## 13. Archive

- Файл: `artifacts/caspian-trace-backend-platform-clean-2026-08-05T14-21-09-530Z.tar.gz`.
- Состав: `105` allowlisted files.
- Включены Part 01–04 platform source/tests/TODO/reports, migrations, seed и
  read-only handoff.
- Исключены `.env`, generated Prisma client, node_modules/dist/coverage,
  artifacts, frontend, investigation-core и Backend 2 feature code.

## 14. Handoff

Backend 2:

- сохранять один `isCurrent=true` snapshot на Incident и только normalized
  links к measurements/statements/sources/unknowns/candidates;
- `Investigation.id` является public ID list/detail;
- Part 04 не recompute-ит и не исправляет результат Backend 2;
- не сохранять source-less supports/contradicts/limits или unsupported
  open-downstream public corridor.

Frontend:

- использовать `GET /api/incidents` и `GET /api/incidents/:investigationId`;
- filters: status/region/from/to/limit;
- пустой список до data handoff является честным состоянием;
- прямой Supabase access не нужен; `apps/web/**` в Part 04 не менялся.

## 15. Git status

Работа выполнена в `feat/backend-platform`. Commit/push/pull/merge/rebase не
выполнялись. Финальный status приведён в ответе Codex после archive pass.

## Выполненные этапы Backend 1

- [x] Part 01 — NestJS platform/contracts.
- [x] Part 02 — Prisma/Supabase foundation/readiness.
- [x] Part 03 implementation — strict verified seed.
- [ ] Part 03 production gate — BLOCKED: human review `0/2`.
- [x] Part 04 implementation — incidents read API.
- [ ] Production incident data path — BLOCKED: Part 03 gate + Backend 2 current snapshots.
- [ ] Part 05+ — Storage, SafeFetch и ingestion не начинались.
