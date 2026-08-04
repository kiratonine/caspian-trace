# Контракт фронт ↔ бэк одной страницей

Обновлено: 04.08.2026 по `caspian-trace-development-roadmap.md` §7, §9, §19
и `caspian-trace-role-frontend.md` §4. Формы ответов — в `apps/web/src/api/contracts.ts`.

## Эндпоинты и владельцы

| Функция фронта | Эндпоинт | Владелец | Статус |
|---|---|---|---|
| `fetchIncidents` | `GET /api/incidents` | Full-stack 1 | заглушка |
| `fetchIncidentDetail` | `GET /api/incidents/:id` | Full-stack 1 | заглушка |
| `fetchLiveStatus` | `GET /api/live/status` | Full-stack 1 | заглушка |
| `startReplay` | `POST /api/replays/:id/start` | Full-stack 2 | заглушка |
| `fetchInvestigationEvidence` | `GET /api/investigations/:id/evidence` | Full-stack 2 | заглушка |
| `fetchDossierJson` | `GET /api/investigations/:id/export?format=json` | Full-stack 2 | заглушка (`src/api/export.ts`); эндпоинт ещё не заведён |

Служебные, которые может понадобиться знать фронту:
`GET /api/health/ready` (готовность API),
`GET /api/source-documents/:id/open?page=22` (документ из кэша Storage, когда
оригинальный URL недоступен),
`GET /api/investigations/:id/export?format=html` (серверный печатный HTML —
наш маршрут `/dossier/:id` от него не зависит).

## Замороженные решения (менять — только согласием всех троих)

- id элемента ленты **равен** id расследования;
- неизвестная страница — `null`, **не `0`**;
- неизвестная геометрия и координаты — `null`, не `[0, 0]`;
- `region`: `atyrau | mangystau`;
- evidence level: `L0 | L1 | L2 | L3`;
- фронт показывает `conclusion` и evidence statements **дословно**;
- фронт **не пересчитывает** `delta`, коридор и L0–L3;
- `payload` шага реплея — discriminated union по `type`;
- неполная дата не превращается в выдуманный день: месяц едет отдельным полем
  (`sampledPeriod` у измерений, `observedPeriod` у сигналов);
- закрытые списки значений: `verificationStatus` (`unverified | corroborated |
  official | conflicting`), `extractionMode` (`verified_seed | rule |
  llm_verified`) — у них check-ограничение в SQL и `z.enum` в контракте;
- свободные строки: `unit`, `matrix`, `phenomenon` — фронт переводит известные
  значения справочником и показывает незнакомое как есть;
- любой ответ проверяется Zod на границе сети, `as T` запрещён.

## Null-правила (что означает пустое значение)

| Поле | `null` означает |
|---|---|
| `sourcePage` | страница не подтверждена — якорь `#page=` не ставим, страницу не подписываем |
| `sampledAt` | точной даты отбора нет; смотреть `sampledPeriod` |
| `sampledPeriod` | период не определён |
| `observedAt` | точной даты наблюдения нет; смотреть `observedPeriod` |
| `observedPeriod` | период наблюдения не определён |
| `location`, `corridor` | координаты не подтверждены — рисуем линейную схему |
| `corridorBounds.upstreamStationId` | коридор открыт вверх по течению |
| `corridorBounds` целиком | участок не выделен |
| `publishedAt` | дата публикации источника неизвестна |
| `sha256: ''` | хэш ещё не вычислен бэком — в досье пишем «не вычислен», не прячем |
| `provenance` | бэк не прислал `rulesetVersion`/`inputHash` — досье пишет «не передана расчётным ядром» |
| `lastSuccessAt` | источник ни разу не обновлялся успешно |

## Что просим у бэка сверх утверждённого §9.2

- `IncidentSummary.period` (вопрос 4) — период события ISO до месяца, иначе
  сравнение май/сентябрь остаётся без данных в API-режиме;
- `IncidentDetail.provenance: { rulesetVersion, inputHash } | null` (вопрос 14) —
  пункт 12 досье (роадмап §21.1); поля есть в таблице `investigations` и в
  `InvestigationResult`, но не в перечне полей ответа §9.2;
- форма `DossierModel` для `?format=json` (вопрос 5) — провизорно
  `DossierExport = { generatedAt, disclaimer, incident }`.

## Ошибки

```ts
{ code: string, message: string, requestId: string }
```

`404 { code: 'INVESTIGATION_NOT_FOUND' }` — события нет.
Сбой внешнего источника — это **`200` с `degraded`/`failed`** в `/api/live/status`,
а не `500`: «источник недоступен» ≠ «событий нет». Отменённый запрос
(`AbortSignal`) не показывается как ошибка. Retry для 4xx не делаем.

## Режимы данных

```env
VITE_API_BASE_URL=/api
VITE_DATA_MODE=api    # обычный режим; seed — аварийное офлайн-демо
```

```ts
export async function fetchIncidents(params?: IncidentListParams) {
  if (import.meta.env.VITE_DATA_MODE === "seed") {
    warnStubOnce("GET /api/incidents")
    return incidentSummaries
  }
  return apiGet("/incidents", IncidentSummaryArraySchema, params)
}
```

Компонент не должен знать, откуда пришли данные. Vite proxy: `/api → http://localhost:3000`.

## Query keys

```ts
incidents(filters)      // staleTime: Infinity
incident(id)            // staleTime: Infinity
evidence(id)            // staleTime: Infinity
replay(id)              // staleTime: Infinity
liveStatus()            // staleTime: 60 000
```

## Контрольные точки синхронизации

| Точка | Час | Что должно сойтись |
|---|---|---|
| A | 2 | Full-stack 1 публикует sample JSON пяти эндпоинтов; проверяю, что компоненты его отрисуют |
| B | 8 | Реплей полностью на seed; у бэка — list/detail API и golden-результат core |
| C | 12 | Три read-эндпоинта переключены на NestJS, видна сентябрьская исключённая версия |
| D | 30 | Подключены replay/evidence/export; после этого формы ответов не меняются |
| freeze | 43 | Только исправления, тесты и подготовка демо |
