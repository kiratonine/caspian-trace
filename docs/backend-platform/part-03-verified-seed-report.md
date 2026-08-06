# Backend Platform Part 03 — verified seed

## 1. Результат

Part 03 исправлен без перехода к Part 04. Verified seed сохраняет чужие `Measurement.metadata`, поддерживает несколько relation evidence одного документа на разных страницах и отклоняет identifiers с surrounding whitespace без silent normalization.

Строгий Prisma 7 seed по-прежнему использует Zod loader, manifest v1 policy `requiredHumanReviewers=2`, validate-only, один standalone client через `PrismaPg`, одну transaction, immutable conflict detection и monotonic review updates.

Human handoff остаётся `0/2 pending`. Production strict seed реально запущен и ожидаемо остановлен `VERIFIED_DATA_HUMAN_REVIEW_INCOMPLETE` до создания Prisma Client/transaction. Verified writes: 0.

## 2. Preflight и границы

- Ветка: `feat/backend-platform`.
- Последний commit: `4210cdd chore(data): import Backend 2 verified fixtures handoff`.
- На preflight уже существовал незакоммиченный Part 03 diff; он сохранён.
- Все project commands выполнялись на Node `v20.20.2`, npm `10.8.2`.
- `data/verified/**`, `apps/web/**`, `packages/investigation-core/**` и Backend 2 modules не изменялись.
- Part 04, incidents API, Storage, SafeFetch и ingestion не начинались.
- Commit, push, pull, merge, rebase, reset, checkout и clean не выполнялись.

## 3. Measurement metadata ownership

При existing measurement seed читает полный JSON object и строит update как:

1. все существующие metadata keys;
2. controlled override `sourcePage`;
3. controlled override `checkedBy`;
4. controlled override `checkedAt`.

Seed не удаляет и не заменяет неизвестные metadata keys. DB e2e добавляет внешний `externalMetadataKey:{owner:"outside-seed"}`, выполняет reviewer addition и подтверждает, что ключ сохранился.

Review policy остаётся monotonic и применяется к relation evidence и measurement metadata:

- reviewer comparison case-insensitive и order-independent;
- существующих reviewers нельзя удалить или заменить;
- разрешено только добавление reviewers;
- `checkedAt` не уменьшается;
- removal/replacement/backdate возвращают `VERIFIED_SEED_CONFLICT` и откатывают transaction;
- review update учитывается отдельными `reviewUpdated` / `evidenceReviewUpdated`, не как unchanged.

## 4. Relation evidence page dedup

Создана и применена новая additive migration:

`apps/api/prisma/migrations/20260805220000_relation_evidence_page_dedup/migration.sql`

Новый unique key:

```text
(station_relation_id, source_document_id, basis, source_page)
```

PostgreSQL constraint использует `UNIQUE NULLS NOT DISTINCT`.

- Одинаковые edge/document/basis/page отклоняются на loader и DB levels.
- Разные positive pages принимаются и сохраняются как независимые evidence.
- `sourcePage=null` рассматривается как одно строгое dedup-значение: второй null для того же edge/document/basis отклоняется.
- Один null может сосуществовать с page-specific evidence, потому что unknown locator и подтверждённая конкретная страница — разные provenance records.
- Loader duplicate key строится из JSON tuple, поэтому separator characters внутри raw IDs не создают коллизий.
- Relation fixture page продолжает совпадать с item и manifest entry; общий SourceDocument identity сопоставляется по ID/URL/SHA, а не по одной representative page.

DB e2e проверяет accepted page `23` рядом с существующей page `22`, accepted single null, rejected duplicate null и rejected duplicate concrete page.

## 5. Raw identifiers

Общий ID schema больше не вызывает `.trim()` и не преобразует external identifiers. Он проверяет исходную строку и отклоняет surrounding whitespace.

Negative unit tests покрывают:

- document ID;
- measurement ID;
- station ID;
- relation ID.

Raw values, excerpts и station labels также остаются без silent whitespace mutation согласно предыдущей коррекции Part 03.

## 6. Migration history

Пять migrations применены к Supabase. Четыре ранее применённые migration не редактировались, их SHA-256 сохранены:

- `20260804000000_initial_schema`: `75db4e7097b2133a1886a50d615c494034fb1c05be270392dd3fd1bbe4aed367`;
- `20260804160000_harden_provenance`: `767d5a2f160e08893798e3ec1a02a0b1188998100e34b116bd06636f8fcd7023`;
- `20260805170000_station_relation_evidence`: `599a0e86e35eb90e4059c433210db2411ff5b011f35b66d068104502c7f78d49`;
- `20260805200000_source_independent_station_relations`: `ce05e590055838e521bc0eba0075efe31c5b08b9fc41e5ca048fc978fa1b89b7`.

Новая page-dedup migration: `ea248ff4e7ebe7a22878b32e422b9f4681723c3a1feb9b1fcfda7e113dc273ee`.

Против Supabase применялся только `prisma migrate deploy`. `db push`, `migrate dev` и `migrate reset` не использовались.

## 7. Изменённые файлы этой коррекции

- `apps/api/prisma/schema.prisma` — page-aware composite unique definition.
- `apps/api/prisma/migrations/20260805220000_relation_evidence_page_dedup/migration.sql` — новая additive migration с `NULLS NOT DISTINCT`.
- `apps/api/prisma/seed/verified-data.schemas.ts` — non-transforming ID validation.
- `apps/api/prisma/seed/verified-data.loader.ts` — page-aware tuple dedup и multi-page document matching.
- `apps/api/prisma/seed/verified-seed.service.ts` — preservation всех existing metadata keys.
- `apps/api/test/seed/verified-data.spec.ts` — ID и page/null loader regressions.
- `apps/api/test/seed/verified-seed-test-data.ts` — temporary multi-page fixture helper.
- `apps/api/test/verified-seed-db.e2e-spec.ts` — metadata preservation и DB page/null regressions.
- `scripts/create-backend-platform-archive.test.mjs` — allowlist regression новой migration.
- `docs/backend-platform/part-03-verified-seed-report.md` — этот report.

Dependencies и `package-lock.json` не менялись.

## 8. Реальные проверки

| Команда | Статус | Фактический результат |
|---|---:|---|
| Git preflight / branch | PASS | `feat/backend-platform`; существующий Part 03 diff сохранён. |
| Node/npm | PASS | `v20.20.2`, npm `10.8.2`. |
| `npm ci --include=optional` | PASS | 1057 packages; прежние 4 moderate/2 high audit findings и dev-only `@prisma/streams-local` engine warning. |
| Prisma format/validate/generate | PASS | Schema valid; Prisma Client 7.6.0 generated. |
| API typecheck/lint/unit | PASS | 4 suites, 75/75 tests. |
| ID whitespace tests | PASS | document/measurement/station/relation IDs rejected without mutation. |
| loader page/null tests | PASS | different page accepted; same page and second null rejected. |
| первый `npm run test:seed:clean` | FAIL → исправлено | Migration/status/drift PASS, DB 10/11; assertion ожидал неверный lexical order `page-null` перед `page-23`. |
| финальный `npm run test:seed:clean` | PASS | Fresh PostgreSQL 16; 5 migrations, no drift; seed DB e2e 11/11. |
| metadata preservation DB e2e | PASS | External metadata key сохранён после reviewer addition. |
| page-aware DB e2e | PASS | Different page и один null приняты; duplicate concrete/null keys отклонены. |
| monotonic conflict DB e2e | PASS | Removal/replacement/backdate → `VERIFIED_SEED_CONFLICT`. |
| `npm run test:prisma:clean` | PASS | Fresh 5-migration deploy/status/`No difference detected`; DB e2e 10/10; production/dev clean-start. |
| initial Supabase status | FAIL (ожидаемо) | Новая migration была pending; status exit 1 до deploy. |
| Supabase deploy/status | PASS | Page-dedup migration applied; schema up to date, 5 migrations. |
| Supabase readiness | PASS | Read-only smoke 2/2. |
| `npm run verify:investigation-data` | PASS | Structure valid, human `0/2 pending`. |
| human-required verification | BLOCKED | Expected exit 1: `0/2`. |
| `npm run seed:validate` | PASS | 2 documents, 9 measurements, 4 relations, `databaseWrites:0`. |
| `npm run prisma:seed` | BLOCKED | Expected human gate before DB client/transaction, 0 writes. |
| API HTTP e2e | PASS | 13/13. |
| compiled process e2e | PASS | 1/1. |
| root typecheck/lint/test/build | PASS | API 75/75, contracts 26/26, frontend regression; только прежний Vite chunk warning. |
| database guard | PASS | 3/3. |
| archive tests | PASS | 6/6. |
| archive creation | PASS | `artifacts/caspian-trace-backend-platform-clean-2026-08-05T12-40-24-064Z.tar.gz`, 88 allowlisted files. |
| archive forbidden-path/content scan | PASS | Secrets/generated/temp/frontend/Backend 2 code отсутствуют; актуальный report включён. |
| `git diff --check` | PASS | Whitespace errors отсутствуют. |

## 9. Archive

- Актуальный файл: `artifacts/caspian-trace-backend-platform-clean-2026-08-05T12-40-24-064Z.tar.gz`.
- Состав: 88 allowlisted files.
- Включены все пять migrations, seed implementation/tests, disposable DB guard/harness, Part 03 TODO/report и read-only verified handoff.
- Исключены `.env`, generated Prisma client, temporary fixtures, artifacts, `apps/web/**`, Backend 2 code и `packages/investigation-core/**`.

## 10. Остаток и handoff

- Part 03 production completion остаётся BLOCKED до реального human review 2/2 и разрешённых повторных strict seed runs.
- Backend 2/reviewers должны подтвердить каждое значение/label/page/excerpt/SHA и relation basis реальными independent reviewers.
- Frontend не менялся; Part 04 не начат.

## 11. Выполненные этапы Backend 1

- [x] Part 01 — NestJS platform/contracts.
- [x] Part 02 — Prisma/Supabase foundation/readiness.
- [x] Part 03 implementation — strict seed, metadata preservation, normalized multi-page evidence, monotonic reviews и mandatory clean DB tests.
- [ ] Part 03 production gate — BLOCKED: human review `0/2`.
- [ ] Part 04 — incidents read API; не начинался.
- [ ] Storage, SafeFetch и ingestion; не начинались.
