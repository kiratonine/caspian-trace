# Backend 2 → Backend 1: runtime bootstrap handoff

## Причина blocker

`prisma:seed` намеренно загружает только проверенные документы, створы, связи
и измерения. Он не создаёт `IncidentSignal`, `Incident` и `Investigation`.
`PrismaInvestigationRepository.loadInput()` начинает со scoped `Incident` и
fail-closed возвращает `null`, если в его `metadata` нет любого из массивов
`stationIds`, `stationRelationIds`, `measurementIds`, `candidateObjectIds` или
если хотя бы одна scoped запись отсутствует. Поэтому recompute не может сам
создать первый incident.

Машиночитаемый handoff находится в
[`runtime-bootstrap-handoff.json`](../../data/fixtures/investigation/runtime-bootstrap-handoff.json).
Полные inputs остаются в `data/fixtures/investigation/*-input.json`, а точные
ожидаемые результаты ruleset `1.2.0` — в соседних `*-golden.json`.

## Обязательные правила bootstrap

1. Upsert выполняется по стабильному `Incident.id`; повторный запуск не создаёт
   новые signals, links, candidates или investigations.
2. `Incident.metadata` содержит все четыре scope-массива даже для Актау, где
   они пустые. `unknowns` также сохраняется из input.
3. В `stationRelationIds` используются ID строк `StationRelation`, а не ID
   provenance-строк `StationRelationEvidence`:
   `station-relation:<upstream>:<downstream>:upstream-of`.
4. Для канонической пары `st-asa-0-5km-above → st-asa-0-5km-below` в
   `StationRelation.metadata` сохраняется `comparisonPair: true`. Остальные
   две сентябрьские связи имеют `comparisonPair: false`.
5. Для официальных Казгидромет-документов нужно, не затирая seed metadata,
   сохранить semantics, читаемые текущим mapper: `official: true` и
   `verified: true`. Статус документа можно оставить `UNVERIFIED`: seed не
   выдумывает отсутствующие `fetchedAt/cachePath`.
6. Общий candidate `obj-atyrau-su-arnasy` подтверждается названием створа в
   официальных бюллетенях. Это объект для проверки, а не установленный источник.
   Его metadata: `region=atyrau`, `stationId=st-asa-0-5km-below`,
   `waterBody=Жайык`, `completeness=confirmed`; source links — оба официальных
   документа мая и сентября.
7. Сентябрьский signal и его source/link создаются по provenance из manifest.
   В мае и Актау signal отсутствует честно; создавать синтетический signal для
   заполнения UI нельзя.
8. После upsert вход читается через `PrismaInvestigationRepository.loadInput`,
   проверяется `parseInvestigationInput`, затем передаётся в recompute.
   `Investigation` создаёт штатный versioned writer; bootstrap не подменяет
   результат rules engine.

`fixtureInputHash` в manifest относится к полному file input. DB-normalization
может изменить hash (канонические relation IDs и объединённые source links
общего candidate), поэтому runtime-проверка должна сравнивать level, corridor,
codes, dispositions, unknowns и conclusion, а сохранённый hash — с повторным
`runInvestigation(loadedInput)`. Хардкодить fixture hash в DB нельзя.

## Три demo cases

### Атырау, сентябрь 2025

- Incident: `inv-atyrau-2025-09`, регион `atyrau`, показатель
  `нефтепродукты`.
- Signal: `sig-zakon-green-water`; опубликованная страница Zakon.kz, дата
  `2025-09-09T15:16:00+05:00`, source `doc-zakon-green-water`.
- Stations: `st-zhaiyk-1km-above-atyrau`, `st-asa-0-5km-above`,
  `st-asa-0-5km-below`, `st-zhaiyk-1km-below-atyrau`.
- Relations: три канонических ID из manifest; provenance evidence
  `rel-sep-city-to-asa-above`, `rel-sep-asa-pair`,
  `rel-sep-asa-below-to-city-below`.
- Measurements: `m-2025-09-1km-above-atyrau`, `m-2025-09-asa-above`,
  `m-2025-09-asa-below`, `m-2025-09-1km-below-atyrau`.
- Candidate: `obj-atyrau-su-arnasy`.
- Expected: `L2`, открытый вверх corridor до
  `st-zhaiyk-1km-above-atyrau`, contradiction codes
  `NO_LOCAL_INCREASE_IN_PAIR` и `MAXIMUM_UPSTREAM_OF_OBJECT`, unknown
  `UPSTREAM_BOUNDARY_UNMEASURED`. Объект не объясняет этот максимум; это не
  утверждение о полной непричастности объекта.

### Атырау, май 2025

- Incident: `inv-atyrau-2025-05`, регион `atyrau`, показатель
  `нефтепродукты`.
- Signal: отсутствует — отдельного проверенного событийного сообщения нет.
- Stations: `st-asa-0-5km-above`, `st-asa-0-5km-below`.
- Relation: каноническая ASA-пара; provenance evidence `rel-may-asa-pair`.
- Measurements: `m-2025-05-asa-above`, `m-2025-05-asa-below`.
- Candidate: `obj-atyrau-su-arnasy`.
- Expected: `L3`, corridor между двумя створами, supported code
  `LOCAL_INCREASE_IN_PAIR`, точный рост `+0,079 мг/дм³`, unknowns отсутствуют.
  Это локализация интервала, а не виновника.

### Актау: insufficient data

- Incident: `inv-aktau-insufficient`, регион `mangystau`, показатель
  `нефтепродукты`.
- Signals, stations, relations, measurements и candidates: пустые массивы.
- Explicit unknowns: `CURRENT_FIELD_UNAVAILABLE` и
  `SYNCHRONOUS_MEASUREMENTS_UNAVAILABLE`; core добавляет
  `STATION_ORDER_UNVERIFIED`.
- Expected: `L0`, corridor отсутствует, факты и гипотезы пустые, вывод — данных
  недостаточно для пространственной локализации.

## Подтверждение provenance и parser

Тест
[`runtime-bootstrap-handoff.spec.ts`](../../apps/api/test/investigations/runtime-bootstrap-handoff.spec.ts)
для каждого case вызывает `parseInvestigationInput`, повторно запускает
`runInvestigation`, сравнивает результат с golden и сверяет все measurement и
relation facts с `data/verified` (ID, station, value/raw value, unit, period,
document URL/SHA, page и excerpt).

Incident ID/title — стабильные demo identifiers, а не внешняя цитата. Candidate
берётся из официального названия створа. Единственный signal имеет проверяемую
опубликованную URL/date/excerpt provenance. Для Актау evidence facts не
создаются: его unknowns описывают именно отсутствие данных. Таким образом,
handoff не добавляет вымышленных измерений, связей, объектов или signals.

Изменения handoff не требуют и не содержат правок Prisma schema, seed или
`AppModule`.
