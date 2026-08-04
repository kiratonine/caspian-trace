# «Каспийский след»: план Backend 1 — платформа, Prisma и источники

> Роль: Full-stack разработчик 1, фактически backend/platform  
> Ветка: `feat/backend-platform`  
> Главная ответственность: NestJS, Prisma/Supabase, seed, source cache, ingestion и read API  
> Не отвечает за: investigation-core, evidence rules, replay/export и frontend

---

## 1. Результат роли

К концу работы Backend 1 должен передать:

- рабочее NestJS-приложение;
- Prisma schema и воспроизводимую историю migrations;
- подключение к Supabase PostgreSQL;
- закрытый Supabase Storage bucket для исходников;
- идемпотентный verified seed;
- read API событий;
- безопасное скачивание и кэширование публичных источников;
- ingestion Казгидромета и публичных публикаций;
- live status источников;
- готовую точку подключения модулей Backend 2;
- инструкции локального и production запуска.

Backend 1 не определяет уровень L0–L3 и не пишет причинные правила. Он хранит факты и отдаёт данные.

---

## 2. Зона владения файлов

Backend 1 единолично редактирует:

```text
apps/api/package.json
apps/api/prisma.config.ts
apps/api/prisma/**
apps/api/src/main.ts
apps/api/src/app.module.ts
apps/api/src/config/**
apps/api/src/prisma/**
apps/api/src/health/**
apps/api/src/incidents/**
apps/api/src/sources/**
apps/api/src/ingestion/**
apps/api/src/common/http/**
packages/contracts/**
supabase/config.toml
package.json
package-lock.json
.github/workflows/ci.yml
```

Backend 1 не редактирует:

```text
apps/web/**
packages/investigation-core/**
apps/api/src/investigations/**
apps/api/src/replays/**
apps/api/src/export/**
apps/api/src/llm/**
data/verified/**                 # владелец — Backend 2
```

Исключение: Backend 1 добавляет готовые feature modules Backend 2 в `AppModule` во время интеграции. Он не меняет их внутренний код.

---

## 3. Критический bootstrap commit, 0:00–1:30

Этот короткий commit должен попасть в `main` раньше больших backend-веток. Frontend может продолжать работу параллельно на текущем коде, Backend 2 в это время пишет core/fixtures.

### Сделать

1. Добавить workspace `apps/api`.
2. Создать NestJS skeleton.
3. Создать package skeleton:
   - `packages/contracts`;
   - `packages/investigation-core`.
4. Установить полный заранее согласованный набор зависимостей.
5. Обновить один общий `package-lock.json`.
6. Добавить `.env.example`.
7. Настроить root scripts.

### Зависимости API

```text
@nestjs/common
@nestjs/core
@nestjs/config
@nestjs/platform-express
@nestjs/swagger
@nestjs/schedule
@nestjs/throttler
class-transformer
class-validator
prisma
@prisma/client
@prisma/adapter-pg
pg
zod
decimal.js
@supabase/supabase-js
pdfjs-dist
```

### Для тестов

```text
@nestjs/testing
jest
supertest
tsx
```

### Приёмка bootstrap

- `npm ci` выполняется;
- существующий web build не сломан;
- NestJS skeleton запускается;
- Backend 2 может импортировать packages без изменения lockfile;
- после merge все трое обновляют свои ветки.

---

## 4. Общие контракты: единственный владелец

Backend 1 владеет `packages/contracts`, но формы замораживаются совместно на втором часу.

### Обязательные схемы

```text
EvidenceLevelSchema
RegionSchema
SourceDocumentSchema
StationSchema
MeasurementSchema
IncidentSignalSchema
EvidenceStatementSchema
InvestigationSchema
IncidentSummarySchema
IncidentDetailSchema
EvidenceGraphSchema
ReplayScenarioSchema
LiveStatusSchema
DossierSchema
ApiErrorSchema
```

### Правила

- Zod является runtime-источником;
- TypeScript-типы экспортируются через `z.infer`;
- barrel `packages/contracts/src/index.ts` меняет только Backend 1;
- Prisma enum не выходит напрямую в API;
- API region остаётся lowercase;
- `Prisma.Decimal` не выходит в contracts;
- неизвестная страница и координаты — `null`;
- изменения после freeze только additive;
- удаление/переименование поля требует согласия всех троих.

### Sample responses

Сохранить:

```text
packages/contracts/fixtures/incidents.json
packages/contracts/fixtures/incident-september.json
packages/contracts/fixtures/evidence-september.json
packages/contracts/fixtures/replay-september.json
packages/contracts/fixtures/live-status.json
packages/contracts/fixtures/dossier-september.json
```

Frontend работает по ним до готовности API. Backend 2 проверяет по ним свои endpoints.

---

## 5. Этап P1 — NestJS platform, 1:30–4:00

### `main.ts`

Настроить:

- global prefix `/api`;
- CORS только для `WEB_ORIGIN`;
- `ValidationPipe({ transform, whitelist, forbidNonWhitelisted })`;
- Swagger `/api/docs`;
- request id;
- структурированные ошибки;
- graceful shutdown;
- ограничение JSON body.

### Modules

```text
AppModule
├─ ConfigModule
├─ PrismaModule
├─ HealthModule
├─ IncidentsModule
├─ SourcesModule
└─ IngestionModule
```

Модули Backend 2 добавляются позже одним integration commit.

### Config validation

Проверить при старте:

```text
DATABASE_URL
DIRECT_URL                 # нужен CLI, не обязательно runtime process
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_SOURCE_BUCKET
WEB_ORIGIN
INGESTION_TOKEN
```

Не запускать API с пустым `DATABASE_URL`.

---

## 6. Этап P2 — Prisma и Supabase, 2:00–7:00

### Соединения

- `DATABASE_URL`: runtime Prisma Client;
- `DIRECT_URL`: Prisma CLI/migrations;
- постоянный NestJS — Supavisor session `:5432`;
- serverless — transaction `:6543?pgbouncer=true`;
- migrations не запускать через transaction `:6543`.

### `prisma.config.ts`

```ts
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: { url: env('DIRECT_URL') },
});
```

### Модели

Описать все модели полного roadmap:

```text
SourceDocument
SourcePage
Station
StationRelation
Measurement
IncidentSignal
Incident
IncidentSignalLink
CandidateObject
Investigation
InvestigationMeasurement
InvestigationCandidateObject
EvidenceStatement
EvidenceStatementMeasurement
EvidenceStatementSource
InvestigationUnknown
ReplayScenario
ReplayStep
IngestionRun
SourceHealth
```

### Naming

- Prisma fields — camelCase;
- DB tables/columns — snake_case через `@@map/@map`;
- mapping должен быть последовательным во всей schema.

### Migration workflow

```text
prisma format
prisma validate
prisma migrate dev --name initial_schema --create-only
# review/custom CHECK constraints
prisma migrate dev
prisma generate
```

Запрещено:

- `db push` на общей БД;
- `migrate reset` на Supabase project;
- редактировать уже применённую migration;
- параллельная папка migrations другого инструмента.

### PrismaService

Singleton global module с `@prisma/adapter-pg`. `new PrismaClient()` внутри request запрещён.

### Приёмка

- `prisma validate` зелёный;
- migration применяется к чистой тестовой БД;
- `prisma migrate status` чистый;
- `GET /api/health/ready` выполняет DB query;
- generated client доступен Backend 2.

---

## 7. Этап P3 — verified seed, 6:00–9:00

Источник файлов — `data/verified`, которые готовит Backend 2. Пока они не переданы, использовать существующий `apps/web/src/api/seed-data.ts` только как временный reference, не копировать данные вручную в SQL.

### `prisma/seed.ts`

Алгоритм:

1. Прочитать manifest.
2. Zod validate.
3. Проверить SHA format/page/value/unit.
4. Начать `prisma.$transaction`.
5. `upsert` documents.
6. `upsert` stations/relations.
7. `upsert` measurements/signals/incidents.
8. `upsert` current investigation snapshots и replay fixtures.
9. Завершить transaction.

### Важные правила

- seed запускается повторно без дублей;
- конфликт одного id с другим hash останавливает seed;
- `sourcePage=null`, если не подтверждена;
- координаты не подставляются;
- Decimal создаётся из строки, не из JS float;
- `0,234` хранится как raw `"0,234"` и Decimal `0.234`.

### Handoff Backend 2

Backend 2 передаёт:

- два verified JSON;
- manifest;
- golden investigation results;
- подтверждённую страницу мая либо `null`;
- список station relations, которые действительно доказаны.

---

## 8. Этап P4 — read API событий, 8:00–12:00

### Controllers

```ts
IncidentsController.list(query: ListIncidentsDto)
IncidentsController.getOne(id: string)
```

### Services

```ts
IncidentsService.list(filters: IncidentFilters)
IncidentsService.getDetail(investigationId: string)
```

### Repository

```ts
IncidentsRepository.findMany(filters)
IncidentsRepository.findDetail(investigationId)
```

Использовать Prisma `findMany/findUnique` с явным `select/include`. Не возвращать Prisma-модель напрямую из controller: mapper переводит enum, Decimal и названия полей в API contract.

### Endpoints

```http
GET /api/incidents
GET /api/incidents/:id
```

Filters:

```text
status=L0|L1|L2|L3
region=atyrau|mangystau
from=ISO date
to=ISO date
limit=1..100
```

### Detail query

Должен вернуть investigation, region, signals, measurements, stations, candidate objects, source documents и corridor bounds.

### Приёмка 12-го часа

Frontend в API-режиме показывает сентябрьские измерения и серверный L2 result. Даже если recompute Backend 2 ещё не подключён, seed snapshot обязан дать вертикальный demo path.

---

## 9. Этап P5 — Supabase Storage и source cache, 12:00–18:00

### StorageService

```ts
uploadImmutableSnapshot(input): Promise<StorageObject>
createSignedReadUrl(path, expiresInSeconds): Promise<string>
exists(path): Promise<boolean>
```

Bucket `source-documents` закрытый.

Object path:

```text
{sourceType}/{yyyy}/{mm}/{sha256}.{extension}
```

### Source persistence

```ts
SourcesService.persistSnapshot(input): Promise<SourceDocumentDto>
SourcesService.openSource(id, page?): Promise<OpenSourceResult>
```

Шаги: canonical URL → fetch bytes → SHA-256 → Prisma unique check → Storage upload → Prisma transaction. Raw snapshot не удаляется при ошибке parser.

### Endpoint

```http
GET /api/source-documents/:id/open?page=22
```

При недоступном original возвращать signed cached URL. Не раскрывать service role key.

---

## 10. Этап P6 — SafeFetchService, 12:00–16:00

### Методы

```ts
fetchBuffer(url, policy): Promise<FetchBufferResult>
fetchText(url, policy): Promise<FetchTextResult>
fetchJson(url, schema, policy): Promise<T>
```

### Защиты

- только HTTPS;
- allowlist доменов;
- DNS/IP проверка против private/loopback;
- redirect только в allowlist;
- timeout AbortController;
- max bytes/content-type;
- максимум 3 redirect;
- retry 408/429/5xx;
- Retry-After/backoff;
- никакого URL из публичного user input.

### Tests

- localhost/redirect на private IP заблокирован;
- HTML вместо PDF отклонён;
- файл больше 15 МБ отклонён;
- timeout нормализован;
- 429 не считается пустым ответом.

---

## 11. Этап P7 — Казгидромет ingestion, 16:00–24:00

### Adapter

```ts
KazhydrometAdapter.discover(window): Promise<PdfCandidate[]>
KazhydrometAdapter.fetch(candidate): Promise<RawSnapshot>
KazhydrometAdapter.parse(snapshot): Promise<ParsedRecord[]>
```

### Discovery/PDF

- найти PDF links на monthly bulletin page;
- сохранить surrounding text;
- фильтр Атырау/Мангистау и период;
- `%PDF`, max 15 МБ;
- page extraction через `pdfjs-dist`;
- сохранить `SourcePage` через Prisma transaction;
- поиск `нефтепродукт`, `Жайык`, `Атырау`;
- candidate values сверяются с page text.

### Stop condition

Если за 4 часа parser не повторяет verified fixture, остановить универсализацию. Оставить скачивание, hash, Storage, page extraction, relevant-page detection и verified seed для measurements.

---

## 12. Этап P8 — GDELT и прямые публикации, 20:00–27:00

### GDELT

```ts
GdeltAdapter.buildQuery(window): URL
GdeltAdapter.discover(window): Promise<ArticleCandidate[]>
GdeltAdapter.mapArticle(raw): SourceDocumentCandidate
```

Endpoint: `https://api.gdeltproject.org/api/v2/doc/doc`.

Параметры: `mode=artlist`, `format=json`, `maxrecords=50`, `sort=datedesc`, `startdatetime`, `enddatetime`.

### 429

- TTL 30 минут;
- один retry;
- cached last success;
- `source_health=rate_limited`;
- не возвращать пустой массив как «нет событий».

### Direct fallback allowlist

```text
kazhydromet.kz
inform.kz
azh.kz
zakon.kz
gov.kz
```

Backend 1 сохраняет raw articles. Структурное LLM-извлечение реализует Backend 2 и подключается после merge через `LlmService`.

---

## 13. Этап P9 — live status и ingestion administration, 24:00–29:00

### Endpoints

```http
GET /api/live/status
POST /api/admin/ingestion/kazhydromet
POST /api/admin/ingestion/gdelt
```

POST требует `X-Ingestion-Token`.

### Services

```ts
SourceHealthService.startAttempt(sourceId)
SourceHealthService.markSuccess(sourceId, metadata)
SourceHealthService.markFailure(sourceId, error)
SourceHealthService.markRateLimited(sourceId, retryAt?)
SourceHealthService.getAll()
```

Не добавлять queue/Redis. Для 60 часов достаточно ручного endpoint.

---

## 14. Этап P10 — подключение Backend 2, 29:00–34:00

Backend 2 передаёт:

```text
InvestigationsModule
ReplaysModule
ExportModule
LlmModule
```

Backend 1 делает только wiring в `AppModule`.

Проверить:

- нет circular dependency;
- общий `PrismaService`;
- один contracts package;
- routes не пересекаются;
- Swagger содержит оба набора endpoints;
- `LLM_PROVIDER=disabled` не ломает ingestion.

Schema request от Backend 2 реализует Backend 1 новой Prisma migration.

---

## 15. Этап P11 — integration tests и CI, 34:00–41:00

### Prisma

- clean `migrate deploy`;
- `db seed` два раза;
- migration status;
- Decimal roundtrip;
- relation cascade;
- source URL/hash uniqueness.

### API

- health live/ready;
- incidents filters/detail;
- live status degraded;
- source original/cache;
- admin token;
- malformed query 400;
- unknown id 404.

### CI

```text
npm ci
prisma validate
prisma generate
typecheck
lint
test
build
```

Integration job выполняет `prisma migrate deploy` перед tests.

---

## 16. Этап P12 — deployment/runbook, 41:00–48:00

### Production

1. Установить env secrets.
2. `prisma migrate deploy`.
3. `prisma db seed`.
4. Запустить NestJS.
5. Проверить `/api/health/ready`.
6. Проверить Storage signed URL.
7. Проверить CORS.

### Локальный план Б

```text
npm ci
npm run prisma:generate
npm run prisma:migrate:deploy
npm run seed
npm run dev:api
npm run dev:web
```

Сохранить cached PDF/articles до демо.

---

## 17. Что Backend 1 не должен делать

- не писать причинные правила и L0–L3;
- не генерировать conclusion;
- не добавлять frontend components;
- не менять replay payload самостоятельно;
- не создавать координаты;
- не делать универсальный parser ценой MVP;
- не добавлять второй ORM;
- не использовать Prisma raw `Unsafe`;
- не создавать PrismaClient на каждый request.

---

## 18. План commits

```text
chore(repo): bootstrap NestJS Prisma workspaces
feat(contracts): freeze MVP API schemas and fixtures
feat(db): add Prisma schema migrations and verified seed
feat(api): add incidents read endpoints
feat(sources): add immutable Supabase source cache
feat(ingestion): add safe fetch and Kazhydromet adapter
feat(ingestion): add GDELT cache and direct fallbacks
feat(api): expose source health and admin ingestion
test(api): cover migrations seed sources and incidents
chore(api): add deployment and local demo runbook
```

---

## 19. Handoff интегратору

Перед merge передать:

- migration status;
- env list;
- seed result;
- Swagger URL;
- endpoints;
- cached documents;
- health output;
- test/build output;
- known source limitations;
- schema requests Backend 2.

---

## 20. Definition of Done Backend 1

- [ ] Bootstrap commit принят командой.
- [ ] Один package-lock, один ORM, одна migration history.
- [ ] Prisma schema содержит все модели MVP.
- [ ] Prisma Client singleton.
- [ ] Clean migration и повторный seed работают.
- [ ] Incidents list/detail работают.
- [ ] Decimal/enum корректно отображаются в API.
- [ ] Source snapshots имеют URL/SHA/Storage path.
- [ ] SafeFetch защищён и протестирован.
- [ ] Казгидромет PDF сохраняется и разбивается по страницам.
- [ ] GDELT 429 использует кэш.
- [ ] Live status различает degraded и empty.
- [ ] Admin endpoints защищены token.
- [ ] Модули Backend 2 подключены без изменения их логики.
- [ ] Swagger, tests и production build зелёные.
- [ ] Локальный offline/cache план Б проверен.

---

## 21. Общий порядок объединения веток

1. Влить bootstrap commit в `main`, затем дать команде точный SHA.
2. Создать `integration/mvp` от актуального `main`.
3. Влить `feat/backend-platform`.
4. Влить `feat/backend-investigation`.
5. Backend 1 разрешает только конфликты Prisma schema/migrations, contracts, `AppModule`, package manifests и lockfile; внутренние feature-конфликты возвращает Backend 2.
6. Влить `feat/frontend-mvp`; `apps/web` разрешает frontend-разработчик.
7. Выполнить `npm ci`, `prisma validate`, `prisma generate`, `prisma migrate deploy`, seed, typecheck, tests и build.
8. Провести сквозной replay/dossier тест.
9. После подтверждения всех троих объединить integration-ветку с `main`.

Backend 1 является техническим интегратором только для shared/platform-файлов, а не владельцем чужой бизнес-логики.
