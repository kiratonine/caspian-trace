# «Каспийский след»: полный план разработки MVP

> Статус документа: рабочая инструкция для команды хакатона  
> Репозиторий: <https://github.com/kiratonine/caspian-trace>  
> Целевой стек: React + TypeScript + Vite + shadcn/ui + NestJS + Prisma ORM + PostgreSQL (Supabase)  
> ORM и миграции: Prisma 7 (`Prisma Client`, `Prisma Migrate`, `@prisma/adapter-pg`)  
> Срок: 60 часов  
> Команда: 1 frontend-разработчик, 2 full-stack-разработчика

---

## 0. Как пользоваться этим документом

Это не продуктовая презентация, а порядок сборки рабочего демо. Каждый этап содержит:

- результат этапа;
- конкретные файлы и модули;
- методы, функции и API-контракты;
- критерий приёмки;
- условия, при которых работу нужно упростить или остановить.

Правило хакатона: этап считается завершённым только после проверки критерия приёмки. Наличие написанного кода само по себе не означает завершение этапа.

### Главная последовательность

1. Зафиксировать доказательный кейс и контракты.
2. Сделать вертикальный путь на реальных данных.
3. Только после этого автоматизировать загрузку данных.
4. Затем закончить реплей, досье и демонстрационный сценарий.
5. Карта, живая лента и дополнительные регионы делаются только при наличии подтверждённых координат и свободного времени.

---

## 1. Что строим

«Каспийский след» объединяет публичные сообщения об экологическом событии, официальные лабораторные измерения и подтверждённый порядок точек на водном объекте. Детерминированный движок исключает физически несовместимые версии и показывает самый узкий участок, который поддерживается доступными фактами.

Допустимая формулировка результата:

> Источник не установлен. По доступным данным максимум зафиксирован выше города; локальный интервал у городского выпуска не объясняет этот максимум. Поиск следует продолжать выше створа «1 км выше Атырау».

Недопустимая формулировка:

> Предприятие X виновно в загрязнении.

### Пользователь

Журналист экологической тематики или сотрудник экологической НКО, которому нужно быстро собрать проверяемую цепочку фактов по загрязнению Каспия и не выдать предположение за доказательство.

### MVP обязательно умеет

- открыть сентябрьский кейс 2025 года на Жайыке;
- показать публичный сигнал и официальный документ;
- показать измерения с кликабельной ссылкой на страницу PDF;
- воспроизвести вывод на сервере, а не получить его из LLM;
- исключить версию, не объясняющую максимум выше по течению;
- показать коридор поиска и уровень доказательности;
- сравнить сентябрь с маем 2025 года;
- показать полноценное состояние «недостаточно данных» для Актау;
- воспроизвести трёхминутный реплей;
- сформировать публичное HTML-досье;
- продолжить демо из подготовленного кэша при отказе внешних API.

### MVP не делает

- не определяет виновника;
- не прогнозирует уровень моря;
- не использует спутниковые снимки;
- не управляет работой экологических служб;
- не считает отсутствие объекта в OSM доказательством его отсутствия;
- не использует волны как доказательство направления течения;
- не обучает собственную ML-модель;
- не требует пользовательского ввода вымышленных значений.

---

## 2. Текущее состояние репозитория

На момент подготовки плана в `main` уже есть npm-монорепозиторий и рабочий фронтенд в `apps/web`.

### Уже реализовано

- React 19, TypeScript strict, Vite 8, Tailwind 4, shadcn/ui на Base UI;
- TanStack Query, Zustand, React Router;
- трёхколоночный экран;
- лента событий и сигналов;
- линейная схема реки без вымышленных координат;
- панель вывода и доказательств;
- кликабельные значения измерений;
- реальные seed-данные мая и сентября 2025 года;
- экран Актау «недостаточно данных»;
- API-заглушки для пяти серверных методов;
- dev-галереи компонентов;
- адаптивный каркас и светлая/тёмная темы.

### Следующая фронтенд-задача в текущем плане

Реплей: Zustand-store, воспроизведение по времени, pause/seek и синхронизация всех трёх колонок без повторных запросов.

### Что устарело и должно быть обновлено до начала backend-разработки

В `docs/spec.md` ещё указан SQLite, а `CLAUDE.md` описывает разделение работы под старую архитектуру Express/SQLite. Команда выбрала NestJS + Prisma + Supabase PostgreSQL, поэтому в этапе 1 нужно исправить эти документы и больше не использовать старый стек как источник решений.

### Активные фронтенд-заглушки

| Функция | Эндпоинт |
|---|---|
| `fetchIncidents` | `GET /api/incidents` |
| `fetchIncidentDetail` | `GET /api/incidents/:id` |
| `startReplay` | `POST /api/replays/:id/start` |
| `fetchInvestigationEvidence` | `GET /api/investigations/:id/evidence` |
| `fetchLiveStatus` | `GET /api/live/status` |

Цель интеграции — заменить их по одной, не переписывая готовые UI-компоненты.

---

## 3. Целевая архитектура

```text
Публичные сайты / PDF / JSON API
                |
                v
        NestJS ingestion adapters
                |
       raw snapshot + sha256
                |
        Supabase Storage (PDF/HTML)
                |
       parse -> validate -> normalize
                |
                v
       Supabase PostgreSQL + PostGIS
                |
                v
   packages/investigation-core
   детерминированные правила
                |
                v
        NestJS REST API / OpenAPI
                |
                v
  React + TanStack Query + Zustand
```

### Граница ответственности

**React** отображает серверный вывод. Он не вычисляет `delta`, уровень L0–L3, коридор и исключённые версии.

**NestJS** валидирует входы, управляет источниками, вызывает движок, отдаёт REST API и экспорт. Доступ к прикладным таблицам идёт через singleton `PrismaService`.

**PostgreSQL** в Supabase хранит нормализованные факты, provenance, снимки источников, результаты расследований и сценарии реплея; schema и миграции контролирует Prisma Migrate.

**Supabase Storage** хранит кэш исходных PDF/HTML. Бакет закрытый; выдача идёт через NestJS или временную подписанную ссылку.

**LLM** извлекает структуру из текста и формулирует черновое объяснение только из переданных фактов. LLM не определяет источник и не записывает измерение без детерминированной проверки.

### Почему без прямого доступа React к Supabase

- один API-контракт вместо двух;
- `service_role` никогда не попадает в браузер;
- причинные правила нельзя обойти прямым запросом к таблицам;
- проще переключить фронтенд между API и аварийным seed-режимом;
- легче логировать, тестировать и экспортировать целое расследование.

### Рекомендуемая структура монорепозитория

```text
caspian-trace/
├─ apps/
│  ├─ web/                         # существующий React/Vite
│  └─ api/                         # новый NestJS
│     ├─ prisma/
│     │  ├─ schema.prisma          # единственный источник модели БД
│     │  ├─ migrations/            # история Prisma Migrate
│     │  └─ seed.ts                # идемпотентный verified seed
│     ├─ prisma.config.ts           # Prisma CLI: schema, migrations, DIRECT_URL
│     ├─ src/
│     │  ├─ main.ts
│     │  ├─ app.module.ts
│     │  ├─ config/
│     │  ├─ prisma/                # PrismaModule + PrismaService
│     │  ├─ health/
│     │  ├─ incidents/
│     │  ├─ investigations/
│     │  ├─ measurements/
│     │  ├─ replays/
│     │  ├─ sources/
│     │  ├─ ingestion/
│     │  ├─ llm/
│     │  ├─ export/
│     │  └─ common/
│     └─ test/
├─ packages/
│  ├─ contracts/                   # Zod-схемы и общие DTO-типы
│  └─ investigation-core/          # чистые функции, без Nest и БД
├─ data/
│  ├─ verified/                    # проверенные JSON fixtures мая/сентября
│  └─ fixtures/                    # ответы внешних API для тестов
├─ supabase/
│  └─ config.toml                  # только локальная конфигурация Supabase при необходимости
├─ docs/
│  ├─ spec.md
│  ├─ development-roadmap.md
│  ├─ api-contract.md
│  ├─ evidence-rules.md
│  └─ runbook-demo.md
├─ package.json
└─ package-lock.json
```

---

## 4. Технические решения, которые нужно принять один раз

### 4.1 Работа с PostgreSQL через Prisma

Для MVP использовать **Prisma ORM как единственный прикладной клиент PostgreSQL**:

- `Prisma Client` — CRUD, связи, транзакции и типы;
- `Prisma Migrate` — единственная история миграций;
- `prisma/seed.ts` — идемпотентная загрузка проверенных данных;
- `@prisma/adapter-pg` + `pg` — официальный PostgreSQL driver adapter Prisma;
- `$queryRaw`/`$executeRaw` — только для PostGIS и другого SQL, который Prisma Schema Language не выражает.

Не добавлять TypeORM, Drizzle, Kysely или отдельный Supabase query builder. Пакет `pg` устанавливается как низкоуровневый драйвер для Prisma adapter, но бизнес-модули NestJS не импортируют `Pool` и не выполняют SQL напрямую.

Prisma не заменяет investigation-core: ORM только читает и сохраняет факты, а причинный вывод остаётся в чистом TypeScript package.

### 4.2 Идентификаторы

В MVP использовать `text primary key`, потому что существующие seed-данные уже имеют читаемые идентификаторы вроде `inv-atyrau-2025-09`. Для автоматически созданных записей использовать `randomUUID()`.

### 4.3 География

- основной UI до подтверждения координат — линейная схема;
- `river_order` заполняется только после ручной проверки;
- частичные отношения хранить отдельными рёбрами `station_relations`;
- подтверждённые широту/долготу сначала хранить как nullable `Decimal` поля Prisma;
- PostGIS подключать отдельной custom migration только для реально нужных пространственных запросов;
- PostGIS-поля описывать как `Unsupported`, а читать через безопасный `$queryRaw` с явным преобразованием в GeoJSON/text;
- `location = null` является допустимым состоянием.

### 4.4 Даты

- сервер хранит точные моменты в `timestamptz`;
- неполная дата хранится отдельно как `observed_period = '2025-09'`;
- не превращать месяц в выдуманное `2025-09-01`;
- интерфейс форматирует время в `Asia/Atyrau` (`UTC+05:00`).

### 4.5 Числа

- в БД `numeric`, не `float`;
- Prisma читает `numeric` как `Prisma.Decimal`; на границе repository → core передавать decimal-строку или экземпляр явно установленного `decimal.js`;
- `investigation-core` не импортирует Prisma-типы и использует `decimal.js` для `0,193 - 0,114`, а не арифметику JavaScript `number`;
- сохранять `raw_value_text` рядом с нормализованным числом;
- единица измерения — отдельное поле;
- LLM не получает права менять число или единицу;
- любое преобразование единиц покрывается тестом и сохраняет исходное значение.

### 4.6 Режимы данных

```env
VITE_DATA_MODE=api      # обычный режим
VITE_DATA_MODE=seed     # аварийное офлайн-демо
```

В production-сборке хакатона по умолчанию должен быть `api`. Seed-режим оставляется как страховка, но на основном демо показывается ответ NestJS.

---

## 5. Переменные окружения

### `apps/api/.env.example`

```env
NODE_ENV=development
PORT=3000
API_PREFIX=api
WEB_ORIGIN=http://localhost:5173

# Prisma runtime. Для постоянного NestJS — Supavisor session pooler, порт 5432.
DATABASE_URL=postgresql://prisma.PROJECT_REF:PASSWORD@HOST:5432/postgres?sslmode=require

# Prisma CLI/migrations. Direct Supabase URL при доступном IPv6 либо
# Supavisor session pooler :5432. Никогда не transaction pooler :6543.
DIRECT_URL=postgresql://prisma:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require

# Только при serverless/auto-scaling deployment runtime можно перевести на :6543.
# Тогда добавить pgbouncer=true согласно документации Supabase/Prisma.

# Нужны только серверу для Storage. Не использовать во frontend.
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-me
SUPABASE_SOURCE_BUCKET=source-documents

# Включать после готовности детерминированного вертикального среза.
LLM_PROVIDER=disabled
GEMINI_API_KEY=
GEMINI_MODEL=
GROQ_API_KEY=
GROQ_MODEL=

# Защита ручных ingestion-endpoints.
INGESTION_TOKEN=replace-with-long-random-value

HTTP_TIMEOUT_MS=12000
HTTP_MAX_BYTES=15728640
GDELT_CACHE_TTL_SECONDS=1800
```

### `apps/web/.env.example`

```env
VITE_API_BASE_URL=/api
VITE_DATA_MODE=api
```

### Запреты

- не коммитить `.env`;
- не использовать `SUPABASE_SERVICE_ROLE_KEY` в `VITE_*`;
- не логировать URL соединения с БД;
- не передавать ключ LLM в браузер;
- не вставлять секреты в issue, скриншоты и презентацию.

---

## 6. Схема базы данных

Единственный источник модели — `apps/api/prisma/schema.prisma`. Единственная история изменения схемы — `apps/api/prisma/migrations`. Не применять таблицы вручную через Supabase Dashboard и не вести параллельные миграции в `supabase/migrations`.

### 6.1 Настройка Prisma 7

Установить одинаковую major/minor-версию `prisma` и `@prisma/client`, а также PostgreSQL adapter:

```text
prisma
@prisma/client
@prisma/adapter-pg
pg
```

Инициализировать Prisma внутри `apps/api` и генерировать client в исходники API:

```prisma
// apps/api/prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

Для актуальной Prisma 7 URL находится в `prisma.config.ts`, а не в `schema.prisma`:

```ts
// apps/api/prisma.config.ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // CLI использует стабильное соединение для migrate/introspection.
  // Runtime PrismaService отдельно использует DATABASE_URL.
  datasource: {
    url: env('DIRECT_URL'),
  },
});
```

Если команда намеренно фиксирует Prisma 6, `directUrl` настраивается по документации этой версии. Не смешивать примеры Prisma 6 и Prisma 7 в одном проекте.

### 6.2 Модели Prisma

Использовать enum для закрытых состояний и явные join-модели для связей, у которых есть собственные поля.

Базовый фрагмент:

```prisma
enum EvidenceLevel {
  L0
  L1
  L2
  L3
}

enum Region {
  ATYRAU
  MANGYSTAU
}

enum ExtractionMode {
  VERIFIED_SEED
  RULE
  LLM_VERIFIED
}

enum EvidenceKind {
  SUPPORTS
  CONTRADICTS
  UNKNOWN
}

model SourceDocument {
  id               String   @id
  sourceType       String
  publisher        String
  title            String
  originalUrl      String
  canonicalUrl     String
  publishedAt      DateTime?
  retrievedAt      DateTime @db.Timestamptz(6)
  sha256           String
  mediaType        String
  storagePath      String?
  httpStatus       Int?
  extractionStatus String   @default("pending")
  metadata         Json     @default("{}")

  pages            SourcePage[]
  measurements     Measurement[]
  signals          IncidentSignal[]

  @@unique([canonicalUrl, sha256])
  @@index([publishedAt(sort: Desc)])
  @@map("source_documents")
}

model SourcePage {
  id               String @id
  sourceDocumentId String
  pageNumber       Int
  extractedText    String
  textSha256       String

  sourceDocument SourceDocument @relation(fields: [sourceDocumentId], references: [id], onDelete: Cascade)

  @@unique([sourceDocumentId, pageNumber])
  @@map("source_pages")
}

model Station {
  id                       String   @id
  name                     String
  waterBody                String
  region                   Region
  riverOrder               Int?
  latitude                 Decimal? @db.Decimal(9, 6)
  longitude                Decimal? @db.Decimal(9, 6)
  locationSourceDocumentId String?
  verificationStatus       String   @default("unverified")

  measurements        Measurement[]
  relationsUpstream   StationRelation[] @relation("UpstreamStation")
  relationsDownstream StationRelation[] @relation("DownstreamStation")

  @@unique([waterBody, name])
  @@map("stations")
}

model StationRelation {
  id                     String   @id
  upstreamStationId      String
  downstreamStationId    String
  sourceDocumentId       String
  relationBasis          String
  verifiedBy             String
  verifiedAt             DateTime @db.Timestamptz(6)

  upstreamStation   Station @relation("UpstreamStation", fields: [upstreamStationId], references: [id])
  downstreamStation Station @relation("DownstreamStation", fields: [downstreamStationId], references: [id])

  @@unique([upstreamStationId, downstreamStationId, sourceDocumentId])
  @@map("station_relations")
}

model Measurement {
  id               String   @id
  stationId        String
  sourceDocumentId String
  sourcePage       Int?
  indicator        String
  matrix           String   @default("surface_water")
  value            Decimal  @db.Decimal(18, 9)
  unit             String
  rawValueText     String
  sampledAt        DateTime? @db.Timestamptz(6)
  sampledPeriod    String?
  sourceExcerpt    String
  extractionMode   ExtractionMode
  verifiedAt       DateTime? @db.Timestamptz(6)

  station        Station        @relation(fields: [stationId], references: [id])
  sourceDocument SourceDocument @relation(fields: [sourceDocumentId], references: [id])

  @@index([stationId, indicator, sampledAt])
  @@map("measurements")
}

model Incident {
  id        String   @id
  title     String
  region    Region
  indicator String
  status    String   @default("active")
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @db.Timestamptz(6)

  signalLinks    IncidentSignalLink[]
  investigations Investigation[]

  @@index([updatedAt(sort: Desc)])
  @@map("incidents")
}

model IncidentSignal {
  id                 String   @id
  title              String
  observedAt         DateTime? @db.Timestamptz(6)
  observedPeriod     String?
  reportedAt         DateTime @db.Timestamptz(6)
  locationText       String
  latitude           Decimal? @db.Decimal(9, 6)
  longitude          Decimal? @db.Decimal(9, 6)
  phenomenon         String
  excerpt            String
  sourceDocumentId   String
  extractionMode     ExtractionMode
  verificationStatus String
  dedupKey           String

  sourceDocument SourceDocument      @relation(fields: [sourceDocumentId], references: [id])
  incidentLinks  IncidentSignalLink[]

  @@unique([dedupKey, sourceDocumentId])
  @@map("incident_signals")
}

model IncidentSignalLink {
  incidentId String
  signalId   String

  incident Incident       @relation(fields: [incidentId], references: [id], onDelete: Cascade)
  signal   IncidentSignal @relation(fields: [signalId], references: [id], onDelete: Cascade)

  @@id([incidentId, signalId])
  @@map("incident_signal_links")
}

model Investigation {
  id                  String        @id
  incidentId          String
  evidenceLevel       EvidenceLevel
  conclusion          String
  corridorKind        String
  upstreamStationId   String?
  downstreamStationId String?
  rulesetVersion      String
  inputHash           String
  generatedAt         DateTime      @db.Timestamptz(6)
  isCurrent           Boolean       @default(true)

  incident   Incident                    @relation(fields: [incidentId], references: [id])
  statements EvidenceStatement[]
  unknowns   InvestigationUnknown[]

  @@index([incidentId, isCurrent])
  @@map("investigations")
}

model EvidenceStatement {
  id              String       @id
  investigationId String
  kind            EvidenceKind
  code            String
  text            String
  generatedBy     String
  sortOrder       Int

  investigation Investigation @relation(fields: [investigationId], references: [id], onDelete: Cascade)

  @@map("evidence_statements")
}

model InvestigationUnknown {
  id              String @id
  investigationId String
  code            String
  text            String
  sortOrder       Int

  investigation Investigation @relation(fields: [investigationId], references: [id], onDelete: Cascade)

  @@map("investigation_unknowns")
}
```

В рабочем `schema.prisma` также обязательно описать оставшиеся таблицы из SQL ниже: `CandidateObject`, join-модели измерений/объектов/источников доказательств, `ReplayScenario`, `ReplayStep`, `IngestionRun`, `SourceHealth`. Нельзя обращаться к ним параллельным клиентом в обход Prisma.

В примере выше `@@map` показывает правило для имён таблиц. В рабочем schema нужно либо:

1. последовательно добавить `@map("source_document_id")` и остальные snake_case mappings ко всем полям, чтобы migration совпала с SQL ниже; либо
2. отказаться от snake_case SQL-имён и везде оставить сгенерированные Prisma camelCase-колонки.

Рекомендуется вариант 1. Нельзя получить смешанную схему, где половина колонок snake_case, а половина camelCase. После первой migration выполнить `prisma db pull --print` и проверить отсутствие неожиданного schema drift.

### 6.3 Первая Prisma migration

Порядок:

```text
npx prisma format
npx prisma validate
npx prisma migrate dev --name initial_schema --create-only
```

Затем открыть созданный файл `apps/api/prisma/migrations/<timestamp>_initial_schema/migration.sql`, добавить недостающие CHECK constraints и только после review применить:

```text
npx prisma migrate dev
npx prisma generate
```

Ниже — целевая SQL-структура и constraints, с которыми нужно сверить сгенерированную migration. Этот SQL не применяется отдельным вторым migration-инструментом.

Запреты:

- не использовать `prisma db push` для общей/remote БД: он не создаёт нормальную историю migration;
- не запускать `prisma migrate reset` против Supabase project команды;
- не редактировать уже применённую migration; создавать следующую;
- не запускать migration через transaction pooler `:6543`;
- не коммитить сгенерированный Prisma Client, если команда выбрала генерацию на `postinstall/build`; правило должно быть одинаковым локально и в CI.

```sql
create extension if not exists pgcrypto;

create table source_documents (
  id text primary key,
  source_type text not null check (source_type in ('official_pdf','official_html','news','api_json','osm')),
  publisher text not null,
  title text not null,
  original_url text not null,
  canonical_url text not null,
  published_at timestamptz,
  retrieved_at timestamptz not null,
  sha256 text not null check (char_length(sha256) = 64),
  media_type text not null,
  storage_path text,
  http_status integer,
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending','parsed','verified','rejected','failed')),
  metadata jsonb not null default '{}'::jsonb,
  unique (canonical_url, sha256)
);

create table source_pages (
  id text primary key,
  source_document_id text not null references source_documents(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  extracted_text text not null,
  text_sha256 text not null,
  unique (source_document_id, page_number)
);

create table stations (
  id text primary key,
  name text not null,
  water_body text not null,
  region text not null check (region in ('atyrau','mangystau')),
  river_order integer,
  latitude numeric(9,6),
  longitude numeric(9,6),
  location_source_document_id text references source_documents(id),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','label_verified','coordinate_verified')),
  unique (water_body, name)
);

create table station_relations (
  id text primary key,
  upstream_station_id text not null references stations(id),
  downstream_station_id text not null references stations(id),
  source_document_id text not null references source_documents(id),
  relation_basis text not null,
  verified_by text not null,
  verified_at timestamptz not null,
  check (upstream_station_id <> downstream_station_id),
  unique (upstream_station_id, downstream_station_id, source_document_id)
);

create table measurements (
  id text primary key,
  station_id text not null references stations(id),
  source_document_id text not null references source_documents(id),
  source_page integer,
  indicator text not null,
  matrix text not null default 'surface_water',
  value numeric not null,
  unit text not null,
  raw_value_text text not null,
  sampled_at timestamptz,
  sampled_period text,
  source_excerpt text not null,
  extraction_mode text not null
    check (extraction_mode in ('verified_seed','rule','llm_verified')),
  verified_at timestamptz,
  check (source_page is null or source_page > 0),
  check (sampled_at is not null or sampled_period is not null)
);

create table incident_signals (
  id text primary key,
  title text not null,
  observed_at timestamptz,
  observed_period text,
  reported_at timestamptz not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  location_text text not null,
  phenomenon text not null,
  excerpt text not null,
  source_document_id text not null references source_documents(id),
  extraction_mode text not null
    check (extraction_mode in ('verified_seed','rule','llm_verified')),
  verification_status text not null
    check (verification_status in ('unverified','corroborated','official','conflicting')),
  dedup_key text not null,
  unique (dedup_key, source_document_id)
);

create table incidents (
  id text primary key,
  title text not null,
  region text not null check (region in ('atyrau','mangystau')),
  indicator text not null,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table incident_signal_links (
  incident_id text not null references incidents(id) on delete cascade,
  signal_id text not null references incident_signals(id) on delete cascade,
  primary key (incident_id, signal_id)
);

create table candidate_objects (
  id text primary key,
  name text not null,
  object_type text not null,
  activity text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  geometry_source_document_id text references source_documents(id),
  basis_text text not null,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','document_verified','coordinate_verified'))
);

create table investigations (
  id text primary key,
  incident_id text not null references incidents(id),
  evidence_level text not null check (evidence_level in ('L0','L1','L2','L3')),
  conclusion text not null,
  corridor_kind text not null check (corridor_kind in ('none','between_stations','open_upstream','open_downstream')),
  upstream_station_id text references stations(id),
  downstream_station_id text references stations(id),
  ruleset_version text not null,
  input_hash text not null,
  generated_at timestamptz not null,
  is_current boolean not null default true
);

create table investigation_measurements (
  investigation_id text not null references investigations(id) on delete cascade,
  measurement_id text not null references measurements(id),
  primary key (investigation_id, measurement_id)
);

create table investigation_candidate_objects (
  investigation_id text not null references investigations(id) on delete cascade,
  candidate_object_id text not null references candidate_objects(id),
  disposition text not null check (disposition in ('in_corridor','does_not_explain_event','unknown')),
  primary key (investigation_id, candidate_object_id)
);

create table evidence_statements (
  id text primary key,
  investigation_id text not null references investigations(id) on delete cascade,
  kind text not null check (kind in ('supports','contradicts','unknown')),
  code text not null,
  text text not null,
  generated_by text not null check (generated_by in ('deterministic_rule','human_verified')),
  sort_order integer not null
);

create table evidence_statement_measurements (
  evidence_statement_id text not null references evidence_statements(id) on delete cascade,
  measurement_id text not null references measurements(id),
  primary key (evidence_statement_id, measurement_id)
);

create table evidence_statement_sources (
  evidence_statement_id text not null references evidence_statements(id) on delete cascade,
  source_document_id text not null references source_documents(id),
  primary key (evidence_statement_id, source_document_id)
);

create table investigation_unknowns (
  id text primary key,
  investigation_id text not null references investigations(id) on delete cascade,
  code text not null,
  text text not null,
  sort_order integer not null
);

create table replay_scenarios (
  id text primary key,
  incident_id text not null references incidents(id),
  title text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table replay_steps (
  id text primary key,
  replay_scenario_id text not null references replay_scenarios(id) on delete cascade,
  offset_ms integer not null check (offset_ms >= 0),
  step_type text not null check (step_type in ('signal','corroboration','measurement','inference','conclusion')),
  payload jsonb not null,
  unique (replay_scenario_id, offset_ms, step_type)
);

create table ingestion_runs (
  id text primary key,
  adapter text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null check (status in ('running','success','partial','failed','rate_limited')),
  fetched_count integer not null default 0,
  accepted_count integer not null default 0,
  rejected_count integer not null default 0,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create table source_health (
  source_id text primary key,
  display_name text not null,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_http_status integer,
  cache_available boolean not null default false,
  status text not null default 'never_run'
    check (status in ('never_run','healthy','degraded','rate_limited','failed'))
);

create index measurements_station_indicator_idx
  on measurements (station_id, indicator, sampled_at);
create index incidents_updated_at_idx on incidents (updated_at desc);
create index investigations_current_idx on investigations (incident_id, is_current);
create index source_documents_published_at_idx on source_documents (published_at desc);
```

### 6.4 Prisma, RLS и доступ

Так как browser не читает таблицы напрямую, Prisma/NestJS является основной границей доступа:

1. Включить RLS на таблицах публичной схемы.
2. Не создавать политики `insert/update/delete` для `anon`.
3. Не выдавать frontend publishable key без необходимости.
4. Создать отдельного пользователя БД `prisma` по официальной инструкции Supabase; не использовать его пароль вне API/CI.
5. NestJS Prisma Client подключать через серверный `DATABASE_URL`.
6. Prisma CLI подключать через `DIRECT_URL`; этот URL имеет больше полномочий и не используется браузером.
7. `service_role` использовать только серверным Storage-клиентом.

Важно: пользователь-владелец таблиц или роль с `BYPASSRLS` может обходить RLS. Поэтому RLS здесь защищает Data API, но не заменяет авторизацию NestJS. Публичные write-endpoints в MVP отсутствуют, ingestion защищён отдельным token.

Для хакатона публичные чтения идут через NestJS. Если позже появится прямой PostgREST, RLS-политики проектируются отдельным этапом.

### 6.5 PostGIS через custom Prisma migration

Не добавлять PostGIS до подтверждения координат. Если координаты проверены и карта действительно входит в MVP:

1. Создать draft migration:

   ```text
   npx prisma migrate dev --name add_postgis --create-only
   ```

2. Добавить в `migration.sql`:

   ```sql
   create extension if not exists postgis with schema extensions;
   alter table stations
     add column location extensions.geography(point, 4326);
   create index stations_location_gix on stations using gist (location);
   ```

   Для `incident_signals` и `candidate_objects` повторять колонку/index только если эти слои реально используются на карте. В MVP достаточно числовых `latitude`/`longitude`.

3. В `schema.prisma` после `prisma db pull` поле будет представлено как `Unsupported(...)`.
4. Запись/чтение выполнять через tagged-template Prisma raw API, не через `Unsafe`:

   ```ts
   await prisma.$executeRaw`
     update stations
     set location = extensions.st_setsrid(
       extensions.st_makepoint(${longitude}, ${latitude}),
       4326
     )::extensions.geography
     where id = ${stationId}
   `;

   const rows = await prisma.$queryRaw<Array<{ id: string; geojson: string }>>`
     select id, extensions.st_asgeojson(location::extensions.geometry) as geojson
     from stations
     where location is not null
   `;
   ```

5. Raw result проверить Zod-схемой. Unsupported field нельзя возвращать из Prisma без явного cast к поддерживаемому типу.

Не использовать Prisma Studio как средство проверки PostGIS-полей: custom/Unsupported types могут не десериализоваться. Проверять их отдельным integration test и SQL cast в GeoJSON.

### 6.6 Storage

Создать закрытый бакет `source-documents`.

Путь объекта:

```text
{sourceType}/{yyyy}/{mm}/{sha256}.{extension}
```

Пример:

```text
official_pdf/2025/09/12ab...ef.pdf
```

Не использовать заголовок документа как имя файла: он может содержать небезопасные символы и меняться.

---

## 7. Общие контракты TypeScript

Создать `packages/contracts`. Использовать Zod как runtime-валидацию; TypeScript interface без runtime-проверки недостаточен для ответов LLM и внешних API.

### Основные схемы

```ts
export const EvidenceLevelSchema = z.enum(['L0', 'L1', 'L2', 'L3']);
export const RegionSchema = z.enum(['atyrau', 'mangystau']);
export const VerificationStatusSchema = z.enum([
  'unverified',
  'corroborated',
  'official',
  'conflicting',
]);

export const MeasurementSchema = z.object({
  id: z.string(),
  stationId: z.string(),
  indicator: z.string(),
  value: z.number(),
  unit: z.string(),
  matrix: z.string(),
  sampledAt: z.string().nullable(),
  sampledPeriod: z.string().nullable(),
  sourceDocumentId: z.string(),
  sourcePage: z.number().int().positive().nullable(),
  sourceExcerpt: z.string(),
});
```

### Контрактные правила

- один и тот же JSON shape используется в NestJS и React;
- Prisma enum остаётся внутренним типом БД; mapper переводит `Region.ATYRAU` в API-значение `atyrau` и никогда не отдаёт uppercase enum напрямую frontend;
- лабораторные `numeric` приходят из Prisma как `Prisma.Decimal`; mapper API явно преобразует их в JSON number только после проверки диапазона и сохраняет исходный `rawValueText`;
- неизвестная страница — `null`, а не `0`;
- неизвестные координаты — `null`, а не `[0, 0]`;
- `payload` каждого шага реплея — discriminated union по `type`;
- любой ответ API проверяется contract-тестом на frontend fixture.

Mapper из Prisma в API должен быть явным:

```ts
function decimalToApiNumber(value: Prisma.Decimal): number {
  const parsed = Number(value.toString());
  if (!Number.isFinite(parsed)) {
    throw new Error('DECIMAL_OUT_OF_API_RANGE');
  }
  return parsed;
}
```

Вычисления выполняются до этого преобразования. `number` нужен только для JSON/UI уже проверенных небольших лабораторных значений.

### Миграция существующих типов

Не переносить все типы сразу. Порядок:

1. Скопировать текущие формы из `apps/web/src/api/contracts.ts` в Zod-схемы.
2. Сгенерировать `z.infer<>` типы.
3. Перевести `apps/api` на общий package.
4. Перевести `apps/web/src/api/*`.
5. Только затем удалить дубли из `apps/web/src/types`.

Так фронтенд не будет сломан большим рефакторингом перед первым API-ответом.

---

## 8. NestJS: базовый каркас

### 8.1 Создание workspace

Создать Nest-приложение в `apps/api` без отдельного git-репозитория. Добавить workspace `api` в корневой `package.json` уже существующего npm-монорепозитория.

Нужные зависимости:

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
```

Для тестов:

```text
@nestjs/testing
jest
supertest
```

Для PDF после вертикального среза:

```text
pdfjs-dist
```

### 8.2 `main.ts`

```ts
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.setGlobalPrefix(process.env.API_PREFIX ?? 'api');
  app.enableCors({
    origin: [process.env.WEB_ORIGIN ?? 'http://localhost:5173'],
    methods: ['GET', 'POST'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Caspian Trace API')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  await app.listen(Number(process.env.PORT ?? 3000));
}
```

### 8.3 `PrismaModule` и `PrismaService`

```ts
// apps/api/src/prisma/prisma.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
    });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

```ts
// apps/api/src/prisma/prisma.module.ts
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Создавать ровно один `PrismaService` на процесс NestJS. Не создавать `new PrismaClient()` внутри controller, request или repository.

Обычные repository-методы используют Prisma Client:

```ts
return this.prisma.investigation.findUnique({
  where: { id },
  include: {
    incident: true,
    statements: { orderBy: { sortOrder: 'asc' } },
    unknowns: { orderBy: { sortOrder: 'asc' } },
  },
});
```

Транзакции:

```ts
return this.prisma.$transaction(async (tx) => {
  await tx.investigation.updateMany({
    where: { incidentId, isCurrent: true },
    data: { isCurrent: false },
  });
  return tx.investigation.create({ data: investigationData });
});
```

Для raw SQL использовать только tagged-template методы `$queryRaw`/`$executeRaw`. Методы с суффиксом `Unsafe` в MVP запрещены.

### 8.4 Модули

```text
AppModule
├─ ConfigModule
├─ PrismaModule
├─ HealthModule
├─ IncidentsModule
├─ InvestigationsModule
├─ ReplaysModule
├─ SourcesModule
├─ IngestionModule
├─ LlmModule
└─ ExportModule
```

### 8.5 Health endpoints

```http
GET /api/health/live
GET /api/health/ready
```

`live` отвечает без БД. `ready` вызывает `` prisma.$queryRaw`select 1` `` и `prisma.investigation.findUnique({ where: { id: 'inv-atyrau-2025-09' } })`, проверяя наличие обязательного сентябрьского кейса.

---

## 9. REST API, который должен реализовать backend

Сохраняем пути, под которые уже написан frontend.

### 9.1 Список событий

```http
GET /api/incidents?status=L2&region=atyrau&from=2025-01-01&to=2025-12-31&limit=50
```

Методы:

```ts
IncidentsController.list(query: ListIncidentsDto)
IncidentsService.list(filters: IncidentFilters)
IncidentsRepository.findMany(filters: IncidentFilters)
```

Ответ:

```json
[
  {
    "id": "inv-atyrau-2025-09",
    "title": "Жайык, Атырау: нефтепродукты, сентябрь 2025",
    "region": "atyrau",
    "evidenceLevel": "L2",
    "indicator": "нефтепродукты",
    "updatedAt": "2025-10-16T00:00:00+05:00"
  }
]
```

Примечание: текущий frontend использует id расследования как id элемента ленты. Для 60 часов это оставить. Разделение `incidentId`/`investigationId` провести после хакатона.

### 9.2 Детали события

```http
GET /api/incidents/:id
```

Методы:

```ts
IncidentsController.getOne(id: string)
IncidentsService.getDetail(investigationId: string)
IncidentsRepository.findDetail(investigationId: string)
```

Ответ должен строго соответствовать текущему `IncidentDetail`:

- `investigation`;
- `region`;
- `signals`;
- `measurements`;
- `stations`;
- `candidateObjects`;
- `sourceDocuments`;
- `corridorBounds`.

Если id не существует: `404` с `{ code: 'INVESTIGATION_NOT_FOUND' }`.

### 9.3 Запуск реплея

```http
POST /api/replays/:id/start
```

`id` — id расследования, как ожидает текущая заглушка.

Методы:

```ts
ReplaysController.start(investigationId: string)
ReplaysService.getImmutableScenario(investigationId: string)
ReplaysRepository.findByIncident(investigationId: string)
```

Эндпоинт не запускает серверный таймер. Он возвращает неизменяемый сценарий; время проигрывает browser.

### 9.4 Граф доказательств

```http
GET /api/investigations/:id/evidence
```

Методы:

```ts
InvestigationsController.getEvidence(id: string)
InvestigationsService.getEvidenceGraph(id: string)
EvidenceRepository.findGraph(id: string)
```

В ответе каждое утверждение содержит id измерений и документов-оснований. Утверждение без основания не должно попасть в `supports` или `contradicts`.

### 9.5 Состояние источников

```http
GET /api/live/status
```

Методы:

```ts
SourcesController.getLiveStatus()
SourceHealthService.getAll()
```

Сбой источника — нормальный ответ `200` со статусом `degraded/failed`, если API проекта работает. `500` нужен только при сбое самого сервиса.

### 9.6 Публичное досье

```http
GET /api/investigations/:id/export?format=html
GET /api/investigations/:id/export?format=json
```

Для MVP обязательны HTML и JSON. PDF — только если HTML уже стабилен.

### 9.7 Исходный документ из кэша

```http
GET /api/source-documents/:id/open?page=22
```

Поведение:

1. Если оригинальный URL доступен — можно вернуть `302` на него с `#page=22` только на frontend.
2. Если источник недоступен — вернуть короткоживущую подписанную ссылку Storage.
3. Если кэша нет — `404 SOURCE_SNAPSHOT_NOT_AVAILABLE`.

### 9.8 Ручной ingestion

```http
POST /api/admin/ingestion/kazhydromet
POST /api/admin/ingestion/gdelt
POST /api/admin/investigations/:id/recompute
```

Требовать заголовок:

```http
X-Ingestion-Token: <INGESTION_TOKEN>
```

Эти endpoints не вызываются публичным UI.

---

## 10. Проверенные данные демонстрационного кейса

### 10.1 Сентябрь 2025

Официальный документ:

<https://www.kazhydromet.kz/uploads/files_calendar/9344/file/68f0e81dcc3caatyrau-russ-byulleten-za-sentyabr-2025g.pdf>

Страница 22, нефтепродукты:

| Створ | Значение, мг/дм³ |
|---|---:|
| 1 км выше Атырау | 0,234 |
| 0,5 км выше КГП «Атырау су арнасы» | 0,058 |
| 0,5 км ниже КГП «Атырау су арнасы» | 0,054 |
| 1 км ниже города | 0,167 |
| выше осетрового завода | 0,066 |
| ниже осетрового завода | 0,063 |
| Дамба | 0,067 |

Проверяемый вывод:

- максимум `0,234` расположен выше города;
- в паре у «Атырау су арнасы» значение не выросло: `0,054 - 0,058 = -0,004`;
- этот локальный интервал не объясняет максимум выше него;
- это не оправдывает объект вообще и не устанавливает другой источник;
- коридор остаётся открытым вверх от створа «1 км выше Атырау»;
- уровень — L2, пока нет лабораторной пары, ограничивающей верхнюю границу.

### 10.2 Май 2025

Официальный документ:

<https://www.kazhydromet.kz/uploads/files_calendar/8606/file/6850158c0099catyrau-russ-byulleten-za-may-2025g.pdf>

| Створ | Значение, мг/дм³ |
|---|---:|
| выше того же сброса | 0,114 |
| ниже того же сброса | 0,193 |

Расчёт:

```text
delta = 0,193 - 0,114 = +0,079 мг/дм³
```

Проверяемый вывод:

- в парном интервале зарегистрирован локальный рост;
- интервал требует проверки как зона дополнительного поступления;
- одно сравнение не доказывает конкретного виновника или статистическую значимость;
- уровень — L3 для лабораторно поддержанного коридора, не для установления виновника.

### 10.3 Правило импорта seed

В `data/verified` сохранить два JSON-файла и manifest:

```text
data/verified/atyrau-2025-09.json
data/verified/atyrau-2025-05.json
data/verified/manifest.json
```

Каждая запись должна иметь:

- URL;
- SHA-256 скачанного файла;
- номер страницы или `null`;
- дословный фрагмент;
- кто проверил;
- когда проверил;
- вторую проверку другим участником команды.

Это не «выдуманная ручная форма»: это воспроизводимая транскрипция официального источника. Значения загружаются seed-скриптом, а не вводятся пользователем на демо.

`apps/api/prisma/seed.ts` читает только manifest из `data/verified`, валидирует его Zod-схемой и выполняет идемпотентные `upsert` внутри `prisma.$transaction`. Нельзя использовать `createMany({ skipDuplicates: true })` как единственную проверку: обновлённый verified source/hash должен либо осознанно обновить запись, либо остановить seed с конфликтом.

```ts
await prisma.$transaction(async (tx) => {
  await tx.sourceDocument.upsert({
    where: {
      canonicalUrl_sha256: {
        canonicalUrl: document.canonicalUrl,
        sha256: document.sha256,
      },
    },
    create: mapSourceDocument(document),
    update: mapSourceDocument(document),
  });

  await tx.measurement.upsert({
    where: { id: measurement.id },
    create: mapMeasurement(measurement),
    update: mapMeasurement(measurement),
  });
});
```

---

## 11. Детерминированный investigation-core

Создать `packages/investigation-core` без NestJS, БД, HTTP и LLM. Вход и выход — обычные объекты. Это главная техническая часть продукта.

### 11.1 Вход

```ts
export type InvestigationInput = {
  incident: Incident;
  signals: IncidentSignal[];
  stations: Station[];
  stationRelations: StationRelation[];
  measurements: Measurement[];
  candidateObjects: CandidateObject[];
  sourceDocuments: SourceDocument[];
};
```

### 11.2 Выход

```ts
export type InvestigationResult = {
  evidenceLevel: EvidenceLevel;
  corridorBounds: CorridorBounds | null;
  supportedFacts: EvidenceStatement[];
  contradictedHypotheses: EvidenceStatement[];
  objectDispositions: ObjectDisposition[];
  unknowns: InvestigationUnknown[];
  conclusion: string;
  inputHash: string;
  rulesetVersion: string;
};
```

### 11.3 Обязательные функции

```ts
normalizeIndicatorName(value: string): string
areMeasurementsComparable(a: Measurement, b: Measurement): ComparisonResult
computePairedDelta(upstream: Measurement, downstream: Measurement): Decimal
buildStationGraph(relations: StationRelation[]): DirectedAcyclicGraph
topologicalStationOrder(graph: DirectedAcyclicGraph): string[] | null
findEventMaximum(measurements: Measurement[]): Measurement | null
evaluatePairedIntervals(input: InvestigationInput): IntervalEvaluation[]
excludeDownstreamExplanations(input: InvestigationInput): EvidenceStatement[]
deriveCorridor(input: InvestigationInput, facts: RuleFact[]): CorridorBounds | null
deriveEvidenceLevel(input: InvestigationInput, corridor: CorridorBounds | null): EvidenceLevel
buildUnknowns(input: InvestigationInput): InvestigationUnknown[]
buildConclusion(result: Omit<InvestigationResult, 'conclusion'>): string
calculateInputHash(input: InvestigationInput): string
runInvestigation(input: InvestigationInput): InvestigationResult
```

### 11.4 Сравнимость измерений

`areMeasurementsComparable` возвращает `comparable: true` только если:

- одинаковый нормализованный показатель;
- одинаковая матрица;
- одинаковая единица либо существует явно протестированное преобразование;
- даты/периоды совместимы;
- точки образуют подтверждённую пару выше/ниже;
- значения происходят из официальных документов;
- отсутствующее поле не заменено предположением.

```ts
type ComparisonResult =
  | { comparable: true }
  | {
      comparable: false;
      reasons: Array<
        | 'INDICATOR_MISMATCH'
        | 'MATRIX_MISMATCH'
        | 'UNIT_MISMATCH'
        | 'TIME_MISMATCH'
        | 'RELATION_UNVERIFIED'
        | 'SOURCE_NOT_OFFICIAL'
      >;
    };
```

### 11.5 Правила MVP

#### R1 — максимум выше объекта

Если максимум официальных измерений расположен выше рассматриваемого объекта по подтверждённому графу, объект ниже не может объяснить этот максимум.

Результат: `contradicts`, код `MAXIMUM_UPSTREAM_OF_OBJECT`.

#### R2 — парный интервал без роста

Если сравнимая точка ниже выпуска не выше точки над выпуском, пара не подтверждает локальное поступление на этом интервале.

Результат: `contradicts`, код `NO_LOCAL_INCREASE_IN_PAIR`.

Формулировка запрещает слово «оправдан».

#### R3 — парный интервал с ростом

Если сравнимая точка ниже выше точки над выпуском, зафиксировать локальный рост и коридор между точками.

Результат: `supports`, код `LOCAL_INCREASE_IN_PAIR`.

Это не устанавливает причинность и не привязывает рост к ближайшему объекту.

#### R4 — нет верхней границы

Если максимум находится на самой верхней подтверждённой точке, коридор имеет тип `open_upstream`.

#### R5 — неполная география

Если граф точек частичный или циклический, не строить полный порядок. Добавить unknown `STATION_ORDER_UNVERIFIED`.

#### R6 — уровень доказательности

- L0: только сигнал или данных недостаточно;
- L1: официальный источник либо два независимых сообщения;
- L2: подтверждённая физическая/географическая связь исключила часть версий;
- L3: сопоставимая лабораторная пара ограничила коридор;
- наличие красивого объяснения или результата LLM уровень не повышает.

### 11.6 Псевдокод главного метода

```ts
export function runInvestigation(input: InvestigationInput): InvestigationResult {
  const facts = validateAndNormalize(input);
  const graph = buildStationGraph(facts.stationRelations);
  const intervalEvaluations = evaluatePairedIntervals({ ...input, ...facts });
  const contradicted = excludeDownstreamExplanations({ ...input, ...facts });
  const supported = buildSupportedFacts(facts, intervalEvaluations);
  const corridor = deriveCorridor(input, [...supported, ...contradicted]);
  const unknowns = buildUnknowns(input);
  const evidenceLevel = deriveEvidenceLevel(input, corridor);

  const partial = {
    evidenceLevel,
    corridorBounds: corridor,
    supportedFacts: supported,
    contradictedHypotheses: contradicted,
    objectDispositions: classifyObjects(input, corridor, contradicted),
    unknowns,
    inputHash: calculateInputHash(input),
    rulesetVersion: '1.0.0',
  };

  return { ...partial, conclusion: buildConclusion(partial) };
}
```

### 11.7 Важное ограничение

`buildConclusion` в MVP должен использовать шаблоны по кодам правил. LLM-формулировка может быть отдельным необязательным полем, но основной `conclusion` обязан воспроизводиться без сети и ключа.

---

## 12. Сохранение результата расследования

Метод:

```ts
InvestigationsService.recompute(investigationId: string): Promise<Investigation>
```

Алгоритм:

1. Загрузить все входные факты одним согласованным snapshot/transaction.
2. Построить `InvestigationInput`.
3. Запустить `runInvestigation`.
4. Посчитать `inputHash` из канонического JSON.
5. Если текущий результат имеет тот же `inputHash` и `rulesetVersion`, ничего не менять.
6. Иначе внутри `prisma.$transaction` пометить старый результат `isCurrent = false`.
7. Вставить новый `investigations`.
8. Вставить statements, unknowns и link-таблицы.
9. Вернуть новый результат.

Для создания statements и link-записей использовать nested writes/`createMany` внутри той же Prisma transaction. Не выполнять цепочку несвязанных `create()` вне транзакции: частично сохранённое расследование недопустимо.

Нельзя обновлять старое расследование «на месте»: для досье нужна воспроизводимость, какой набор фактов дал какой вывод.

---

## 13. Загрузка и кэширование источников

Автоматизация начинается только после готового вертикального пути seed → core → API → UI.

### 13.1 Общий интерфейс адаптера

```ts
export interface SourceAdapter<TCandidate> {
  readonly id: string;
  discover(input: DiscoveryWindow): Promise<TCandidate[]>;
  fetch(candidate: TCandidate): Promise<RawSnapshot>;
  parse(snapshot: RawSnapshot): Promise<ParsedRecord[]>;
}
```

### 13.2 Безопасный HTTP-клиент

Создать `SafeFetchService`:

```ts
fetchBuffer(url: URL, policy: FetchPolicy): Promise<FetchBufferResult>
fetchJson<T>(url: URL, schema: ZodSchema<T>, policy: FetchPolicy): Promise<T>
fetchText(url: URL, policy: FetchPolicy): Promise<FetchTextResult>
```

Обязательные защиты:

- allowlist доменов;
- только `https`;
- запрет redirect на домен вне allowlist;
- таймаут через `AbortController`;
- ограничение размера ответа;
- проверка `content-type`;
- не принимать localhost, private IP и `file:` URL;
- максимум 3 redirect;
- retry только для `408`, `429`, `5xx`;
- exponential backoff с jitter;
- `429` фиксировать как `rate_limited`, не считать пустым результатом.

### 13.3 Сохранение snapshot

```ts
SourcesService.persistSnapshot(input: PersistSnapshotInput): Promise<SourceDocument>
```

Шаги:

1. Канонизировать URL.
2. Скачать байты.
3. Посчитать SHA-256.
4. Проверить `(canonical_url, sha256)` на дубликат.
5. Загрузить объект в Storage.
6. Записать `source_documents`.
7. Только после успешной записи запускать parser.

Если парсинг падает, raw snapshot остаётся доступным для повторной обработки.

---

## 14. Адаптер Казгидромета

### Источники

- Ежемесячные бюллетени: <https://www.kazhydromet.kz/ru/ecology/ezhemesyachnyy-informacionnyy-byulleten-o-sostoyanii-okruzhayuschey-sredy>
- Мониторинг Каспийского моря: <https://kazhydromet.kz/ru/kaspiyskoe-more/ekologicheskiy-monitoring-kaspiyskogo-morya>
- Высокое и экстремально высокое загрязнение: <https://www.kazhydromet.kz/ru/ecology/svedeniya-o-sluchayah-vysokogo-zagryazneniya-i-ekstremalno-vysokogo-zagryazneniya-okruzhayuschey-sredy>

### 14.1 Discovery

Метод:

```ts
KazhydrometAdapter.discover({ from, to, regions }): Promise<PdfCandidate[]>
```

Из HTML извлекать только ссылки:

- с домена `kazhydromet.kz` или `www.kazhydromet.kz`;
- оканчивающиеся PDF либо имеющие `application/pdf`;
- содержащие выбранный регион и период в surrounding text;
- после discovery каждую ссылку сохранить с текстом якоря и URL страницы-списка.

Не полагаться на CSS-класс сайта как единственный признак. Добавить fixture HTML и тест discovery.

### 14.2 Получение PDF

```ts
KazhydrometAdapter.fetch(candidate): Promise<RawSnapshot>
```

- таймаут 12 секунд;
- максимум 15 МБ;
- начало файла должно иметь `%PDF`;
- hash до загрузки в Storage;
- при HTML вместо PDF пометить `failed`, не передавать parser.

### 14.3 Извлечение текста по страницам

```ts
PdfTextService.extractPages(buffer: Buffer): Promise<Array<{
  pageNumber: number;
  text: string;
}>>
```

С `pdfjs-dist` использовать динамический import legacy build, чтобы избежать конфликта ESM/CommonJS. Для каждой страницы хранить текст и hash текста.

### 14.4 Извлечение измерений

Порядок:

1. Найти страницы по ключам `нефтепродукт`, `Жайык`, `Атырау`.
2. Rule parser извлекает кандидатов строк.
3. LLM может предложить структуру таблицы только в режиме `LLM_PROVIDER != disabled`.
4. `MeasurementCandidateValidator` проверяет каждое число по исходному page text.
5. Неподтверждённая строка попадает в rejected candidates, не в `measurements`.
6. Для демо значения дополнительно подтверждает второй участник команды.

Основные методы:

```ts
findRelevantPages(pages: PdfPage[]): PdfPage[]
extractMeasurementCandidates(page: PdfPage): MeasurementCandidate[]
validateCandidateAgainstText(candidate: MeasurementCandidate, page: PdfPage): ValidationResult
normalizeMeasurement(candidate: MeasurementCandidate): MeasurementInsert
```

### 14.5 Stop condition

Если автоматический parser за 4 часа не воспроизводит сентябрьскую таблицу без ошибок, оставить verified seed главным путём и использовать parser только как демонстрацию импорта документа. Не тратить оставшееся время на универсальный PDF parser.

---

## 15. Публичные сигналы: GDELT и прямые источники

### 15.1 GDELT DOC 2.0

Endpoint:

```text
https://api.gdeltproject.org/api/v2/doc/doc
```

Пример запроса:

```http
GET https://api.gdeltproject.org/api/v2/doc/doc
  ?query=(Атырау OR Atyrau OR Актау OR Aktau) (нефть OR нефтепродукты OR загрязнение OR oil OR pollution)
  &mode=artlist
  &format=json
  &maxrecords=50
  &sort=datedesc
  &startdatetime=20250901000000
  &enddatetime=20250930235959
```

URL должен собираться через `URL`/`URLSearchParams`, а не конкатенацию.

Методы:

```ts
GdeltAdapter.buildQuery(window: DiscoveryWindow): URL
GdeltAdapter.discover(window): Promise<ArticleCandidate[]>
GdeltAdapter.mapArticle(raw: GdeltArticle): SourceDocumentCandidate
```

Обработка `429`:

- не повторять запрос чаще настроенного TTL;
- 1 retry после `Retry-After` или backoff;
- использовать последний успешный cached response;
- `source_health.status = 'rate_limited'`;
- UI показывает «источник временно ограничил запросы; используется кэш».

### 15.2 Прямые страницы

Fallback allowlist:

- `inform.kz`;
- `azh.kz`;
- `zakon.kz`;
- `gov.kz`;
- `kazhydromet.kz`.

Демонстрационные статьи:

- <https://www.zakon.kz/obshestvo/6490267-v-atyrau-zelenaya-voda-v-reke-okazalas-sledom-neftyanogo-zagryazneniya.html>
- <https://www.inform.kz/ru/v-stochnih-vodah-atirau-obnaruzheni-ostatki-nefteproduktov-adef40>
- <https://azh.kz/ru/news/view/120575>

Для MVP страницы можно заранее сохранить как snapshot. Не строить демо так, чтобы оно зависело от успешного live-scraping в эти три минуты.

### 15.3 Дедупликация

Сначала детерминированно:

```ts
canonicalizeUrl(url)
normalizeTitle(title)
buildDedupKey({ normalizedTitle, publisher, publishedDate })
```

Затем LLM может пометить две публикации как описывающие одно событие, но не удаляет их. Хранить связь `possible_duplicate_of`; окончательная группировка демонстрационного кейса — verified seed.

---

## 16. Open-Meteo

Эти данные не нужны для основного сентябрьского вывода и не должны задерживать вертикальный срез.

### 16.1 Flood API

Документация: <https://open-meteo.com/en/docs/flood-api>

Endpoint:

```text
https://flood-api.open-meteo.com/v1/flood
```

Пример:

```http
GET https://flood-api.open-meteo.com/v1/flood
  ?latitude=<VERIFIED_ATYRAU_LAT>
  &longitude=<VERIFIED_ATYRAU_LON>
  &daily=river_discharge
  &start_date=2025-08-25
  &end_date=2025-09-15
  &timezone=Asia/Atyrau
```

Координаты в документ не зашивать до проверки. Сервис имеет сетку около 5 км и может выбрать не ту речную ячейку; результат используется только как слабая проверка временной совместимости.

Методы:

```ts
OpenMeteoFloodAdapter.fetchDischarge(input): Promise<DischargeSeries>
validateDischargeResponse(raw): DischargeSeries
assessTemporalCompatibility(series, eventWindow): WeakEvidence
```

`WeakEvidence` не повышает уровень до L2/L3.

### 16.2 Marine API

Документация: <https://open-meteo.com/en/docs/marine-weather-api>

Endpoint:

```text
https://marine-api.open-meteo.com/v1/marine
```

Пример:

```http
GET https://marine-api.open-meteo.com/v1/marine
  ?latitude=<VERIFIED_AKTAU_LAT>
  &longitude=<VERIFIED_AKTAU_LON>
  &hourly=wave_height,wave_direction,ocean_current_velocity,ocean_current_direction
  &start_date=2025-09-01
  &end_date=2025-09-03
  &timezone=Asia/Aqtau
```

Для Каспия поля течений могут вернуться `null`. Это ожидаемый результат. Правило:

```ts
if (currentSeries.every(value => value == null)) {
  return { usableForLocalization: false, reason: 'CURRENT_FIELD_UNAVAILABLE' };
}
```

Высота и направление волн сами по себе не доказывают перенос загрязнения.

---

## 17. Национальная база и OpenStreetMap

### Национальная база экологических материалов

Источник: <https://hearings.ndbecology.gov.kz/>

MVP:

- вручную выбрать только документы, относящиеся к прибрежным объектам и Жайыку;
- сохранить URL, PDF, страницу и основание;
- объект получает статус `document_verified` только после проверки документа;
- наличие объекта внутри коридора означает «объект для проверки», не «источник».

Не строить универсальный crawler этого портала, пока основной кейс не готов.

### OpenStreetMap/Overpass

Использование — только дополнительная геометрия.

Пример POST к `https://overpass-api.de/api/interpreter` с заранее сохранённым query fixture. На демо читать результат из кэша.

Правила:

- отсутствие объекта в ответе никогда не создаёт `contradicts`;
- координата OSM получает provenance `osm`;
- OSM-координата не заменяет координату из официального документа молча;
- при конфликте хранить обе версии и показывать unknown.

---

## 18. LLM-слой

### 18.1 Когда подключать

После того как `runInvestigation` на seed-данных возвращает ожидаемый сентябрьский и майский результат и API показывает его frontend.

### 18.2 Интерфейс

```ts
export interface LlmProvider {
  extractIncidentSignal(input: ExtractSignalInput): Promise<ExtractedSignal>;
  extractMeasurementCandidates(input: ExtractTableInput): Promise<MeasurementCandidate[]>;
  classifyPossibleDuplicate(input: DuplicateInput): Promise<DuplicateAssessment>;
  explainFacts(input: ExplainFactsInput): Promise<GeneratedExplanation>;
}
```

Реализации:

```text
DisabledLlmProvider
GeminiLlmProvider
GroqLlmProvider
```

Provider выбирается конфигурацией, доменная логика не импортирует SDK конкретного поставщика.

### 18.3 Извлечение сигнала

Вход:

- заголовок;
- очищенный текст статьи;
- publisher;
- publication time;
- URL.

Structured output:

```ts
const ExtractedSignalSchema = z.object({
  observedAt: z.string().datetime().nullable(),
  observedPeriod: z.string().nullable(),
  locationText: z.string(),
  phenomenon: z.enum(['oil_film', 'color_change', 'odor', 'dead_biota', 'other']),
  excerpt: z.string().max(500),
  evidenceQuotes: z.array(z.string().max(300)).min(1).max(3),
  confidence: z.number().min(0).max(1),
});
```

После ответа:

1. Zod parse.
2. Каждая `evidenceQuote` должна дословно находиться в очищенном тексте.
3. `excerpt` также должен быть подстрокой либо собираться из подтверждённых quotes.
4. Дата не может быть точнее исходного текста.
5. При нарушении запись уходит в review/rejected.

### 18.4 Извлечение таблицы

LLM получает текст одной страницы, а не весь PDF. Для каждого кандидата возвращает `rawValueText`, `stationText`, `indicatorText`, `unitText`, `sourceExcerpt`.

Сервер:

- сам преобразует `rawValueText` в decimal;
- проверяет наличие raw строки на странице;
- запрещает подмену запятой/точки без теста;
- запрещает запись, если единица не найдена на странице или в заголовке таблицы.

### 18.5 Объяснение

LLM получает только уже вычисленные facts:

```ts
type ExplainFactsInput = {
  allowedFacts: Array<{ code: string; text: string; sourceIds: string[] }>;
  unknowns: Array<{ code: string; text: string }>;
  forbiddenTerms: string[];
};
```

Выход не заменяет шаблонный `conclusion`. Если explanation содержит число, которого нет в `allowedFacts`, оно отклоняется.

### 18.6 Запрещённые действия LLM

- вычислять delta;
- выбирать L0–L3;
- решать, кто виноват;
- создавать координаты;
- создавать номер страницы;
- исправлять лабораторное значение;
- превращать отсутствие данных в отрицательный факт;
- автоматически публиковать досье.

---

## 19. Интеграция существующего frontend с API

### 19.1 Исправить API client

Добавить:

- `Accept: application/json`;
- `AbortSignal`;
- разбор серверной ошибки `{ code, message, requestId }`;
- timeout;
- Zod parse ответа;
- `credentials` только если позже появится auth.

```ts
export async function apiGet<T>(
  path: string,
  schema: z.ZodSchema<T>,
  params?: QueryParams,
  signal?: AbortSignal,
): Promise<T>
```

### 19.2 Переключение stub/API

В каждом существующем модуле:

```ts
export async function fetchIncidents(params?: IncidentListParams) {
  if (import.meta.env.VITE_DATA_MODE === 'seed') {
    warnStubOnce('GET /api/incidents');
    return incidentSummaries;
  }
  return apiGet('/incidents', IncidentSummaryArraySchema, params);
}
```

После успешной интеграции обновить `docs/stubs.md`: статус не удалять бесследно, а пометить `API готов, seed fallback сохранён`.

### 19.3 Vite proxy для разработки

В `apps/web/vite.config.ts`:

```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
}
```

### 19.4 Query keys

```ts
export const queryKeys = {
  incidents: (filters: IncidentListParams = {}) => ['incidents', filters] as const,
  incident: (id: string) => ['incidents', id] as const,
  evidence: (id: string) => ['investigations', id, 'evidence'] as const,
  replay: (id: string) => ['replays', id] as const,
  liveStatus: () => ['live-status'] as const,
};
```

`staleTime: Infinity` оставить для расследований и реплея на демо. Для live status использовать `staleTime` 60 секунд.

### 19.5 Состояния интерфейса

Для каждого блока проверить:

- loading;
- server error;
- empty;
- partial data;
- cached/degraded source;
- sufficient evidence;
- unknown coordinates.

«Недостаточно данных» не отображать как красную ошибку.

---

## 20. Реплей

### 20.1 Server contract

Сценарий сентября неизменяемый и хранится в БД. Шаги:

| offset | type | что появляется |
|---:|---|---|
| 0 мс | `signal` | сообщение о зелёной воде, L0 |
| 5 000 мс | `corroboration` | официальное подтверждение отбора проб, L1 |
| 11 000 мс | `measurement` | четыре городских измерения |
| 18 000 мс | `inference` | исключён локальный городской интервал, L2 |
| 25 000 мс | `conclusion` | коридор открыт вверх и итог |

Точные offsets брать из текущих constants/seed, если они уже отличаются; API и UI должны иметь один контракт.

### 20.2 Zustand store

Файл: `apps/web/src/stores/replay-store.ts`.

```ts
type ReplayState = {
  scenario: ReplayScenario | null;
  status: 'idle' | 'playing' | 'paused' | 'finished';
  elapsedMs: number;
  activeStepIndex: number;
  startedAtPerformanceMs: number | null;
  load(scenario: ReplayScenario): void;
  play(): void;
  pause(): void;
  seek(elapsedMs: number): void;
  reset(): void;
  tick(nowPerformanceMs: number): void;
};
```

### 20.3 Playback hook

`useReplayPlayback` использует `requestAnimationFrame` или короткий interval и `performance.now()`, а не цепочку `setTimeout`. Иначе pause/seek рассинхронизируются.

### 20.4 Видимые данные на шаге

Создать selector:

```ts
selectReplayProjection(scenario, elapsedMs): ReplayProjection
```

Он возвращает видимые signal ids, measurement ids, evidence level, active statement и conclusion. Все три колонки получают одну projection. Повторного запроса к API при каждом шаге нет.

### 20.5 Управление

- Space: play/pause;
- Left/Right: предыдущий/следующий шаг;
- drag/click шкалы: seek;
- кнопка reset;
- `aria-label` на элементах;
- `prefers-reduced-motion` отключает плавную анимацию, но не шаги.

### 20.6 Приёмка

Пауза на 12-й секунде и продолжение не должны пропускать шаг. Seek назад должен убрать факты, появившиеся позже. Переключение события останавливает текущий replay.

---

## 21. Публичное досье

### 21.1 Содержание

1. Заголовок и дата генерации.
2. Юридически осторожный disclaimer.
3. Итоговая формулировка.
4. Уровень L0–L3 с расшифровкой.
5. Хронология сигналов.
6. Таблица измерений.
7. Подтверждённые факты.
8. Версии, которые не объясняют событие.
9. Неизвестные данные.
10. Объекты для проверки.
11. Все источники: URL, publisher, дата, SHA-256, страница.
12. `rulesetVersion` и `inputHash`.

### 21.2 Реализация

```ts
ExportService.buildDossierModel(id: string): Promise<DossierModel>
ExportService.renderHtml(model: DossierModel): string
ExportService.renderJson(model: DossierModel): string
```

HTML рендерить серверным шаблоном без пользовательского HTML. Экранировать все строки. Добавить print CSS.

### 21.3 Frontend route

```text
/dossier/:id
```

Кнопки:

- «Открыть досье»;
- «Печать / сохранить PDF» через `window.print()`;
- «Скачать JSON».

Для MVP системная печать браузера достаточна. Генерацию PDF на сервере не подключать, если она угрожает сроку.

---

## 22. Безопасность и корректность

### Обязательно

- allowlist внешних доменов;
- SSRF-защита;
- ограничение размера PDF/HTML;
- таймауты;
- Prisma Client для обычных запросов; для PostGIS только tagged-template `$queryRaw`/`$executeRaw`, без `Unsafe` и конкатенации SQL;
- `ValidationPipe`;
- rate limit публичного API;
- admin token для ingestion;
- закрытый Storage bucket;
- CORS только на нужный origin;
- sanitization экспортируемого HTML;
- `noopener,noreferrer` для внешних ссылок;
- без секретов в логах;
- исходные документы immutable по SHA-256;
- LLM output всегда проходит Zod и provenance validation.

### Формулировки

Создать automated test по запрещённым словам в conclusion/evidence templates:

```text
виновен
нарушитель
источник установлен
доказано, что предприятие
```

Тест должен учитывать регистр и простые словоформы.

---

## 23. Тестирование

### 23.1 Unit: investigation-core

Обязательные тесты:

1. Сентябрь: максимум `0.234` выше города.
2. Сентябрь: delta у «Атырау су арнасы» равна `-0.004`.
3. Сентябрь: объект ниже не объясняет верхний максимум.
4. Сентябрь: уровень L2, не L3.
5. Май: delta равна `+0.079`.
6. Май: corridor между paired stations.
7. Май: L3 не означает виновника.
8. Разные единицы без converter не сравниваются.
9. Разные периоды не сравниваются.
10. Цикл в station graph запрещает порядок.
11. `location=null` не ломает core.
12. Отсутствие объекта OSM ничего не исключает.
13. Волны не повышают evidence level.
14. Конфликтующие сообщения сохраняются отдельно.
15. Повторный запуск с тем же input даёт тот же hash и результат.

### 23.2 Unit: ingestion

- PDF content-type mismatch;
- HTML вместо PDF;
- файл больше лимита;
- redirect вне allowlist;
- GDELT 429 и cache fallback;
- некорректный JSON Open-Meteo;
- `null` currents для Каспия;
- LLM quote отсутствует в source text;
- LLM изменил число;
- дубликат по URL + SHA.

### 23.3 Integration: NestJS + PostgreSQL

- `prisma migrate deploy` применяется к чистой БД без schema drift;
- `prisma db seed` выполняется дважды без дублей;
- `GET /api/incidents` возвращает 3 кейса;
- detail сентября соответствует contract schema;
- recompute создаёт новую версию только при изменении input hash;
- graph содержит ссылки на measurements и sources;
- admin endpoint без token возвращает `401/403`;
- неизвестный id возвращает `404`.

### 23.4 Contract tests frontend

Каждый реальный API fixture прогнать через Zod schema из `packages/contracts`. Запретить `as T` без runtime parse на границе сети.

### 23.5 E2E

Критический сценарий Playwright:

1. Открыть `/`.
2. Выбрать сентябрь.
3. Запустить реплей.
4. Дождаться measurement step.
5. Проверить `0,234`, `0,058`, `0,054`, `0,167`.
6. Дождаться вывода L2.
7. Открыть ссылку числа и проверить `#page=22`.
8. Переключить май и проверить `+0,079`.
9. Открыть Актау и проверить «недостаточно данных».
10. Открыть dossier и проверить sources/hash.

### 23.6 Проверка воспроизводимости

Сохранить golden JSON результатов мая и сентября. CI сравнивает результат core с golden. Любое изменение требует осознанного обновления fixture и review второго участника.

---

## 24. Логи и диагностика

Каждый request получает `requestId`. Логи JSON:

```json
{
  "level": "info",
  "requestId": "...",
  "module": "KazhydrometAdapter",
  "event": "snapshot_saved",
  "sourceDocumentId": "...",
  "sha256Prefix": "12ab34cd",
  "durationMs": 431
}
```

Не логировать:

- полный API key;
- DATABASE_URL;
- service role key;
- полный текст статьи без необходимости;
- бинарное содержимое PDF.

Для хакатона достаточно console JSON и `source_health`/`ingestion_runs`. Отдельную observability-платформу не подключать.

---

## 25. CI

Создать `.github/workflows/ci.yml`.

Шаги:

1. checkout;
2. setup Node с pinned version и npm cache;
3. `npm ci`;
4. `npm run prisma:validate`;
5. `npm run prisma:generate`;
6. `npm run typecheck --workspaces --if-present`;
7. `npm run lint --workspaces --if-present`;
8. `npm run test --workspaces --if-present`;
9. `npm run build --workspaces --if-present`;
10. в integration job с тестовой БД — `npm run prisma:migrate:deploy` перед API-тестами.

Не добавлять deploy в тот же workflow до стабильного build. PR не считается готовым при красном CI.

### Корневые scripts

```json
{
  "scripts": {
    "dev:web": "npm run dev -w web",
    "dev:api": "npm run start:dev -w api",
    "build": "npm run build --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "seed": "npm run seed -w api",
    "prisma:validate": "npm run prisma:validate -w api",
    "prisma:generate": "npm run prisma:generate -w api",
    "prisma:migrate:dev": "npm run prisma:migrate:dev -w api",
    "prisma:migrate:deploy": "npm run prisma:migrate:deploy -w api"
  }
}
```

В `apps/api/package.json`:

```json
{
  "scripts": {
    "build": "prisma generate && nest build",
    "prisma:validate": "prisma validate",
    "prisma:generate": "prisma generate",
    "prisma:migrate:dev": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "seed": "prisma db seed"
  }
}
```

---

## 26. Полный порядок разработки на 60 часов

Ниже часы означают общее время хакатона, а не человеко-часы.

### Этап 0 — синхронизация команды, 0:00–1:00

**Все трое.**

Сделать:

- прочитать `docs/spec.md`, этот план, `docs/decisions.md`, `docs/stubs.md`;
- назначить владельцев областей;
- договориться об id и JSON contracts;
- зафиксировать Node/npm version;
- проверить доступ к Supabase project и ключам;
- создать короткие feature branches либо договориться о последовательных commits;
- включить защиту `main`, если это не замедляет команду.

Результат:

- никто не меняет один файл параллельно без договорённости;
- backend не изобретает другой ответ, чем ждёт frontend;
- секреты передаются вне git.

### Этап 1 — обновление решений и контрактов, 1:00–2:30

**Full-stack 1 + frontend.**

Сделать:

- заменить SQLite/Express на NestJS/Prisma/Supabase в `docs/spec.md` и `CLAUDE.md`;
- закрыть старые открытые вопросы incident/investigation и replay payload;
- утвердить текущий `IncidentDetail` как MVP-контракт;
- заменить `sourcePage: 0` на `null` в новом контракте;
- создать sample JSON для пяти endpoints;
- записать `docs/api-contract.md`.

Критерий приёмки:

- frontend может отрисовать sample JSON;
- backend-разработчик может написать controller без догадок;
- у каждого поля описано, может ли оно быть `null`.

### Этап 2 — двойная проверка реальных данных, 1:00–4:00

**Full-stack 2, затем проверка Full-stack 1. Параллельно этапу 1.**

Сделать:

- скачать майский и сентябрьский PDF;
- посчитать SHA-256;
- перепроверить страницу мая;
- сохранить page excerpt;
- подтвердить значения;
- не подтверждённые координаты оставить `null`;
- заполнить `data/verified` и manifest.

Критерий приёмки:

- каждое число имеет URL, hash, страницу и excerpt;
- второй человек подтвердил числа;
- golden fixtures не содержат вымышленных координат/дат.

### Этап 3 — investigation-core сначала тестами, 2:30–6:30

**Full-stack 2.**

Сделать:

- создать package;
- написать типы входа/выхода;
- написать тесты сентября и мая;
- реализовать сравнимость, delta, граф створов, коридор и levels;
- сделать шаблонный conclusion;
- добавить input hash/ruleset version.

Критерий приёмки:

- сентябрь стабильно даёт L2 и открытый вверх коридор;
- май стабильно даёт delta `+0.079` и L3;
- в результатах нет обвинительных слов;
- core работает без NestJS/БД/LLM.

### Этап 4 — NestJS + Prisma + Supabase skeleton, 2:30–6:30

**Full-stack 1. Параллельно этапу 3.**

Сделать:

- создать `apps/api`;
- добавить config validation;
- установить Prisma и PostgreSQL driver adapter;
- создать `prisma.config.ts`, `schema.prisma`, `PrismaModule` и singleton `PrismaService`;
- настроить `DATABASE_URL` для runtime и `DIRECT_URL` для Prisma CLI;
- health endpoints;
- Swagger;
- Vite proxy;
- выполнить `prisma validate`, создать и применить initial Prisma migration;
- выполнить `prisma generate`;
- создать Storage bucket.

Критерий приёмки:

- `GET /api/health/ready` отвечает 200;
- Swagger открывается;
- Prisma Client через NestJS соединяется с Supabase;
- `prisma migrate status` не показывает pending/failed migration;
- секреты не попали в git.

### Этап 5 — seed import и read API, 6:30–9:30

**Full-stack 1.**

Сделать:

- написать идемпотентный `prisma/seed.ts` через `upsert`/transaction;
- вставить документы, станции, измерения, сигналы;
- сохранить сентябрь/май/Актау;
- реализовать list/detail repositories;
- реализовать `GET /api/incidents` и detail;
- добавить contract/integration tests.

Критерий приёмки:

- два запуска seed не создают дублей;
- frontend получает реальные серверные ответы;
- четыре сентябрьских значения видны из API.

### Этап 6 — recompute и evidence API, 6:30–10:30

**Full-stack 2.**

Сделать:

- собрать input из repository;
- вызвать core;
- сохранить versioned result;
- реализовать evidence graph;
- реализовать recompute admin endpoint;
- проверить link к source pages.

Критерий приёмки:

- `GET /api/investigations/:id/evidence` возвращает цепочку;
- каждое утверждение имеет source/measurement links;
- одинаковый recompute идемпотентен.

### Этап 7 — первая сквозная интеграция, 9:30–12:00

**Все трое.**

Сделать:

- переключить два frontend stub на API: list/detail;
- переключить evidence endpoint;
- исправить только adapters/contracts, не UI;
- открыть сентябрь;
- проверить числа, L2, исключённую версию и ссылки;
- записать 30-секундный screen capture как контроль.

**Жёсткий критерий 12-го часа:**

Система через NestJS + PostgreSQL + core должна воспроизводимо показать хотя бы одну исключённую географическую версию на реальных данных и открыть основание. Если нет — остановить ingestion/LLM/карту и исправлять только этот путь.

### Этап 8 — frontend replay, 12:00–18:00

**Frontend.**

Сделать:

- Zustand store;
- playback hook;
- projection selector;
- play/pause/seek/reset;
- клавиатуру;
- синхронизацию колонок;
- tests и visual check.

Критерий приёмки: раздел 20.6.

### Этап 9 — backend replay, 12:00–15:00

**Full-stack 2.**

Сделать:

- seed scenario/steps;
- repository/service/controller;
- Zod validation payload;
- `POST /api/replays/:id/start`;
- заменить frontend stub.

Критерий приёмки:

- сценарий одинаков при повторном запросе;
- шаги отсортированы и соответствуют реальным фактам;
- UI replay работает без refetch по шагам.

### Этап 10 — безопасный source cache, 12:00–18:00

**Full-stack 1.**

Сделать:

- SafeFetchService;
- StorageService;
- SHA/dedup;
- source health/ingestion runs;
- сохранить два PDF и три статьи;
- endpoint открытия cached source.

Критерий приёмки:

- при отключении original URL документ открывается из кэша;
- повторное скачивание не создаёт дубль;
- SSRF/size/timeout тесты зелёные.

### Этап 11 — Казгидромет parser, 18:00–25:00

**Full-stack 1.**

Сделать:

- discovery fixture;
- PDF page extraction;
- relevant-page search;
- rule candidates;
- validator;
- admin ingestion endpoint.

Критерий приёмки:

- parser на сохранённом сентябрьском PDF находит нужную страницу;
- все принятые числа совпадают с verified fixture;
- несовпадающее число отклоняется.

Если к 22-му часу таблица нестабильна — parser показывать как импорт документа, а measurements брать из verified seed.

### Этап 12 — GDELT/direct source ingestion, 18:00–24:00

**Full-stack 2.**

Сделать:

- GDELT adapter;
- cache TTL;
- 429 path;
- direct article snapshots;
- deterministic dedup;
- source health.

Критерий приёмки:

- хотя бы одна реальная статья сохранена и отображается;
- при 429 интерфейс не пустеет и показывает cache status.

### Этап 13 — LLM extraction, 24:00–30:00

**Full-stack 2.**

Сделать:

- provider interface;
- disabled provider;
- один реальный provider;
- structured output schema;
- quote validation;
- prompt fixtures RU/KZ;
- failure fallback.

Критерий приёмки:

- LLM извлекает signal из сохранённой статьи;
- ответ проходит Zod;
- неподтверждённая quote отклоняется;
- без API key система продолжает работать на verified seed.

### Этап 14 — досье, 24:00–31:00

**Frontend + Full-stack 1.**

Backend:

- dossier model;
- HTML/JSON exporter;
- print CSS;
- escaping tests.

Frontend:

- route `/dossier/:id`;
- кнопки открыть/печать/JSON;
- layout для A4;
- source links.

Критерий приёмки:

- досье печатается без обрезанных секций;
- каждое число связано с источником;
- есть input hash/ruleset version/disclaimer.

### Этап 15 — optional geography, 30:00–34:00

**Только если координаты подтверждены и этапы 0–14 зелёные.**

Сделать:

- импорт координат с provenance;
- PostGIS query;
- MapLibre layer;
- fallback на линейную схему.

Не выполнять, если координаты приходится угадывать. Линейная схема уже является достойным MVP.

### Этап 16 — Open-Meteo и Актау, 30:00–34:00

**Full-stack 2.**

Сделать:

- один cached Flood response;
- один cached Marine response;
- null-current handling;
- live status;
- не повышать evidence level.

Критерий приёмки:

- Актау честно показывает, почему локализация невозможна;
- отсутствие currents не отображается как «течений нет».

### Этап 17 — стабилизация, 34:00–43:00

**Все трое.**

Сделать:

- заменить оставшиеся обязательные stubs;
- прогнать unit/integration/contract/E2E;
- проверить links/page anchors;
- проверить ошибки и loading;
- проверить 1280×720 на проекторе;
- проверить светлую/тёмную тему;
- проверить offline/cache mode;
- убрать console errors;
- проверить запрещённые формулировки.

После 43-го часа новые функциональные ветки не начинать.

### Этап 18 — демо-сборка и развёртывание, 43:00–48:00

Сделать:

- production build;
- `prisma migrate deploy` на remote Supabase через `DIRECT_URL`/session connection;
- `prisma db seed` на remote Supabase;
- проверить, что runtime `DATABASE_URL` использует подходящий Supabase connection mode: session `:5432` для постоянного NestJS или transaction `:6543?pgbouncer=true` для serverless;
- развернуть web/API, если выбранные бесплатные платформы доступны;
- обязательно подготовить локальный запуск на одном ноутбуке;
- сохранить cached sources;
- сделать backup JSON;
- проверить запуск с чистого clone по README.

Провайдер бесплатного hosting не фиксируется этим документом: условия тарифов меняются. Проверить выбранный вариант в день хакатона. Локальное демо — обязательный план Б.

### Этап 19 — презентация и прогон, 48:00–55:00

**Все трое.**

Сделать:

- финальный трёхминутный сценарий;
- 5–7 слайдов;
- один человек говорит, второй управляет, третий следит за резервом;
- записать запасное видео;
- подготовить ответы на вопросы про задержки данных, LLM, доказательность и влияние.

### Этап 20 — запас, 55:00–60:00

Исправлять только:

- блокирующие ошибки запуска;
- неправильные числа/ссылки;
- сломанный replay;
- проблемы читаемости;
- критические формулировки.

Не добавлять карту, новый источник или новый LLM provider.

---

## 27. Распределение работы

### Frontend-разработчик

- текущий `apps/web`;
- replay и projection;
- API integration;
- dossier route/print;
- states/accessibility;
- visual/E2E проверки;
- трёхминутное демо.

### Full-stack 1: платформа и данные

- NestJS skeleton;
- Prisma schema и Prisma Migrate;
- PrismaModule/PrismaService;
- идемпотентный Prisma seed;
- incidents API;
- source cache/Storage;
- Kazhydromet adapter;
- deployment/runbook.

### Full-stack 2: причинный движок

- contracts;
- investigation-core;
- golden tests;
- recompute/evidence API;
- replay API;
- GDELT/direct articles;
- LLM provider;
- Open-Meteo optional.

### Файлы с повышенным риском конфликта

- корневой `package.json` и `package-lock.json`;
- `apps/api/prisma/schema.prisma` и `apps/api/prisma/migrations/*`;
- `apps/api/prisma.config.ts`;
- `docs/spec.md`;
- `packages/contracts`;
- `apps/web/src/api/contracts.ts`;
- seed fixtures.

Назначить одного владельца каждого из этих файлов. Остальные меняют их через короткий согласованный commit.

---

## 28. Git-порядок для команды

Рекомендуемый размер задач — 1–3 часа.

Ветка/commit должны содержать один законченный результат:

```text
feat/api-bootstrap
feat/investigation-core
feat/replay-ui
feat/kazhydromet-ingestion
feat/dossier-export
```

Перед merge:

- pull/rebase актуального `main` без переписывания чужой работы;
- typecheck;
- lint;
- tests области;
- build, если менялись contracts/dependencies;
- обновить `docs/frontend-plan.md`, `docs/decisions.md`, `docs/stubs.md`;
- не коммитить `.env`, бинарные временные файлы и screenshots.

Не проводить большой косметический рефакторинг во время интеграции backend.

---

## 29. Трёхминутное демо

### 0:00–0:20

Открыта карта/схема Каспия и лента. Одно предложение проблемы: факты появляются в разных источниках, ближайший объект часто обвиняют без пространственной проверки.

### 0:20–0:45

Запуск исторического реплея сентября 2025. Появляется сообщение о зелёной воде. Статус L0.

### 0:45–1:05

Показать, как из реальной статьи извлечены место, время, явление и цитата. Открыть первоисточник. Объяснить: LLM только извлёк структуру.

### 1:05–1:35

Появляются официальные измерения: `0,234`, `0,058`, `0,054`, `0,167`. Нажать на `0,234`, открыть страницу 22 PDF.

### 1:35–2:05

Движок показывает: максимум выше города; возле городского выпуска роста нет. Версия локального интервала не объясняет максимум. Коридор переносится выше города, L2.

### 2:05–2:25

Переключить май: `0,114 → 0,193`, delta `+0,079`, L3. Объяснить, что система не назначает постоянного виновника и анализирует каждый временной срез отдельно.

### 2:25–2:42

Открыть Актау: «недостаточно данных». Показать, что продукт не генерирует уверенный ответ, когда течения и синхронные измерения отсутствуют.

### 2:42–3:00

Открыть досье: вывод, факты, исключённые версии, неизвестные данные, URL, страницы, SHA-256 и ruleset version.

---

## 30. План отказов на демо

| Отказ | Поведение |
|---|---|
| GDELT 429 | cached response + статус degraded |
| Статья удалена | snapshot из Storage |
| Казгидромет недоступен | PDF из Storage, original URL сохранён |
| LLM quota/error | verified extraction, deterministic conclusion |
| Supabase недоступен | `VITE_DATA_MODE=seed`, предупредить «аварийный кэшированный реплей» |
| API hosting спит | локальный NestJS на ноутбуке |
| Нет интернета | локальный seed + заранее сохранённое видео/источники |
| Координаты не подтверждены | линейная схема, без MapLibre |
| PDF parser ошибается | verified JSON import с page provenance |
| Marine currents `null` | состояние «недостаточно данных» |

Перед выступлением открыть нужные PDF локально и в browser cache.

---

## 31. Definition of Done MVP

Проект готов к показу, только если все пункты выполнены:

- [ ] `npm ci` проходит из чистого clone.
- [ ] `prisma validate` и `prisma generate` проходят из чистого clone.
- [ ] `prisma migrate status` подтверждает применённую историю миграций.
- [ ] Web и API запускаются по README.
- [ ] `prisma migrate deploy` применяет схему к чистой PostgreSQL.
- [ ] `prisma db seed` идемпотентен.
- [ ] Сентябрьский кейс загружается через NestJS.
- [ ] Майский кейс загружается через NestJS.
- [ ] Актау отображается как недостаточность данных.
- [ ] Сентябрьский вывод L2 воспроизводится core.
- [ ] Майский delta `+0,079` воспроизводится core.
- [ ] Все demo-числа имеют источник и страницу/честный `null`.
- [ ] Реплей можно поставить на паузу и перемотать.
- [ ] Evidence graph не содержит утверждений без provenance.
- [ ] Досье открывается и печатается.
- [ ] GDELT 429 не ломает ленту.
- [ ] Система работает без LLM.
- [ ] Ни один ключ не находится в git history.
- [ ] Unit/integration/contract/E2E tests зелёные.
- [ ] Production build зелёный.
- [ ] Нет обвинительных формулировок.
- [ ] Проверен локальный план Б.
- [ ] Трёхминутный прогон укладывается во время.

---

## 32. Что отложить после хакатона

- полноценная авторизация и роли редакторов;
- human review queue для LLM candidates;
- автоматическое покрытие всех бюллетеней 2024–2025;
- надёжная геокодировка створов;
- versioned ontology показателей и единиц;
- статистическая оценка повторяемости;
- больше водных объектов и регионов;
- scheduler/queue вместо ручного ingestion;
- object storage lifecycle;
- публичные permalink snapshots;
- полноценный PDF renderer;
- уведомления;
- мониторинг качества источников;
- юридический review формулировок.

---

## 33. Ссылки для реализации

### Проект и данные

- Репозиторий: <https://github.com/kiratonine/caspian-trace>
- Бюллетени Казгидромета: <https://www.kazhydromet.kz/ru/ecology/ezhemesyachnyy-informacionnyy-byulleten-o-sostoyanii-okruzhayuschey-sredy>
- Сентябрь 2025: <https://www.kazhydromet.kz/uploads/files_calendar/9344/file/68f0e81dcc3caatyrau-russ-byulleten-za-sentyabr-2025g.pdf>
- Май 2025: <https://www.kazhydromet.kz/uploads/files_calendar/8606/file/6850158c0099catyrau-russ-byulleten-za-may-2025g.pdf>
- GDELT DOC 2.0: <https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/>
- Open-Meteo Flood: <https://open-meteo.com/en/docs/flood-api>
- Open-Meteo Marine: <https://open-meteo.com/en/docs/marine-weather-api>
- Экологические слушания: <https://hearings.ndbecology.gov.kz/>

### Официальная техническая документация

- NestJS validation: <https://docs.nestjs.com/techniques/validation>
- NestJS OpenAPI: <https://docs.nestjs.com/openapi/introduction>
- NestJS configuration: <https://docs.nestjs.com/techniques/configuration>
- Prisma + NestJS: <https://www.prisma.io/docs/guides/frameworks/nestjs>
- Prisma Config: <https://www.prisma.io/docs/orm/reference/prisma-config-reference>
- Prisma Migrate: <https://www.prisma.io/docs/orm/prisma-migrate>
- Prisma raw queries и Unsupported types: <https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries>
- Prisma + Supabase: <https://supabase.com/docs/guides/database/prisma>
- Supabase connection modes: <https://supabase.com/docs/guides/database/connecting-to-postgres>
- Supabase PostGIS: <https://supabase.com/docs/guides/database/extensions/postgis>
- Supabase Storage: <https://supabase.com/docs/guides/storage>
- Supabase database roles/RLS: <https://supabase.com/docs/guides/database/postgres/roles>
- Gemini structured output: <https://ai.google.dev/gemini-api/docs/structured-output>
- Vite server proxy: <https://vite.dev/config/server-options.html#server-proxy>
- TanStack Query: <https://tanstack.com/query/latest/docs/framework/react/overview>
- Zustand: <https://zustand.docs.pmnd.rs/>

---

## 34. Единственный контрольный вопрос

К 12-му часу ответ должен быть «да»:

> Может ли система на реальных данных, через реальный backend и без LLM-вывода исключить хотя бы одну географическую версию и открыть каждое основание?

Если ответ «нет», команда не делает карту, новые источники и polish. Она исправляет только вертикальный путь `источник → факт → правило → коридор → ссылка`.
