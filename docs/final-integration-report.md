# Финальный интеграционный отчёт

## 1. Итог

```text
Статус: PARTIAL — application/tests PASS, remote delivery BLOCKED
Финальная ветка: integration/final-demo
Проверенный application HEAD: c41ab2ba7d4c57e13f8436508a2c7d89ef8eca92
Remote upstream: отсутствует; HTTPS/SSH credentials и GitHub App Git Data write недоступны
Дата и время проверки: 2026-08-07T05:28:10+05:00
Исполнитель: Codex, Backend 1 / integration owner
```

Интегрированы актуальный локальный platform/backend, patch-equivalent Backend 2 fixes до `1f13509263c0ec6194db5763b8724e07a74fbaac` и frontend HEAD `741a9ae94c8f2ec0a12a5ffe0cdce777c02da612`. Verified demo path работает через PostgreSQL, compiled NestJS API и frontend в API mode. Внешний GDELT остаётся `failed`, но verified cases, cache, evidence, replay и dossier от него не зависят. Единственный невыполненный обязательный этап — remote push: локальное окружение не имеет GitHub write credentials.

Документационные commits и итоговый remote SHA создаются после этого проверенного application commit; фактические значения перечислены в разделе 11 после push.

## 2. Source refs и safety

```text
Local backend base SHA: ac4d92066193c9edcdf54d47ce2b7b74544060dc
Safety branch: backup/pre-final-integration-20260807-044044
Safety branch SHA: ac4d92066193c9edcdf54d47ce2b7b74544060dc
Backend 2 source branch: origin/fix/scoped-runtime-bootstrap-reapply
Backend 2 source HEAD: 1f13509263c0ec6194db5763b8724e07a74fbaac
Frontend source branch: origin/frontend
Frontend source HEAD: 741a9ae94c8f2ec0a12a5ffe0cdce777c02da612
Platform reference: 8fba720ed1260d1574c0a9d5ab3e3dc7f1fce81e
Backend 2 reference: 62c3405b15a244808fa30b7704d9a8889e9bacac
Previous integration reference: e6b50adb0fdd7b131bcdcd71ed94b7d999baca8f
Final integration branch: integration/final-demo
Backend stabilization commit: 1743cae9ae916b6936823ffd96bd71bef141924b
Frontend merge/application commit: c41ab2ba7d4c57e13f8436508a2c7d89ef8eca92
```

`git cherry -v HEAD origin/fix/scoped-runtime-bootstrap-reapply` пометил все пять commits серии через `-`: их patches уже присутствовали в локальном backend. Поэтому старая Backend 2 branch не merge/cherry-pick-илась повторно. `feat/backend-investigation` не merge-илась, не rebased и не cherry-picked.

Frontend merge имеет родителей:

```text
1743cae9ae916b6936823ffd96bd71bef141924b
741a9ae94c8f2ec0a12a5ffe0cdce777c02da612
```

## 3. Изменённые файлы

### Runtime bootstrap

- `apps/api/prisma/seed/runtime-bootstrap.plan.ts` — immutable per-incident `stationFacts` в bootstrap plan.
- `apps/api/src/investigations/prisma-investigation.repository.ts` — fail-closed scoped reconstruction station facts с узкой нормализацией `г.`.
- `apps/api/test/seed/runtime-bootstrap.plan.spec.ts` — exact station facts и Aktau empty-scope regression.
- `apps/api/test/seed/runtime-bootstrap.persistence.spec.ts` — persistence stationFacts regression.
- `apps/api/test/investigations/prisma-investigation.repository.spec.ts` — scope/name/waterBody/hash regressions.

### Contracts и API compatibility

- `apps/api/src/incidents/incidents.repository.ts` — current investigation lookup по version ID или stable `Incident.id`.
- `apps/api/test/incidents/incidents.repository.spec.ts` — stable public alias regression.
- `apps/api/test/integration/investigation-integration-db.e2e-spec.ts` — normalized relation provenance/scoped station DB foundation и metadata-preservation regression.
- `packages/contracts/src/schemas.ts` — additive maximum 256 для детерминированного `EvidenceStatement.id`.
- `packages/contracts/test/contracts.spec.ts` — regression для реального 167-character evidence ID.

### Frontend

- `apps/web/**` — frontend HEAD `741a9ae...`: API adapters, map/scheme, replay, dossier, live status, i18n и UI.
- `apps/web/src/constants/api.ts` — default `api`; только explicit `VITE_DATA_MODE=seed` включает fallback.
- `apps/web/.env.example` — `VITE_API_BASE_URL=/api`, `VITE_DATA_MODE=api`.
- Frontend-owned context/design docs из merge сохранены без переноса старого backend baggage.

### Manifests и lockfile

- `apps/web/package.json` — frontend dependencies из pinned frontend HEAD.
- `package-lock.json` — пересобран `npm install`/`npm install --package-lock-only`, backend dependencies и root scripts сохранены.

### Что намеренно не изменено/не перенесено

- `data/verified/**`, `data/fixtures/investigation/**`, golden hashes и hash function.
- `apps/api/prisma/schema.prisma` и все applied migrations.
- Gemini provider/prompts/free-tier transport и `verify-gemini-free-tier` отсутствуют.
- Старые migrations `20260805120000_investigation_persistence` и `20260805153000_allow_repeated_evidence_codes` отсутствуют.

## 4. September hash root cause

Read-only canonical diff до исправления:

```json
{
  "incidentId": "inv-atyrau-2025-09",
  "expectedHash": "ab5e5a1f3ac67d8405151065e29c3a9ca1099271cee11b6262b411acdef83b56",
  "actualHash": "87360f...",
  "differences": [
    {
      "path": "$.stations[2].name",
      "expected": "1 км выше Атырау",
      "actual": "1 км выше г. Атырау"
    },
    {
      "path": "$.stations[3].name",
      "expected": "1 км ниже Атырау",
      "actual": "1 км ниже г. Атырау"
    }
  ]
}
```

Причина: shared `Station` rows корректно содержали canonical labels с `г.`, тогда как immutable September investigation input использует короткие labels. Repository ранее строил hash из глобальных mutable station rows.

Исправление: bootstrap сохраняет exact `input.stations` как incident-scoped facts. Repository сначала загружает реальные station rows и fail-closed проверяет exact ID/waterBody/name; допустима только узкая NFC/whitespace normalization и удаление отдельного токена `г.`. Затем core получает неизменённые scoped facts. Глобальные station rows не перезаписываются.

Canonical diff после исправления:

```json
{
  "expectedHash": "ab5e5a1f3ac67d8405151065e29c3a9ca1099271cee11b6262b411acdef83b56",
  "actualHash": "ab5e5a1f3ac67d8405151065e29c3a9ca1099271cee11b6262b411acdef83b56",
  "differences": []
}
```

Verified data, fixtures, expected results, golden hashes и `calculateInputHash` не изменялись. Focused regressions проверяют exact facts, отсутствие DB overwrite, missing/duplicate/wrong-scope facts, unrelated name, wrong waterBody и все три exact hashes.

## 5. Runtime bootstrap

Оба раза выполнено:

```bash
RUNTIME_BOOTSTRAP_DEBUG=1 npm run prisma:bootstrap:investigations -w api
```

Первый запуск: exit code `0`. Второй запуск: exit code `0`. Filtered summary diff: empty, exit code `0`.

```json
[
  {
    "incidentId": "inv-aktau-insufficient",
    "investigationVersionId": "inv-aktau-insufficient@1.2.1:4e95296c26e52b914e0c7bf2dd1091c10767cd9c0b56300d92ecfd5d1c2084ad",
    "inputHash": "4e95296c26e52b914e0c7bf2dd1091c10767cd9c0b56300d92ecfd5d1c2084ad",
    "rulesetVersion": "1.2.1",
    "evidenceLevel": "L0"
  },
  {
    "incidentId": "inv-atyrau-2025-05",
    "investigationVersionId": "inv-atyrau-2025-05@1.2.1:6af691a9ea5c0e34d527ea8bcd415cb4f74e1484755bd681a7c2a68721ae51c1",
    "inputHash": "6af691a9ea5c0e34d527ea8bcd415cb4f74e1484755bd681a7c2a68721ae51c1",
    "rulesetVersion": "1.2.1",
    "evidenceLevel": "L3"
  },
  {
    "incidentId": "inv-atyrau-2025-09",
    "investigationVersionId": "inv-atyrau-2025-09@1.2.1:ab5e5a1f3ac67d8405151065e29c3a9ca1099271cee11b6262b411acdef83b56",
    "inputHash": "ab5e5a1f3ac67d8405151065e29c3a9ca1099271cee11b6262b411acdef83b56",
    "rulesetVersion": "1.2.1",
    "evidenceLevel": "L2"
  }
]
```

Corridors: Aktau `null`; May between `st-asa-0-5km-above` and `st-asa-0-5km-below`; September open upstream with downstream bound `st-zhaiyk-1km-above-atyrau`.

## 6. Prisma

```text
npm run prisma:validate -w api: PASS, exit 0
npm run prisma:generate -w api: PASS, Prisma Client 7.6.0, exit 0
npm run prisma:migrate:status -w api: PASS, shared database up to date, exit 0
clean disposable PostgreSQL deploy twice/status/diff: PASS, no pending migration, no drift
```

Applied migration history:

```text
20260804000000_initial_schema
20260804160000_harden_provenance
20260805170000_station_relation_evidence
20260805200000_source_independent_station_relations
20260805220000_relation_evidence_page_dedup
20260806010000_integrate_investigation_persistence
```

Obsolete migrations from Backend 2 are absent. Ни `prisma db push`, ни `prisma migrate reset` не выполнялись. Shared Supabase migration history не изменялась.

## 7. Проверки backend/workspace

Все команды выполнялись на Node `20.20.2`, npm `10.8.2`.

| Команда | Результат | Фактический итог |
|---|---:|---|
| `npm ci --include=optional` | PASS | exit 0, 1122 packages; 8 audit findings reported |
| focused runtime test command из runbook | PASS | 9 suites, 108 tests |
| `npm run test:investigation` | PASS | 6 suites, 41 tests |
| `npm run test:e2e:investigation` | PASS | 1 suite, 5 tests |
| `npm run test:investigation:clean` | PASS | 6 migrations, no drift, 6 DB tests |
| `npm run test:e2e:api` | PASS | 5 suites, 58 tests |
| `npm run test:e2e:api-process` | PASS | compiled API live 200 / ready normalized 503 with unreachable DB |
| `npm run typecheck` | PASS | all four workspaces, exit 0 |
| `npm run lint` | PASS | API, web, investigation-core, exit 0 |
| `npm run test` | PASS | API 49/462; contracts 1/27; core 1/32 |
| `npm run build` | PASS | all workspaces; Vite production build |
| `VITE_DATA_MODE=seed npm run build -w web` | PASS | explicit emergency fallback build |
| `npm run build -w web` | PASS | default API build restored |
| `npm run test:database-guard` | PASS | 3 tests |
| `node --test scripts/create-backend-platform-archive.test.mjs` | PASS | 6 tests |
| `npm run archive:backend-platform` | PASS | 304 allowlisted backend files |

Первый disposable DB run выявил старый e2e foundation без обязательных normalized relation evidence/scoped station facts. Test foundation приведён к production contract. Второй run выявил, что сам тест удалял required `sourcePage`, проверяя external metadata. Regression теперь сохраняет required provenance и внешний key. Третий clean run прошёл полностью.

Неблокирующие warnings: Vite chunk `~2.03 MB` превышает default warning threshold; `@mapbox/jsonlint-lines-primitives` и необязательный `@prisma/streams-local` декларируют Node 22, но обязательные Node 20.20.2 typecheck/test/build/runtime gates прошли. `npm audit` сообщил 4 moderate и 4 high findings; автоматический breaking `audit fix --force` не применялся.

## 8. API smoke

Base URL: `http://127.0.0.1:3000/api`. Swagger: `http://127.0.0.1:3000/api/docs`, JSON: `/api/docs-json`.

Проверенные routes:

```text
GET  /api/health/live
GET  /api/health/ready
GET  /api/incidents
GET  /api/incidents/:id
GET  /api/investigations/:id/evidence
POST /api/admin/investigations/:id/recompute
POST /api/replays/:id/start
GET  /api/investigations/:id/export
GET  /api/live/status
GET  /api/source-documents/:id/open
POST /api/admin/ingestion/kazhydromet
POST /api/admin/ingestion/gdelt
```

Health:

```json
{"status":"ok","service":"caspian-trace-api"}
{"status":"ok","service":"caspian-trace-api","database":"ready"}
```

Incidents list содержит три current version IDs: September L2, May L3, Aktau L0. Stable aliases `inv-atyrau-2025-09`, `inv-atyrau-2025-05`, `inv-aktau-insufficient` отвечают `200`.

- September: 4 measurements, 4 stations, L2, open-upstream corridor.
- May: 2 measurements, 2 stations, L3, between-stations corridor.
- Aktau: 0 measurements, 0 stations, L0, `corridorBounds=null`.

Evidence: `200`, 2 statements с unique sort order — `NO_LOCAL_INCREASE_IN_PAIR` и `MAXIMUM_UPSTREAM_OF_OBJECT`, 4 measurements, 2 source documents.

Replay: два `POST` вернули byte-identical payload, 6 steps. Recompute без token: normalized `401 INGESTION_UNAUTHORIZED`. Два recompute с реальным token вернули одинаковые hash/ruleset/level/corridor; token не выводился и не логировался.

Source open:

```text
September: 302, Cache-Control: private, no-store; Referrer-Policy: no-referrer.
Signed URL проверен, но намеренно не записан в report.
May: 404 SOURCE_SNAPSHOT_NOT_AVAILABLE с requestId.
```

Export/dossier:

```text
GET /api/investigations/inv-atyrau-2025-09/export?format=json: 200, attachment JSON
GET /api/investigations/inv-atyrau-2025-09/export?format=html: 200, attachment HTML
HTML: Content-Security-Policy default-src 'none'; X-Content-Type-Options nosniff
```

JSON dossier: L2, exact September input hash, 4 measurements, 2 sources, legal disclaimer. Unknown incident: normalized `404 INVESTIGATION_NOT_FOUND` с requestId.

Live status:

```text
kazhydromet-bulletins: healthy, cacheAvailable=true
gdelt: failed, cacheAvailable=false, lastSuccessAt=null
direct-sources: healthy, cacheAvailable=true
```

## 9. Frontend integration

```text
Default data mode: api
API base URL: /api
Vite proxy: /api -> http://localhost:3000
Seed fallback: explicit VITE_DATA_MODE=seed, сохранён и отдельно собран
```

Browser smoke выполнен headless Chromium против реальных NestJS/Vite processes:

- [x] September загружается из `/api`, L2 и open-upstream conclusion видны.
- [x] May switch работает, L3 и раскрытая exact delta `+0,079` видны.
- [x] Aktau показывает L0/недостаточность без выдуманной географии.
- [x] Refresh сохраняет выбранный May case и снова загружает API data.
- [x] Source links присутствуют; отдельный API source-open smoke выполнен.
- [x] Evidence blocks раскрываются.
- [x] Replay запускается.
- [x] Dossier route открывается и показывает September `0,058`, `0,054`, `0,234`, `0,167` и legal disclaimer.
- [x] JSON/HTML export endpoints проходят.
- [x] Zod/API errors и uncaught console errors отсутствуют.

Headless Chromium выдавал только WebGL performance warnings; в одном запуске внешние OpenStreetMap tiles были недоступны и MapLibre логировал warnings. Это не меняло investigation facts/UI и не создавало fabricated coordinates.

## 10. LLM и внешние источники

```text
LLM provider: DisabledLlmProvider
LLM_PROVIDER: disabled
Gemini provider/prompts/free-tier transport: absent
External LLM requests: disabled
GDELT: failed, честно отражён в live status
Казгидромет: healthy, cached snapshot available
Direct sources: healthy, cache available
Storage: September private snapshot доступен через short-lived signed redirect
```

## 11. Git integration

```text
Safety checkpoint branch: backup/pre-final-integration-20260807-044044
Backend stabilization commit: 1743cae9ae916b6936823ffd96bd71bef141924b
Frontend merge/application commit: c41ab2ba7d4c57e13f8436508a2c7d89ef8eca92
Report commit: c6652c0cf85f036d1d327fa590d99c3c4d8661dd
Archive metadata commit: b5fdb9d (полный SHA приведён в итоговом handoff)
Remote push: BLOCKED
HTTPS result: could not read Username for https://github.com
SSH result: Permission denied (publickey)
GitHub App Git Data result: 403 Resource not accessible by integration
Partial remote branch/object created: NO
force push used: NO
main modified: NO
```

`git push -u origin integration/final-demo` завершился exit `128` до передачи objects. Проверены `gh` (не установлен), token env (unset), credential helper (не настроен) и SSH agent/key (отсутствуют). GitHub connector подтвердил repository visibility, но первая write-operation `create blob` получила `403`; branch/ref не создавался. Это внешний authentication blocker, а не failure source tree или test suite.

## 12. Clean archive

Final clean archive создан из report commit `c6652c0cf85f036d1d327fa590d99c3c4d8661dd`; последующий source tree отличается только этой записью archive metadata.

```text
archive path: /tmp/caspian-trace-final-demo-20260807-052951.tar.gz
archive filename: caspian-trace-final-demo-20260807-052951.tar.gz
SHA-256: 295d7e0559e20abc7fe89109c10d3b14d98dfb032ea4b2ffa037f28eaba8f161
entries: 594
```

Фактическая проверка `tar -tzf` подтвердила отсутствие:

```text
.git
node_modules
dist
dist-bootstrap
.env
.env.local
coverage
artifacts
```

Backend allowlist archive уже проверен:

```text
/home/denis/projects/caspian-trace/artifacts/caspian-trace-backend-platform-clean-2026-08-07T00-21-18-251Z.tar.gz
304 files
archive tests: 6/6 PASS
```

## 13. Известные ограничения

- GDELT upstream сейчас `failed`; verified demo data и cached sources доступны.
- Для May bulletin cache snapshot отсутствует: source-open честно отвечает `SOURCE_SNAPSHOT_NOT_AVAILABLE`; original official HTTPS URL остаётся в dossier.
- Human review gate verified seed не обходился и `data/verified/**` не менялся.
- Frontend production bundle имеет size warning; это performance follow-up, не runtime blocker.
- OpenStreetMap tiles зависят от внешней сети; отсутствие tiles не используется как доказательство и не меняет L0–L3.
- Dependency audit/Node 22 engine warnings требуют отдельного dependency review; Node 20.20.2 обязательные gates проходят.

## 14. Demo runbook

Terminal A:

```bash
nvm use 20.20.2
npm run dev:api
```

Terminal B:

```bash
nvm use 20.20.2
npm run dev -w web -- --host 127.0.0.1
```

Открыть `http://127.0.0.1:5173/`:

1. September: `0,234 → 0,058 → 0,054 → 0,167`, L2/open upstream.
2. Раскрыть evidence/source и запустить replay.
3. Переключить May: `0,114 → 0,193`, delta `+0,079`, L3/between stations.
4. Открыть dossier/JSON export.
5. Переключить Aktau: L0, «Недостаточно данных».

## 15. Final verdict

```text
Ready for submission: YES locally; NO as remote handoff until authenticated push
Blocking issues: remote branch is not published because GitHub write authentication is unavailable
Non-blocking issues: GDELT failed; May cached snapshot unavailable; external map tiles; dependency/chunk warnings
Recommended API URL: http://127.0.0.1:3000/api
Recommended web URL: http://127.0.0.1:5173
Final local branch: integration/final-demo
```
