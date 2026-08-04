# Контракт фронт ↔ бэк одной страницей

Обновлено: 04.08.2026 после сессии 13 (переезд на общий пакет).

**Источник истины — код, а не этот файл.** Схемы и типы живут в
`packages/contracts/src/schemas.ts`, эталонные значения — в
`packages/contracts/fixtures/*.json`. Владелец пакета — Full-stack 1;
фронт его только читает. Ниже — карта: что где лежит и что означает,
чтобы не перечитывать 430 строк схем ради одного поля.

## Эндпоинты и владельцы

| Функция фронта | Эндпоинт | Схема ответа | Владелец | Статус |
|---|---|---|---|---|
| `fetchIncidents` | `GET /api/incidents` | `IncidentSummaryListSchema` | Full-stack 1 | эндпоинта нет, есть фикстура |
| `fetchIncidentDetail` | `GET /api/incidents/:id` | `IncidentDetailSchema` | Full-stack 1 | эндпоинта нет, есть фикстура |
| `fetchLiveStatus` | `GET /api/live/status` | `LiveStatusSchema` | Full-stack 1 | эндпоинта нет, есть фикстура |
| `startReplay` | `POST /api/replays/:id/start` | `ReplayScenarioSchema` | Full-stack 2 | эндпоинта нет, есть фикстура |
| `fetchInvestigationEvidence` | `GET /api/investigations/:id/evidence` | `EvidenceGraphSchema` | Full-stack 2 | эндпоинта нет, есть фикстура |
| `fetchDossierJson` | `GET /api/investigations/:id/export?format=json` | `DossierSchema` | Full-stack 2 | эндпоинта нет, есть фикстура |

Поднят и работает пока только `GET /api/health/live`.

Служебные, которые может понадобиться знать фронту:
`GET /api/source-documents/:id/open?page=22` (документ из кэша Storage, когда
оригинальный URL недоступен),
`GET /api/investigations/:id/export?format=html` (серверный печатный HTML —
наш маршрут `/dossier/:id` от него не зависит),
`GET /api/docs` (Swagger).

## Что изменилось для фронта при переезде (сессия 13)

| Было у нас | Стало в пакете |
|---|---|
| `IncidentDetail.provenance` | поля `rulesetVersion`/`inputHash` — в `Dossier`, не в detail |
| `DossierExport { generatedAt, disclaimer, incident }` | плоский `Dossier` из 14 полей |
| `unit`, `matrix`, `phenomenon` — свободные строки | закрытые enum: `mg/dm3\|mg/kg\|percent`, `water\|sediment`, 6 явлений |
| `sha256: ''` = «не вычислен» | `sha256: null`, либо ровно 64 hex-символа |
| `Measurement` без `qualityClass`/`verified` | оба вернулись, добавился обязательный `rawValueText` |
| `sourceExcerpt: string` | `string \| null`; `verified: true` требует непустой выдержки |
| `Station.locationSourceDocumentId: string` | `string \| null`, обязателен ровно при наличии `location` |
| `TypedReplayStep` (наш юнион) | `ReplayStep` — совпал дословно, включая офсеты |

## Замороженные решения (менять — только правкой пакета)

- id элемента ленты **равен** id расследования;
- неизвестная страница — `null`, **не `0`**;
- неизвестная геометрия и координаты — `null`; `{lat: 0, lon: 0}` схема отвергает явно;
- `region`: `atyrau | mangystau`; evidence level: `L0 | L1 | L2 | L3`;
- фронт показывает `conclusion` и evidence statements **дословно**;
- фронт **не пересчитывает** `delta`, коридор и L0–L3 — и не «чинит» уровень,
  если он ниже, чем нам хотелось бы для демо;
- `payload` шага реплея — discriminated union по `type`; шаги упорядочены по `offsetMs`;
- неполная дата не превращается в выдуманный день: месяц едет отдельным полем
  (`sampledPeriod` у измерений, `observedPeriod` у сигналов), и хотя бы одно
  из двух полей обязано быть заполнено;
- statement вида `supports`/`contradicts`/`limits` обязан ссылаться хотя бы
  на один документ; `unknown` может не ссылаться ни на что;
- `CandidateObject.evidenceDocumentIds` — минимум один документ-основание;
- любой ответ проверяется схемой на границе, `as T` запрещён.

## Null-правила (что означает пустое значение)

| Поле | `null` означает |
|---|---|
| `sourcePage` | страница не подтверждена — якорь `#page=` не ставим, страницу не подписываем |
| `sampledAt` / `observedAt` | точной даты нет; смотреть `sampledPeriod` / `observedPeriod` |
| `sampledPeriod` / `observedPeriod` | период не определён |
| `location`, `corridor` | координаты не подтверждены — рисуем линейную схему |
| `locationSourceDocumentId` | координат нет, значит и документа местоположения быть не должно |
| `corridorBounds.upstreamStationId` | коридор открыт вверх по течению |
| `corridorBounds` целиком | участок не выделен |
| `publishedAt`, `fetchedAt` | дата публикации / скачивания неизвестна |
| `sha256` | хэш не вычислен — в досье пишем «не вычислен», не прячем |
| `qualityClass` | класс качества в источнике не приведён |
| `sourceExcerpt` | дословной выдержки нет; тогда и `verified` обязан быть `false` |
| `Dossier.rulesetVersion` / `inputHash` | расчётное ядро не передало — досье пишет «не передана» |
| `lastSuccessAt` | источник ни разу не обновлялся успешно |
| `IncidentSummary.period` | период события не определён (кейс Актау) |

## Состояния источников (для этапа F6)

`SourceHealthItem.status`: `never_run | healthy | degraded | rate_limited | failed`,
плюс `cacheAvailable: boolean` и `lastSuccessAt`. В фикстуре все источники —
`never_run` с `cacheAvailable: false`: бэк ещё не ходил в сеть и не заявляет кэш,
пока Storage не реализован.

## Ошибки

```ts
{ code: string, message: string, requestId: string }   // ApiErrorSchema
```

Коды бэка, которые уже существуют: `ROUTE_NOT_FOUND`, `VALIDATION_ERROR`,
`MALFORMED_JSON`, `PAYLOAD_TOO_LARGE`. Коды, которые порождает сам фронт
(`src/api/client.ts`): `NETWORK_UNAVAILABLE`, `TIMEOUT`, `INVALID_RESPONSE`,
плюс `HTTP_<status>` для ответа без разбираемого тела.

Сбой внешнего источника — это **`200` с `degraded`/`failed`** в `/api/live/status`,
а не `500`: «источник недоступен» ≠ «событий нет». Отменённый запрос
(`AbortSignal`) не показывается как ошибка — наверх уходит исходный `AbortError`.
Retry для 4xx не делаем.

## Режимы данных

```env
VITE_API_BASE_URL=/api
VITE_DATA_MODE=seed   # по умолчанию; 'api' — после контрольной точки C
```

```ts
export async function fetchIncidents(params = {}, signal?: AbortSignal) {
  if (IS_SEED_MODE) {
    warnStubOnce("GET /api/incidents — данные из ТЗ §5")
    return parseSeed(IncidentSummaryListSchema, filtered, "GET /api/incidents")
  }
  return apiGet("/incidents", IncidentSummaryListSchema, { params, signal })
}
```

Компонент не знает, откуда пришли данные. В dev запросы к `/api` проксируются
на `http://localhost:3000` (`vite.config.ts`); CORS у бэка открыт на
`http://localhost:5173`, так что оба пути рабочие.

Таймаут запроса — 8 с (`API_TIMEOUT_MS`), сигнал собирается через
`AbortSignal.any([callerSignal, AbortSignal.timeout(...)])`.

## Query keys

```ts
queryKeys.incidents(filters)  // staleTime: Infinity (глобальный)
queryKeys.incident(id)        // staleTime: Infinity
queryKeys.evidence(id)        // staleTime: Infinity
queryKeys.replay(id)          // staleTime: Infinity
queryKeys.liveStatus()        // staleTime: 60 000
```

## Контрольные точки синхронизации

| Точка | Час | Что должно сойтись | Состояние |
|---|---|---|---|
| A | 2 | sample JSON пяти эндпоинтов | ✅ фикстуры в `packages/contracts/fixtures` |
| B | 8 | реплей на seed; у бэка list/detail и golden-результат core | реплей ✅, бэк — нет |
| C | 12 | три read-эндпоинта на NestJS, видна сентябрьская исключённая версия | ждёт эндпоинтов; исключённая версия ждёт `riverOrder` |
| D | 30 | подключены replay/evidence/export; формы ответов замораживаются | не начата |
| freeze | 43 | только исправления, тесты и подготовка демо | не начата |
