# «Каспийский след»: план Backend 2 — причинный движок, evidence, replay и export

> Роль: Full-stack разработчик 2, фактически backend/domain  
> Ветка: `feat/backend-investigation`  
> Главная ответственность: проверенные данные, investigation-core, evidence API, replay, dossier export и LLM  
> Не отвечает за: Prisma schema/migrations, source crawling, Storage, incidents read API и frontend

---

## 1. Результат роли

К концу работы Backend 2 должен передать:

- независимо тестируемый причинный движок без NestJS/БД/LLM;
- проверенные fixtures мая и сентября 2025 года;
- воспроизводимые golden results;
- сохранение версионированного результата через Prisma adapter;
- evidence graph API;
- неизменяемый replay API;
- HTML/JSON export публичного досье;
- LLM provider для извлечения структуры с жёсткой валидацией;
- тесты запрещённых выводов и provenance;
- feature modules, которые Backend 1 только импортирует в `AppModule`.

Главный принцип: все выводы должны воспроизводиться при `LLM_PROVIDER=disabled`.

---

## 2. Зона владения файлами

Backend 2 единолично редактирует:

```text
packages/investigation-core/**
data/verified/**
data/fixtures/investigation/**
apps/api/src/investigations/**
apps/api/src/replays/**
apps/api/src/export/**
apps/api/src/llm/**
apps/api/test/investigations/**
apps/api/test/replays/**
apps/api/test/export/**
apps/api/test/llm/**
```

Backend 2 не редактирует:

```text
apps/web/**
apps/api/src/main.ts
apps/api/src/app.module.ts
apps/api/src/prisma/**
apps/api/prisma/**
apps/api/src/incidents/**
apps/api/src/sources/**
apps/api/src/ingestion/**
packages/contracts/**
package.json
package-lock.json
.github/workflows/ci.yml
```

Новая таблица/колонка оформляется как короткий schema request Backend 1. Backend 2 не создаёт собственную Prisma migration.

---

## 3. Как начать независимо от Backend 1

Первые 7–9 часов не требуют NestJS, Prisma или Supabase.

Backend 2 начинает с:

- проверки PDF/fixtures;
- domain types;
- pure investigation functions;
- golden tests;
- replay projection data;
- dossier model.

Когда bootstrap commit Backend 1 попадёт в `main`, обновить ветку и подключить готовый package к NestJS. До этого не создавать временный второй API-проект.

---

## 4. Handoff-контракты

### От Backend 1 нужны

- `packages/contracts`;
- generated Prisma Client;
- `PrismaService` import path;
- модели/relations из roadmap;
- sample API fixtures;
- raw article/page text для LLM tests.

### Backend 2 отдаёт Backend 1

- `data/verified/atyrau-2025-09.json`;
- `data/verified/atyrau-2025-05.json`;
- `data/verified/manifest.json`;
- golden investigation JSON;
- feature modules;
- список schema requests;
- команды unit/integration tests.

### Frontend получает

- `GET /api/investigations/:id/evidence`;
- `POST /api/replays/:id/start`;
- `GET /api/investigations/:id/export?format=json|html`;
- стабильные sample responses до готовности endpoints.

---

## 5. Этап D0 — проверка доказательных данных, 0:00–4:00

### Источники

Сентябрь:

```text
https://www.kazhydromet.kz/uploads/files_calendar/9344/file/68f0e81dcc3caatyrau-russ-byulleten-za-sentyabr-2025g.pdf
```

Май:

```text
https://www.kazhydromet.kz/uploads/files_calendar/8606/file/6850158c0099catyrau-russ-byulleten-za-may-2025g.pdf
```

### Проверить сентябрь

```text
1 км выше Атырау                         0,234 мг/дм³
0,5 км выше «Атырау су арнасы»          0,058
0,5 км ниже «Атырау су арнасы»          0,054
1 км ниже города                        0,167
выше осетрового завода                  0,066
ниже осетрового завода                  0,063
Дамба                                   0,067
```

Страница ожидается 22. Проверить вручную.

### Проверить май

```text
выше того же сброса                     0,114 мг/дм³
ниже того же сброса                     0,193
delta                                   +0,079
```

Страницу не выдумывать: подтвердить либо сохранить `null`.

### Verified fixture fields

```ts
type VerifiedMeasurementFixture = {
  id: string;
  stationId: string;
  stationLabel: string;
  indicator: string;
  rawValueText: string;
  normalizedValue: string;
  unit: string;
  sampledAt: string | null;
  sampledPeriod: string | null;
  sourceUrl: string;
  sourceSha256: string;
  sourcePage: number | null;
  sourceExcerpt: string;
  checkedBy: string[];
  checkedAt: string;
};
```

### Правила

- два участника подтверждают каждое demo-число;
- hash относится к реально скачанному PDF;
- месяц не превращается в первое число;
- координаты не добавляются;
- station relation добавляется только при подтверждённом основании;
- реконструированный excerpt явно отмечается и не выдаётся за цитату.

### Ранний handoff

Сделать отдельный commit только с `data/verified/**` и передать Backend 1 для seed. Это единственный ранний cross-branch handoff.

---

## 6. Этап D1 — package investigation-core, 1:00–3:00

Структура:

```text
packages/investigation-core/src/
├─ index.ts
├─ types.ts
├─ normalize.ts
├─ comparison.ts
├─ station-graph.ts
├─ intervals.ts
├─ exclusions.ts
├─ corridor.ts
├─ evidence-level.ts
├─ unknowns.ts
├─ conclusion.ts
├─ hash.ts
└─ run-investigation.ts
```

Package не импортирует:

- NestJS;
- Prisma;
- Supabase;
- HTTP client;
- LLM SDK;
- frontend types.

Допустимые зависимости: `decimal.js`, стандартная crypto-функция для hash и общие domain contracts без API/framework деталей.

---

## 7. Этап D2 — domain types, 2:00–4:00

### Input

```ts
type InvestigationInput = {
  incident: IncidentFact;
  signals: IncidentSignalFact[];
  stations: StationFact[];
  stationRelations: StationRelationFact[];
  measurements: MeasurementFact[];
  candidateObjects: CandidateObjectFact[];
  sourceDocuments: SourceDocumentFact[];
};
```

### Result

```ts
type InvestigationResult = {
  evidenceLevel: 'L0' | 'L1' | 'L2' | 'L3';
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

### Numeric boundary

Core получает decimal-строки и создаёт `Decimal` внутри. Он не получает `Prisma.Decimal` и не использует арифметику JS number.

---

## 8. Этап D3 — правила сравнимости, 3:00–5:00

### Функции

```ts
normalizeIndicatorName(value): string
normalizeUnit(value): NormalizedUnit
areMeasurementsComparable(a, b): ComparisonResult
computePairedDelta(upstream, downstream): Decimal
```

### Comparable только если

- одинаковый показатель;
- одинаковая матрица;
- единицы одинаковы или есть проверенный converter;
- время/период совместимы;
- relation выше/ниже подтверждён;
- source official;
- отсутствующее поле не заменено предположением.

### Reasons

```text
INDICATOR_MISMATCH
MATRIX_MISMATCH
UNIT_MISMATCH
TIME_MISMATCH
RELATION_UNVERIFIED
SOURCE_NOT_OFFICIAL
```

Нельзя сравнивать только потому, что две точки визуально стоят рядом.

---

## 9. Этап D4 — граф створов, 4:00–6:00

### Функции

```ts
buildStationGraph(relations)
detectCycle(graph)
topologicalStationOrder(graph)
isUpstreamOf(a, b, graph)
```

### Правила

- relation направлена upstream → downstream;
- цикл делает полный порядок недействительным;
- частичный граф остаётся частичным;
- `riverOrder` можно вывести только при достаточных relations;
- отсутствие relation создаёт unknown, а не false;
- подпись «выше» в названии точки может быть основанием только при сохранённом source document/basis.

---

## 10. Этап D5 — причинные правила и corridor, 5:00–8:00

### Функции

```ts
findEventMaximum(measurements)
evaluatePairedIntervals(input)
excludeDownstreamExplanations(input)
deriveCorridor(input, facts)
classifyObjects(input, corridor, contradicted)
```

### R1: максимум выше объекта

Если официальный максимум расположен выше объекта по подтверждённому графу, нижележащий объект не объясняет этот максимум.

Code: `MAXIMUM_UPSTREAM_OF_OBJECT`.

### R2: пара без роста

```text
downstream - upstream <= 0
```

Code: `NO_LOCAL_INCREASE_IN_PAIR`.

Вывод: пара не подтверждает локальное поступление в этом временном срезе. Не писать «объект оправдан».

### R3: пара с ростом

```text
downstream - upstream > 0
```

Code: `LOCAL_INCREASE_IN_PAIR`.

Вывод: внутри интервала зафиксирован рост; причина и виновник не установлены.

### R4: открытый верхний corridor

Если максимум находится на самой верхней подтверждённой точке, corridor `open_upstream`.

### R5: неполная география

Нет полного порядка — `STATION_ORDER_UNVERIFIED`, без вымышленного GeoJSON.

---

## 11. Этап D6 — уровни и conclusion, 6:00–9:00

### Levels

- L0 — сигнал/недостаточно данных;
- L1 — официальный источник или два независимых сообщения;
- L2 — подтверждённое пространственное правило исключило часть версий;
- L3 — сравнимая лабораторная пара ограничила corridor.

LLM, волны и красивый UI уровень не повышают.

### Functions

```ts
deriveEvidenceLevel(input, corridor): EvidenceLevel
buildUnknowns(input): InvestigationUnknown[]
buildConclusion(resultWithoutConclusion): string
calculateInputHash(input): string
runInvestigation(input): InvestigationResult
```

### Conclusion

Шаблонный, по rule codes. Запрещённые формулировки:

```text
виновен
нарушитель
источник установлен
доказано, что предприятие
объект не причастен
```

---

## 12. Этап D7 — golden tests, 7:00–11:00

### Сентябрь

Ожидать:

- maximum `0.234`;
- pair delta `-0.004`;
- L2;
- `open_upstream` от «1 км выше Атырау»;
- городской интервал не объясняет максимум;
- объект не оправдан вообще;
- unknown о следующем верхнем створе.

### Май

Ожидать:

- delta `+0.079`;
- corridor между paired stations;
- L3;
- формулировка «интервал требует проверки»;
- нет установленного виновника.

### Актау

Ожидать:

- L0;
- corridor null;
- unknown currents/synchronous measurements;
- conclusion «источник не локализован».

### Дополнительные tests

- units mismatch;
- period mismatch;
- cycle;
- partial graph;
- missing OSM object;
- wave evidence;
- conflicting signals;
- deterministic hash;
- same input → same output.

К 11-му часу передать golden JSON Backend 1 и frontend.

---

## 13. Этап D8 — persistence ports, 10:00–13:00

Чтобы не зависеть от Prisma в core, определить порты в Nest feature module:

```ts
interface InvestigationInputReader {
  loadInput(investigationId: string): Promise<InvestigationInput>;
}

interface InvestigationResultWriter {
  findCurrent(investigationId: string): Promise<StoredResult | null>;
  saveVersioned(input: SaveInvestigationResult): Promise<StoredResult>;
}
```

Первый unit adapter читает fixtures. После handoff Backend 1 реализовать `PrismaInvestigationRepository` внутри `apps/api/src/investigations` с общим `PrismaService`.

Backend 2 не создаёт PrismaClient и не меняет schema.

---

## 14. Этап D9 — recompute service, 12:00–17:00

### Метод

```ts
InvestigationsService.recompute(investigationId): Promise<InvestigationDto>
```

Алгоритм:

1. Repository собирает input.
2. Mapper переводит `Prisma.Decimal` в string.
3. `runInvestigation`.
4. Сравнение input hash/ruleset.
5. Если без изменений — вернуть current.
6. Иначе `prisma.$transaction`:
   - старый `isCurrent=false`;
   - новый Investigation;
   - evidence statements;
   - measurement/source links;
   - unknowns;
   - object dispositions.
7. Вернуть API DTO.

Частично сохранённый result недопустим.

### Endpoint

```http
POST /api/admin/investigations/:id/recompute
X-Ingestion-Token: ...
```

Guard/token предоставляет Backend 1 либо Backend 2 использует общий guard после merge.

---

## 15. Этап D10 — evidence API, 15:00–20:00

### Controller

```ts
InvestigationsController.getEvidence(id)
```

### Service/repository

```ts
InvestigationsService.getEvidenceGraph(id)
EvidenceRepository.findGraph(id)
```

### Endpoint

```http
GET /api/investigations/:id/evidence
```

Каждый statement содержит:

- kind/code/text;
- measurement ids;
- source document ids;
- generatedBy;
- sort order.

Statement `supports/contradicts` без источника запрещён. Unknown может ссылаться только на code/text.

### Contract test

Ответ должен проходить `EvidenceGraphSchema` из package Backend 1 и совпадать по смыслу с golden fixture.

---

## 16. Этап D11 — replay API, 18:00–23:00

### Структура

```text
apps/api/src/replays/
├─ replays.module.ts
├─ replays.controller.ts
├─ replays.service.ts
├─ replays.repository.ts
└─ replay.mapper.ts
```

### Endpoint

```http
POST /api/replays/:id/start
```

Сервер не запускает timer. Возвращает immutable scenario.

### Steps

```text
signal
corroboration
measurement
inference
conclusion
```

Каждый payload — discriminated union из contracts.

Проверить:

- offsets возрастают;
- measurement ids существуют;
- source ids существуют;
- тексты соответствуют текущему ruleset/golden;
- повторный запрос возвращает тот же сценарий;
- сценарий не содержит вымышленных событий.

---

## 17. Этап D12 — публичное досье, 21:00–29:00

### Model

```ts
type DossierModel = {
  title: string;
  generatedAt: string;
  disclaimer: string;
  conclusion: string;
  evidenceLevel: EvidenceLevel;
  signals: IncidentSignalDto[];
  measurements: MeasurementDto[];
  supportedFacts: EvidenceStatementDto[];
  contradictedHypotheses: EvidenceStatementDto[];
  unknowns: InvestigationUnknownDto[];
  candidateObjects: CandidateObjectDto[];
  sources: DossierSourceDto[];
  inputHash: string;
  rulesetVersion: string;
};
```

### Services

```ts
ExportService.buildDossierModel(id)
ExportService.renderJson(model)
ExportService.renderHtml(model)
```

### Endpoint

```http
GET /api/investigations/:id/export?format=json
GET /api/investigations/:id/export?format=html
```

### HTML security

- escape всех строк;
- никакого raw HTML из source/LLM;
- CSP в response;
- UTF-8;
- print CSS;
- source URL validation;
- filename safe;
- no inline script.

PDF generator не нужен: frontend использует browser print.

---

## 18. Этап D13 — LLM provider, 27:00–35:00

### Файлы

```text
apps/api/src/llm/
├─ llm.module.ts
├─ llm.service.ts
├─ llm-provider.ts
├─ disabled-llm.provider.ts
├─ gemini-llm.provider.ts
├─ schemas/
└─ prompts/
```

### Interface

```ts
interface LlmProvider {
  extractIncidentSignal(input): Promise<ExtractedSignal>;
  extractMeasurementCandidates(input): Promise<MeasurementCandidate[]>;
  classifyPossibleDuplicate(input): Promise<DuplicateAssessment>;
  explainFacts(input): Promise<GeneratedExplanation>;
}
```

### Приоритет

1. `DisabledLlmProvider` всегда работает.
2. Один реальный provider.
3. Второй provider только при запасе времени.

### Signal structured output

```text
observedAt nullable
observedPeriod nullable
locationText
phenomenon enum
excerpt
evidenceQuotes[1..3]
confidence 0..1
```

### После LLM

- Zod parse;
- quote дословно находится в source text;
- excerpt подтверждается quote;
- точность даты не повышена;
- координаты не создаются;
- неподтверждённый ответ rejected/review;
- числа таблицы сверяются с page text.

### Explanation

LLM получает только allowed facts/unknowns. Любое новое число или обвинительная формулировка отклоняются. Основной conclusion остаётся шаблонным.

### Интеграция с Backend 1

Backend 1 передаёт сохранённый article/page text в `LlmService`. LlmService не скачивает публичные страницы сам и не владеет ingestion status.

---

## 19. Этап D14 — integration с Prisma/API, 34:00–39:00

После merge platform bootstrap:

1. Обновить ветку.
2. Импортировать общий PrismaService.
3. Импортировать contracts.
4. Реализовать Prisma repositories только в своей зоне.
5. Не менять schema; отправить requests Backend 1.
6. Проверить generated client.
7. Экспортировать feature modules.
8. Передать Backend 1 список imports для AppModule.

### Imports для Backend 1

```ts
InvestigationsModule
ReplaysModule
ExportModule
LlmModule
```

Не редактировать `AppModule` в своей ветке: это устраняет прямой merge conflict.

---

## 20. Этап D15 — tests, 38:00–44:00

### Unit

- весь core;
- conclusion forbidden terms;
- replay validation;
- dossier model;
- HTML escaping;
- LLM quote validation;
- LLM number mutation rejection;
- disabled provider.

### Integration

- recompute idempotent;
- changed input creates new version;
- transaction rollback;
- evidence graph provenance;
- replay endpoint stable;
- export JSON schema;
- export HTML safe;
- unknown id 404;
- admin token protected.

### Golden

Golden output меняется только отдельным reviewed commit с объяснением, какое правило изменилось.

---

## 21. Этап D16 — integration support и демо, 44:00–52:00

Сделать:

- помочь frontend подключить three endpoints;
- сравнить frontend output с golden;
- проверить replay 25–30 секунд;
- открыть source links;
- проверить dossier;
- запустить без LLM key;
- запустить с cached sources;
- объяснить команде, почему сентябрь L2, а май L3;
- подготовить ответы жюри про «не виновник» и ограничения данных.

После 43-го часа не добавлять новые rules.

---

## 22. Что Backend 2 не должен делать

- не редактировать Prisma schema/migrations;
- не создавать второй PrismaService;
- не редактировать contracts package напрямую;
- не скачивать сайты в LLM module;
- не внедрять выводы в IncidentsService;
- не вычислять по волнам направление переноса;
- не использовать OSM absence как доказательство;
- не назначать виновника;
- не повышать уровень на основании LLM;
- не добавлять вымышленные координаты/даты;
- не делать PDF generator до готового HTML export.

---

## 23. План commits

```text
data: add verified May and September evidence fixtures
feat(core): add measurement comparison and station graph
feat(core): derive corridors exclusions and evidence levels
test(core): lock September May and Aktau golden results
feat(api): add versioned investigation recompute
feat(api): expose complete evidence graph
feat(api): add immutable September replay
feat(export): render safe JSON and HTML dossier
feat(llm): add validated provider and disabled fallback
test(api): cover provenance replay export and LLM guards
```

---

## 24. Handoff интегратору

Перед merge передать:

- verified manifest/hash/page status;
- golden results;
- ruleset version;
- feature module exports;
- schema requests;
- contracts assumptions;
- endpoint examples;
- test/build output;
- LLM env variables;
- список отключаемых optional features;
- известные ограничения коридора.

---

## 25. Definition of Done Backend 2

- [ ] Verified fixtures проверены двумя людьми.
- [x] Core не зависит от NestJS/Prisma/LLM.
- [x] Decimal calculations точные.
- [x] Station graph не выдумывает порядок.
- [x] Сентябрь даёт L2/open upstream.
- [x] Май даёт `+0,079` и L3 corridor.
- [x] Актау даёт L0/insufficient data.
- [x] Conclusion не содержит обвинений.
- [x] Same input/ruleset даёт same hash/result.
- [x] Recompute versioned и transactional.
- [x] Evidence statement имеет provenance.
- [x] Replay immutable и contract-valid.
- [x] Export JSON/HTML работает и безопасен.
- [x] Disabled LLM provider работает.
- [x] LLM output проверяется Zod/quotes/numbers.
- [x] Feature modules подключаются одним import.
- [x] Unit/integration/golden tests зелёные.

Оставшийся пункт является внешним gate, который нельзя честно закрыть кодом:

- human review остаётся `0/2`; финальная команда
  `npm run verify:investigation-data:human` намеренно завершается ошибкой.

Prisma gate закрыт интеграцией Backend Platform P2: runtime использует общий
`PrismaService`, generated client и `PrismaInvestigationRepository` с
serializable `$transaction`, version uniqueness, rollback и provenance links.

---

## 26. Общий порядок объединения веток

1. После bootstrap commit обновить `feat/backend-investigation`.
2. До merge передать Backend 1 schema requests и module imports; не править shared-файлы в последний момент.
3. Backend 1 вливает platform в `integration/mvp` первым.
4. Backend 2 обновляет свою ветку от этого integration commit и проверяет Prisma adapters.
5. Влить investigation-ветку; Backend 2 решает конфликты только внутри core/investigations/replays/export/llm/data fixtures.
6. Конфликты schema/contracts/AppModule/package-lock решает Backend 1 по согласованному контракту.
7. После frontend merge прогнать golden + API + трёхминутный replay.
8. Golden fixture не обновлять ради прохождения теста без объяснения изменения правила.
9. После общего подтверждения integration-ветка идёт в `main`.
