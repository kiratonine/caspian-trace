# Backend Investigation — итог и handoff

## Реализовано

- `@caspian-trace/investigation-core`: точная decimal-арифметика, сравнимость,
  граф створов, corridor, evidence levels, unknowns и безопасный conclusion.
- Golden cases: сентябрь `L2/open upstream`, май `+0,079/L3`, Актау `L0`.
- Versioned fixture repository с атомарной заменой current version и rollback
  regression. Prisma adapter подключается через существующие ports после P2
  Backend Platform.
- Evidence, replay и JSON/HTML dossier endpoints подключены к основному
  `AppModule`.
- Replay возвращает immutable snapshot; сентябрьский сценарий длится 25 секунд.
- HTML export экранирует строки, проверяет URL и отправляется с CSP, UTF-8,
  `nosniff` и print CSS.
- Disabled и Gemini LLM providers; structured output проходит Zod, exact quote,
  date precision, table-number и forbidden-blame проверки.
- Frontend evidence/replay clients используют реальные endpoints. Для Vite dev
  `/api` проксируется на `http://localhost:3000`.
- Стабильные ответы находятся в `data/fixtures/investigation/api` и
  воспроизводятся командой `npm run generate:investigation-samples`.
- Направления связей станций не выводятся из порядка строк или названий: они
  имеют отдельные verified fixtures с PDF-страницей, основанием и выдержкой;
  relation без полной provenance core игнорирует как непроверенную.

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
LLM не повышает evidence level и не создаёт rule-engine statements.

## Contract assumptions

- Evidence statement содержит `id`, `code`, `kind`, `text`, provenance,
  `generatedBy` и `sortOrder`.
- Decimal входит в core как string; наружу Measurement contract отдаёт finite
  number вместе с исходным `rawValueText`.
- `sourcePage` — положительный номер PDF-страницы или `null`.
- Unknown geometry остаётся `null`; координаты не реконструируются.
- Replay payload — discriminated union из `@caspian-trace/contracts`.

## Prisma schema requests для Backend Platform P2

Prisma в текущем platform bootstrap отсутствует. После появления единственного
`PrismaService` adapter должен сохранить существующие ports и обеспечить одной
`$transaction`:

- current/versioned Investigation с `inputHash`, `rulesetVersion`, level,
  conclusion и corridor bounds;
- EvidenceStatement с `code`, `kind`, `text`, `generatedBy`, `sortOrder`;
- many-to-many links statement → Measurement/SourceDocument;
- InvestigationUnknown и ObjectDisposition;
- переключение предыдущего `isCurrent=false` и создание нового current;
- unique/idempotency boundary по investigation/inputHash/rulesetVersion.

Feature-код не создаёт второй PrismaClient и не предполагает имена generated
models до появления утверждённой migration Backend Platform.

## Проверки

```bash
npm ci --include=optional
npm run verify:investigation-data
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
- versioned recompute идемпотентен, а неуспешное атомарное сохранение не меняет current;
- evidence/replay/export/LLM modules подключены к реальному `AppModule`;
- contracts, frontend clients, стабильные samples и production/dev runtime probe синхронизированы;
- SHA-256 официальных PDF повторно сверены скачиванием: сентябрь
  `360390d641e3e3d2b8a6b4157b3eebdf6386cb24bee08cdf9c38a1d6f01b4fbb`, май
  `73fb21e06f529160bf8756b3612bc3eab6a9f3615a91530ff19292120c684bce`;
- значения сентября подтверждены на PDF-странице 22, значения мая — на PDF-странице 24.

Три внешних шага нельзя корректно подделать внутри этой ветки:

1. два человека должны независимо заполнить `checkedBy` для каждого measurement/relation;
2. live Gemini smoke-test требует выданный команде `GEMINI_API_KEY` (adapter покрыт mock-тестом);
3. Prisma adapter требует schema, migration и общий `PrismaService` этапа Backend Platform P2;
   до этого используется полностью тестируемый versioned fixture adapter и готовые ports/schema requests.

## Ограничения и ответы для демо

- Сентябрь `L2`: максимум находится на верхнем измеренном створе, локальная
  пара ниже не показывает рост; верхняя граница остаётся открытой.
- Май `L3`: сопоставимая официальная пара показывает точный рост `+0,079`,
  поэтому локализован интервал, но не виновник.
- Фраза «объект не объясняет данный максимум» не означает «объект непричастен».
- Направление волн, отсутствие объекта в OSM и LLM-текст не используются как
  причинное доказательство.
- Prisma persistence, source cache и raw-page ingestion остаются handoff от
  незавершённых этапов Backend Platform P2+; fixture mode полностью покрывает
  автономное демо Backend Investigation.
