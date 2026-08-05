# Backend Investigation — итог и handoff

## Реализовано

- `@caspian-trace/investigation-core`: точная decimal-арифметика, сравнимость,
  граф створов, corridor, evidence levels, unknowns и безопасный conclusion.
- Golden cases: сентябрь `L2/open upstream`, май `+0,079/L3`, Актау `L0`.
- Versioned Prisma repository с serializable `$transaction`, атомарной заменой
  current version, rollback regression и дедупликацией конкурентного save.
  Fixture repository сохранён для автономных demo/unit tests.
- Evidence, replay и JSON/HTML dossier endpoints подключены к основному
  `AppModule`.
- Replay возвращает immutable snapshot; сентябрьский сценарий длится 25 секунд.
- HTML export экранирует строки, проверяет URL и отправляется с CSP, UTF-8,
  `nosniff` и print CSS.
- Disabled и Gemini LLM providers; structured output проходит Zod, exact quote,
  date precision, table-number и forbidden-blame проверки.
- Frontend evidence/replay clients используют реальные endpoints; evidence
  подмешивается в выбранный incident detail, а JSON/HTML dossier доступны из
  правой панели. Для Vite dev `/api` проксируется на `http://localhost:3000`.
- Стабильные ответы находятся в `data/fixtures/investigation/api` и
  воспроизводятся командой `npm run generate:investigation-samples`.
- Направления связей станций не выводятся из порядка строк или названий: они
  имеют отдельные verified fixtures с PDF-страницей, основанием и выдержкой;
  relation без полной provenance, существующего официального source document
  и runtime-valid references core игнорирует как непроверенную.
- Ruleset `1.2.0` канонизирует вход перед hash/evaluation, создаёт уникальные
  evidence IDs для каждой пары измерений, не связывает corridor с
  противоречием из другого компонента графа и не выбирает максимум между
  несопоставимыми unit/matrix/period.
- Replay не создаёт L1-шаги из непроверенных источников/измерений; Gemini key
  передаётся заголовком, запрос ограничен timeout, а startup валидирует все
  integration env variables.

## Endpoints

```http
GET  /api/investigations/inv-atyrau-2025-09/evidence
POST /api/replays/inv-atyrau-2025-09/start
GET  /api/investigations/inv-atyrau-2025-09/export?format=json
GET  /api/investigations/inv-atyrau-2025-09/export?format=html
POST /api/admin/investigations/inv-atyrau-2025-09/recompute
X-Ingestion-Token: <INGESTION_TOKEN>
```

## Environment

```dotenv
LLM_PROVIDER=disabled

# Optional real provider
LLM_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

Без ключа система воспроизводит все core/evidence/replay/export результаты.
LLM не повышает evidence level и не создаёт rule-engine statements. Публичные
evidence/replay/export endpoints читают только сохранённый current snapshot;
вычисление и versioned write выполняет защищённый admin recompute.

## Contract assumptions

- Evidence statement содержит `id`, `code`, `kind`, `text`, provenance,
  `generatedBy` и `sortOrder`.
- Decimal входит в core как string; наружу Measurement contract отдаёт finite
  number вместе с исходным `rawValueText`.
- `sourcePage` — положительный номер PDF-страницы или `null`.
- Unknown geometry остаётся `null`; координаты не реконструируются.
- Replay payload — discriminated union из `@caspian-trace/contracts`.

## Prisma persistence после Backend Platform P2

Реализованный schema request и transaction boundary описаны в
[`prisma-schema-request.md`](./prisma-schema-request.md).

Интегрированы единый `PrismaService`, generated client и platform migrations.
`PrismaInvestigationRepository` сохраняет существующие ports и обеспечивает
одной `$transaction`:

- current/versioned Investigation с `inputHash`, `rulesetVersion`, level,
  conclusion и corridor bounds;
- EvidenceStatement с `code`, `kind`, `text`, `generatedBy`, `sortOrder`;
- many-to-many links statement → Measurement/SourceDocument;
- InvestigationUnknown и ObjectDisposition;
- переключение предыдущего `isCurrent=false` и создание нового current;
- unique/idempotency boundary по investigation/inputHash/rulesetVersion.

Rule `code` является классификатором, а не уникальным идентификатором: одна
версия может содержать несколько statements одного code для разных интервалов.

Feature-код не создаёт второй PrismaClient. Недостающие unique/provenance
ограничения добавлены отдельной migration поверх утверждённой platform schema.

## Проверки

```bash
npm ci --include=optional
npm run verify:investigation-data
npm run verify:investigation-data:human
npm run typecheck
npm run lint
npm run test
npm run test:e2e -w api
npm run build
npm run test:api-clean-start
```

Человеческий data gate:

```bash
node scripts/verify-investigation-data.mjs --require-human
```

Он намеренно красный, пока каждое demo-число не подтвердят два участника.

## Definition of Done status

Техническая часть роли закрыта в автономном fixture mode:

- core изолирован от NestJS/Prisma/LLM, decimal/golden/hash/safety tests зелёные;
- одинаковый канонический input/ruleset даёт одинаковые hash и result даже при
  нескольких измерениях на relation и перестановке входных массивов;
- versioned recompute идемпотентен, а неуспешное атомарное сохранение не меняет current;
- evidence/replay/export/LLM modules подключены к реальному `AppModule`;
- contracts, frontend clients, стабильные samples и production/dev runtime probe синхронизированы;
- SHA-256 официальных PDF повторно сверены скачиванием: сентябрь
  `360390d641e3e3d2b8a6b4157b3eebdf6386cb24bee08cdf9c38a1d6f01b4fbb`, май
  `73fb21e06f529160bf8756b3612bc3eab6a9f3615a91530ff19292120c684bce`;
- значения сентября подтверждены на PDF-странице 22, значения мая — на PDF-странице 24.

Два внешних шага нельзя корректно подделать внутри этой ветки:

1. два человека должны независимо заполнить `checkedBy` для каждого measurement/relation;
2. live Gemini smoke-test требует выданный команде `GEMINI_API_KEY` (adapter покрыт mock-тестом).

## Ограничения и ответы для демо

- Сентябрь `L2`: максимум находится на верхнем измеренном створе, локальная
  пара ниже не показывает рост; верхняя граница остаётся открытой.
- Май `L3`: сопоставимая официальная пара показывает точный рост `+0,079`,
  поэтому локализован интервал, но не виновник.
- Фраза «объект не объясняет данный максимум» не означает «объект непричастен».
- Направление волн, отсутствие объекта в OSM и LLM-текст не используются как
  причинное доказательство.
- Source cache и raw-page ingestion остаются handoff следующих этапов Backend
  Platform; Prisma persistence расследований реализован в этой ветке.
