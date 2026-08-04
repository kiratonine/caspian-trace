# Backend Platform Part 01 — отчёт

## 1. Результат

Part 01 исправлена и завершена в пределах Backend 1:

- API объявляет настоящую workspace dependency `@caspian-trace/contracts@0.0.1`;
- API build, production start и `npm run dev:api` сами предварительно собирают contracts, поэтому не зависят от случайно оставшегося `packages/contracts/dist`;
- `types` пакета contracts указывает на `dist/index.d.ts`, а Jest API больше не подменяет пакет путем к `src/index.ts`;
- добавлена воспроизводимая clean-start regression: она удаляет только generated dist, строит API и contracts заново и проверяет health для production и watch-dev запусков;
- `HttpExceptionFilter` сохраняет валидные custom `{code,message}`, отделяет неизвестный route, ValidationPipe, malformed JSON и body limit;
- contracts/fixtures исправлены без вымышленных station relations, corridor или L2 при неподтвержденном порядке створов;
- measurements и source documents без полного provenance больше не объявляются завершённо verified;
- evidence statement сообщает только факт 0,234 мг/дм³ на указанном створе, не неподтверждённый максимум;
- live-status не заявляет cache до реализации Storage/cache;
- Node закреплен на `20.20.2` через `.nvmrc`/`.node-version`, при сохраненном engine range `>=20.19 <21`;
- future integration env validation принимает реальный `process.env`, игнорируя стандартные system keys и строго проверяя только известные integration keys;
- evidence statements видов `supports`, `contradicts`, `limits` требуют source provenance; `unknown` может сохранять пустые ID-массивы;
- candidate object не проходит contract boundary без документа-основания;
- создан allowlist-only archive с единственным отчетом по адресу `docs/backend-platform/part-01-bootstrap-contracts-platform-report.md`;
- Prisma, migrations, seed, incidents API, ingestion, Backend 2 и frontend source не изменялись.

## 2. Preflight и границы

- Текущая ветка: `main`, а не ожидаемая `feat/backend-platform`. Ветка не переключалась.
- Последний commit: `18afc1f docs: обновлённое ТЗ команды и разбор контекста для фронтенда`.
- Исходный runtime: Node `v24.10.0`, npm `11.6.1`.
- Исходный status содержал пользовательские `D CLAUDE.md`, `AGENTS.md`, `AGENTS.md:Zone.Identifier`, `TODO/**`, `docs/context-backend-1/**` и незакоммиченную реализацию Part 01. Эти файлы не удалялись и чужие изменения не перезаписывались.
- Прочитаны все пять обязательных документов `docs/context-backend-1/**`, root manifests/lockfile/gitignore, frontend contracts/seed/API stubs, `docs/decisions.md`, `docs/stubs.md` и конфигурации проекта.
- Изменений в `apps/web/**`, `packages/investigation-core/**`, `data/verified/**`, Prisma и модулях Backend 2 нет.
- Git commit/push/pull/merge/rebase/reset/checkout/clean не выполнялись.

## 3. Изменённые и созданные файлы

Корень:

- `.nvmrc` — точная целевая версия Node `20.20.2`;
- `.node-version` — точная целевая версия Node `20.20.2` для совместимых version managers;
- `package.json` — Node engine, aggregate scripts, `dev:api`, clean-start regression и archive command;
- `package-lock.json` — единый npm lockfile с API → contracts workspace dependency и `@types/node@20.19.43` для API/contracts;
- `TODO/backend-platform-part-01-bootstrap-contracts-platform.md` — удален старый nested report path, оставлен только flat report path.

API workspace:

- `apps/api/package.json` — workspace dependency, lifecycle prebuild/prestart/pretest, Node engine/`@types/node`, Jest без source mapper;
- `apps/api/nest-cli.json` — Nest build config;
- `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json` — strict TypeScript/build config;
- `apps/api/eslint.config.mjs` — API lint config;
- `apps/api/.env.example` — только placeholders;
- `apps/api/src/main.ts` — Nest bootstrap и graceful shutdown;
- `apps/api/src/app.module.ts` — platform modules;
- `apps/api/src/config/environment.ts` — Zod environment validation и allowlist-проекция future integration keys;
- `apps/api/src/config/application.setup.ts` — prefix/CORS/body parser/ValidationPipe/Swagger и точное преобразование parser errors;
- `apps/api/src/common/http/http-exception.filter.ts` — единая error boundary с сохранением custom errors;
- `apps/api/src/common/http/request-id.middleware.ts`, `request-with-id.ts` — request ID;
- `apps/api/src/health/health.module.ts`, `health.controller.ts`, `dto/health-live.dto.ts` — только `GET /api/health/live`;
- `apps/api/test/set-env.ts` — test env с малым body limit;
- `apps/api/test/config.spec.ts` — 6 config unit tests, включая system env keys и invalid DB URLs;
- `apps/api/test/app.e2e-spec.ts` — 9 e2e: health, request ID, unknown route, ValidationPipe, custom 400/404, malformed JSON, body limit, Swagger.

Contracts workspace:

- `packages/contracts/package.json` — `types: dist/index.d.ts`, Node engine и Node 20 typings;
- `packages/contracts/tsconfig.json`, `src/index.ts` — standalone declaration build/public barrel;
- `packages/contracts/src/schemas.ts` — Zod runtime contracts;
- `packages/contracts/test/contracts.spec.ts` — 25 fixture/boundary regression tests;
- `packages/contracts/fixtures/incidents.json`;
- `packages/contracts/fixtures/incident-september.json`;
- `packages/contracts/fixtures/evidence-september.json`;
- `packages/contracts/fixtures/replay-september.json`;
- `packages/contracts/fixtures/live-status.json`;
- `packages/contracts/fixtures/dossier-september.json`.

Archive и отчет:

- `scripts/verify-api-clean-start.mjs` — реальная clean build/start/dev regression;
- `scripts/create-backend-platform-archive.mjs` — allowlist дополнен Node version files и regression script;
- `scripts/create-backend-platform-archive.test.mjs` — archive assertions для новых файлов;
- `docs/backend-platform/part-01-bootstrap-contracts-platform-report.md` — этот единственный отчет;
- `artifacts/caspian-trace-backend-platform-clean-2026-08-04T13-25-00-000Z.tar.gz` — итоговый clean archive после contract provenance correction, 40 entries.

## 4. Решение workspace dependency

`apps/api` зависит от `@caspian-trace/contracts: 0.0.1`; npm связывает его с локальным workspace. API lifecycle запускает contracts build до API build, typecheck, unit/e2e tests, production start и dev start. Production `start` сначала выполняет полный API build. Поэтому clean checkout после `npm ci` не требует заранее существующего `packages/contracts/dist`.

`packages/contracts/package.json` публикует runtime entry `dist/index.js` и declaration entry `dist/index.d.ts`. Удален Jest `moduleNameMapper`, который ранее маскировал отсутствие dependency/build, перенаправляя импорт прямо в contracts source.

`scripts/verify-api-clean-start.mjs`:

1. удаляет только generated `apps/api/dist` и `packages/contracts/dist`;
2. выполняет `npm run build -w api`;
3. проверяет наличие API main, contracts JS и declaration;
4. поднимает `npm run start -w api` и проверяет `/api/health/live`;
5. повторно удаляет dist, поднимает `npm run dev:api` и проверяет тот же health.

## 5. HTTP errors

ValidationPipe создает явный custom `VALIDATION_ERROR`. Filter сначала сохраняет любой валидный custom `{code,message}`; поэтому domain 400/404 не теряются. Только стандартный Nest 404 вида `Cannot METHOD /path` становится `ROUTE_NOT_FOUND`.

Express body parser запускается после request ID middleware. Его точные `entity.parse.failed` и `entity.too.large` преобразуются в custom Nest exceptions, которые проходят через общий filter как:

- `MALFORMED_JSON`, HTTP 400;
- `PAYLOAD_TOO_LARGE`, HTTP 413.

Неизвестные ошибки 5xx не раскрывают внутренние детали. Все проверенные ошибки соответствуют `{code,message,requestId}`.

## 6. Contracts и fixtures

- `ExtractionMode`: только `llm_verified | rule | verified_seed`; прежний `llm` отклоняется.
- Zakon signal имеет `verificationStatus: corroborated`, не `official`.
- Replay связывает официальный лабораторный шаг с бюллетенем Казгидромета, а не выдает публикацию Zakon за официальный первоисточник.
- Сентябрьский fixture имеет L1: сохранены лабораторные измерения, но удалены L2-опровержение, corridor bounds и spatial conclusion.
- Все station relations в этом fixture нейтральны, `relatedObjectId: null`, `riverOrder: null`.
- `Station.locationSourceDocumentId` nullable и обязателен ровно тогда, когда есть `location`.
- `{lat:0,lon:0}` отклоняется как sentinel неизвестной географии; неизвестная география остается `null`.
- Source documents с `sha256: null` и `fetchedAt: null` имеют `status: unverified`; schema запрещает `status: verified` без обоих provenance fields.
- Measurements с `sourceExcerpt: null` имеют `verified: false`; schema запрещает `verified: true` без source excerpt.
- Evidence statement с одним measurement ID сформулирован как «на створе зафиксировано 0,234 мг/дм³», без утверждения о максимуме, причине или пространственном выводе.
- Все источники в `live-status.json` имеют `cacheAvailable: false`, пока Storage/cache не реализованы.
- `EvidenceStatementSchema` требует минимум один `sourceDocumentId` для `supports`, `contradicts` и `limits`; `unknown` допускает пустые `measurementIds` и `sourceDocumentIds`.
- `measurementIds` не имеет общего `.min(1)`: документально подтвержденное statement может не ссылаться на measurement.
- `CandidateObjectSchema.evidenceDocumentIds` требует минимум один ID.

Handoff Backend 2: подтвердить порядок створов и relations отдельными provenance-backed данными. Только после этого deterministic core может пересчитать L2, corridor и причинно-пространственные ограничения. Backend 1 не выдумывает relations и не вычисляет этот результат.

## 7. Node 20

Root, API и contracts имеют `engines.node: >=20.19 <21`; `.nvmrc` и `.node-version` содержат точную версию `20.20.2`. API/contracts используют прямой `@types/node^20.19.0`, фактически установлен `20.19.43`. Frontend manifest не менялся и сохраняет собственную dependency.

Node 20.18 несовместим с Vite 8 и используемым Rolldown 1.2.2: Vite 8 требует ветку Node не ниже 20.19. На 20.18 npm также может пропустить несовместимый native optional binding, после чего frontend build падает уже при загрузке Rolldown. Поэтому reproducible baseline закреплен на 20.20.2, а install выполняется с `--include=optional`.

Root optional dependency `@rolldown/binding-linux-x64-gnu@1.2.2` сохранена и соответствует lockfile. После clean install `npm ls` подтвердил установленный exact binding `1.2.2`.

### Future integration env validation

`validateFutureIntegrationEnvironment` принимает полный объект наподобие `process.env`, выбирает только известные integration keys и затем передает их в strict Zod schema. Поэтому `PATH`, `HOME`, `USER`, `WSL_DISTRO_NAME`, `WSL_INTEROP` и другие системные переменные не вызывают ошибку и не попадают в возвращаемую конфигурацию. При этом известные `DATABASE_URL` и `DIRECT_URL` не обходят validation: неверный protocol/URL отклоняется.

## 8. Проверки

Все команды финального correction-прогона ниже выполнены через exact `node@20.20.2` окружение; `node --version` вернул `v20.20.2`.

| Команда | Статус | Фактический результат |
|---|---|---|
| `npm install` | PASS | lockfile обновлен; exit 0. |
| `npm ci --include=optional` | PASS | clean install 972 packages на Node 20.20.2; exit 0; EBADENGINE отсутствует. |
| `npm ls @rolldown/binding-linux-x64-gnu --depth=0` | PASS | установлен exact `1.2.2`; exit 0. |
| contracts: `typecheck`, `test`, `build` workspace scripts | PASS | все три команды exit 0; contracts 25/25. |
| API: `test`, `test:e2e`, `build` workspace scripts | PASS | unit 6/6, e2e 9/9, build exit 0. |
| `npm run typecheck --workspaces --if-present` | PASS | API, web, contracts; API использовал собранный declaration; exit 0. |
| `npm run lint --workspaces --if-present` | PASS | API и web; exit 0. |
| `npm run test --workspaces --if-present` | PASS | API unit 6/6, contracts 25/25; exit 0. |
| `npm run test:e2e -w api` | PASS | 9/9 e2e; exit 0. |
| `npm run build --workspaces --if-present` | PASS | API, web, contracts; web 2070 modules; exit 0. |
| `npm run test:api-clean-start` | PASS | dist удален/восстановлен; production и dev health прошли на Node 20.20.2; exit 0. |
| `npm run typecheck -w web` | PASS | frontend regression; exit 0. |
| `npm run lint -w web` | PASS | frontend regression; exit 0. |
| `npm run build -w web` | PASS | frontend regression; только warning chunk >500 kB; exit 0. |
| `node --test scripts/create-backend-platform-archive.test.mjs` | PASS | 6/6 на Node 20.20.2; exit 0. |
| `npm run archive:backend-platform` / deterministic final invocation | PASS | 40-entry archive создан. |
| `tar -tzf ...` и forbidden-path scan | PASS | запрещенные/secret/generated paths отсутствуют. |
| `git diff --check` | PASS | exit 0. |
| `npm audit --omit=dev` | FAIL | 2 high в существующем frontend `react-router`; fix требует breaking downgrade вне Backend 1 scope. |

Промежуточные исправленные проверки: первый lint обнаружил 3 style errors; следующий прогон прошел. Первый новый malformed JSON e2e выявил преобразование SyntaxError самим Nest; после явного parser mapping финальный e2e прошел 9/9.

## 9. Archive

Итоговый файл:

`artifacts/caspian-trace-backend-platform-clean-2026-08-04T13-25-00-000Z.tar.gz`

Archive содержит 40 отсортированных allowlist entries, включая Node version files, API/contracts source/tests, clean-start regression, Part 01 TODO и этот report. Он не содержит `apps/web`, Backend 2, `data/verified`, `.env`, secrets, `node_modules`, `dist`, coverage, generated clients, artifacts или `Zone.Identifier`.

## 10. Осталось и handoff

Backend 2:

- предоставить provenance для station order/relations и после этого пересчитать September L2/corridor;
- использовать `@caspian-trace/contracts` и новый `ExtractionMode: llm_verified`;
- не восстанавливать L2 из названий створов без подтвержденных relations.

Frontend:

- source не менялся; typecheck/lint/build прошли;
- отдельным согласованным изменением перейти на shared contracts, nullable location provenance и обновленный extraction mode;
- отдельно решить high advisory React Router; `npm audit fix --force` не запускался.

Отложено по scope:

- Prisma schema/config/client/migrations;
- PostgreSQL/Supabase и readiness DB check;
- verified seed;
- incidents API;
- Storage, SafeFetch, Казгидромет/GDELT ingestion;
- investigations/replays/export/LLM runtime Backend 2.

## 11. Финальный Git status

```text
## main...origin/main
 D CLAUDE.md
 M package-lock.json
 M package.json
?? .node-version
?? .nvmrc
?? AGENTS.md
?? TODO/
?? apps/api/
?? artifacts/
?? docs/backend-platform/
?? docs/context-backend-1/
?? packages/
?? scripts/
```

## Выполненные этапы Backend 1

- [~] Критический bootstrap, 0:00–1:30 — технический scope выполнен; Git commit намеренно не создан по прямому запрету.
- [x] Общие контракты: Backend 1 — единственный владелец.
- [x] Этап P1 — NestJS platform, 1:30–4:00.
- [x] Дополнительный deliverable — clean archive Backend 1.
- [ ] Этап P2 — Prisma и Supabase — не начинался.
- [ ] Этап P3 — verified seed — не начинался.
- [ ] Этап P4 — incidents read API — не начинался.
- [ ] Этап P5+ — Storage, SafeFetch и ingestion — не начинались.
