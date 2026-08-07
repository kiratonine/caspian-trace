# «Каспийский след»: план frontend-разработчика

> Роль: Frontend  
> Ветка: `feat/frontend-mvp`  
> Основная зона: `apps/web/**`  
> Стек: React + TypeScript + Vite + shadcn/ui Base UI + TanStack Query + Zustand  
> Полный технический roadmap: `caspian-trace-development-roadmap.md`

---

## 1. Результат роли

К концу работы frontend-разработчик должен передать полностью готовый интерфейс, который:

- работает на существующих проверенных seed-данных без backend;
- переключается на NestJS одним `VITE_DATA_MODE=api`;
- не вычисляет доказательный вывод в браузере;
- воспроизводит сентябрьский кейс по шагам;
- показывает майское сравнение;
- показывает Актау как нормальное состояние «недостаточно данных»;
- открывает каждое измерение в первоисточнике;
- формирует удобный экран публичного досье;
- выдерживает трёхминутное демо на разрешении 1280×720;
- имеет аварийный seed-режим на случай отказа сети/backend.

---

## 2. Зона владения файлами

Frontend-разработчик единолично редактирует:

```text
apps/web/**
docs/frontend-plan.md
docs/stubs.md                # только статусы frontend-заглушек
```

Frontend-разработчик не редактирует в своей feature-ветке:

```text
apps/api/**
apps/api/prisma/**
packages/investigation-core/**
packages/contracts/**
data/verified/**
package-lock.json            # владелец — Backend 1
```

Если нужна новая frontend-зависимость, сначала написать Backend 1 точное имя пакета. Backend 1 добавляет её в общий dependency/bootstrap commit и обновляет lockfile. Это предотвращает самый частый конфликт npm-монорепозитория.

---

## 3. Что уже готово

В текущем `apps/web` уже есть:

- трёхколоночный layout;
- лента событий и сигналов;
- линейная схема Жайыка;
- панель доказательств;
- реальные seed-данные мая и сентября 2025 года;
- кликабельные измерения;
- экран Актау «недостаточно данных»;
- React Router, TanStack Query и Zustand;
- dev-галереи компонентов;
- пять API-заглушек.

Начинать проект заново нельзя. Нужно продолжить существующий frontend.

---

## 4. Контракт независимости от backend

Frontend работает через функции `src/api/*`, а не вызывает `fetch` внутри компонентов.

Обязательные endpoints:

| Функция frontend | Endpoint | Владелец backend |
|---|---|---|
| `fetchIncidents` | `GET /api/incidents` | Backend 1 |
| `fetchIncidentDetail` | `GET /api/incidents/:id` | Backend 1 |
| `fetchLiveStatus` | `GET /api/live/status` | Backend 1 |
| `startReplay` | `POST /api/replays/:id/start` | Backend 2 |
| `fetchInvestigationEvidence` | `GET /api/investigations/:id/evidence` | Backend 2 |
| `fetchDossierJson` | `GET /api/investigations/:id/export?format=json` | Backend 2 |

Пока endpoints не готовы, эти функции возвращают существующие данные `src/api/seed-data.ts`.

### Правило переключения

```ts
if (import.meta.env.VITE_DATA_MODE === 'seed') {
  return seedResult;
}

return apiGet(...);
```

Компонент не должен знать, пришли данные из seed или API.

### Замороженные решения

- id элемента ленты в MVP равен id текущего расследования;
- неизвестная страница — `null`, не `0`;
- неизвестная геометрия — `null`;
- `region` в API: `atyrau | mangystau`;
- evidence level: `L0 | L1 | L2 | L3`;
- frontend дословно показывает `conclusion` и evidence statements с backend;
- frontend не пересчитывает `delta`, corridor или L0–L3.

Изменение этих решений после второго часа требует согласия всех троих.

---

## 5. Синхронизация с командой

### Контрольная точка A — 2-й час

Backend 1 публикует sample JSON пяти обязательных endpoints. Frontend проверяет, что текущие компоненты могут его отобразить.

### Контрольная точка B — 8-й час

Frontend показывает replay полностью на seed. Backend 1 показывает list/detail API. Backend 2 показывает golden-результат investigation-core.

### Контрольная точка C — 12-й час

Frontend переключает три read endpoint на NestJS и показывает сентябрьскую исключённую версию.

### Контрольная точка D — 30-й час

Подключены replay/evidence/export endpoints. После этого формы ответов не меняются.

### Feature freeze — 43-й час

После этого только исправления, тесты и подготовка демо.

---

## 6. Этап F0 — подготовка ветки, 0:00–1:00

Сделать:

1. Обновить локальный `main`.
2. Создать `feat/frontend-mvp`.
3. Прочитать:
   - `docs/spec.md`;
   - `docs/frontend-plan.md`;
   - `docs/decisions.md`;
   - `docs/stubs.md`.
4. Запустить `typecheck`, `lint`, `build`.
5. Открыть сентябрь, май и Актау через текущие seed.
6. Не изменять готовые доказательные формулировки.

Критерий приёмки:

- исходный frontend собирается;
- понятно, какие пять заглушек ещё активны;
- ветка не содержит случайных изменений package-lock.

---

## 7. Этап F1 — реплей, 1:00–7:00

### Новые файлы

```text
apps/web/src/stores/replay-store.ts
apps/web/src/hooks/use-replay-playback.ts
apps/web/src/features/replay/replay-projection.ts
apps/web/src/features/replay/ReplayControls.tsx
```

### Store

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
  tick(nowMs: number): void;
};
```

### Playback

- время считать через `performance.now()`;
- не строить цепочку `setTimeout`;
- при pause сохранять `elapsedMs`;
- seek назад должен скрывать поздние факты;
- смена события вызывает `reset()`;
- размонтирование отменяет animation frame;
- при `prefers-reduced-motion` отключить декоративные анимации.

### Projection

```ts
selectReplayProjection(
  scenario: ReplayScenario,
  elapsedMs: number,
): ReplayProjection
```

Projection содержит:

- видимые сигналы;
- видимые измерения;
- текущий evidence level;
- активное объяснение;
- видимый conclusion;
- номер текущего шага.

Все три колонки получают одну projection. Запросов к API при переходе между шагами нет.

### Управление

- Space — play/pause;
- ArrowLeft/ArrowRight — предыдущий/следующий шаг;
- click/drag шкалы — seek;
- отдельная кнопка reset;
- фокус и `aria-label` обязательны.

Критерий приёмки:

- сентябрьский сценарий проигрывается на seed;
- pause/continue не пропускает шаг;
- seek назад действительно убирает поздние измерения;
- lint/typecheck/build зелёные.

---

## 8. Этап F2 — стабилизация API-слоя, 7:00–11:00

### Изменить

```text
src/api/client.ts
src/api/contracts.ts
src/api/queries.ts
src/api/incidents.ts
src/api/investigations.ts
src/api/replays.ts
src/api/live-status.ts
```

### Новый API client

```ts
apiGet<T>(path, schema, params?, signal?): Promise<T>
apiPost<T>(path, schema, body?, signal?): Promise<T>
```

Добавить:

- `Accept: application/json`;
- `AbortSignal`;
- timeout;
- Zod-валидацию после подключения `packages/contracts`;
- нормализованную ошибку `{ code, message, requestId }`;
- отсутствие автоматического retry для 4xx;
- retry не должен мешать трёхминутному replay.

### Query keys

```ts
incidents(filters)
incident(id)
evidence(id)
replay(id)
liveStatus()
```

Расследования и replay: `staleTime: Infinity`. Live status: 60 секунд.

### До готовности shared contracts

Использовать текущие frontend-типы и sample JSON. Не создавать второй общий package. После merge `packages/contracts` заменить imports одним отдельным commit.

Критерий приёмки:

- seed/API переключаются без изменения компонентов;
- server error не превращается в пустой список;
- отменённый запрос не показывает красную ошибку;
- неизвестное поле backend обнаруживается runtime schema.

---

## 9. Этап F3 — первая интеграция read API, 11:00–14:00

Ожидаемый handoff Backend 1:

```text
GET /api/health/ready
GET /api/incidents
GET /api/incidents/:id
GET /api/live/status
```

Сделать:

1. Установить `VITE_DATA_MODE=api`.
2. Проверить Vite proxy `/api -> localhost:3000`.
3. Сравнить API response с seed fixture.
4. Проверить сентябрьские значения `0,234`, `0,058`, `0,054`, `0,167`.
5. Проверить май `0,114`, `0,193`.
6. Проверить Актау без станций.
7. Не исправлять расхождение хардкодом в компоненте — вернуть Backend 1 точный diff контракта.

Критерий приёмки:

- главный экран работает через NestJS;
- выбор события сохраняется в `?incident=`;
- seed-режим всё ещё работает;
- все три колонки показывают одно событие.

---

## 10. Этап F4 — публичное досье, 14:00–21:00

### Новые файлы

```text
src/features/dossier/DossierPage.tsx
src/features/dossier/DossierHeader.tsx
src/features/dossier/DossierMeasurements.tsx
src/features/dossier/DossierEvidence.tsx
src/features/dossier/DossierSources.tsx
src/features/dossier/dossier-print.css
src/api/export.ts
```

### Route

```text
/dossier/:id
```

### Данные

До готовности Backend 2 строить экран из уже загруженного `IncidentDetail` и `EvidenceGraph`. После готовности export endpoint добавить «Скачать JSON».

### Обязательные секции

1. Заголовок и дата.
2. Disclaimer.
3. Conclusion.
4. L0–L3 с расшифровкой.
5. Сигналы.
6. Измерения.
7. Подтверждённые факты.
8. Исключённые версии.
9. Неизвестные данные.
10. Объекты для проверки.
11. Источники, страницы, SHA-256.
12. Ruleset version и input hash.

### Печать

- `window.print()`;
- скрыть навигацию и кнопки;
- не разрывать одно evidence statement между страницами;
- URL источников должны оставаться видимыми/кликабельными;
- проверка A4 через browser print preview.

Критерий приёмки:

- досье открывается по deep link;
- все значения имеют source link;
- print preview не обрезает conclusion и таблицу;
- JSON скачивается после подключения endpoint.

---

## 11. Этап F5 — evidence/replay/export API, 21:00–27:00

Ожидаемый handoff Backend 2:

```text
POST /api/replays/:id/start
GET /api/investigations/:id/evidence
GET /api/investigations/:id/export?format=json
GET /api/investigations/:id/export?format=html
```

Подключать endpoints по одному:

1. `evidence` — сравнить количество statements/source ids с seed.
2. `replay` — проверить discriminated union каждого payload.
3. `export JSON` — скачать blob с корректным именем.
4. `export HTML` — открыть в новой вкладке.

После подключения каждого endpoint обновить `docs/stubs.md`.

Критерий приёмки:

- активных обязательных заглушек не осталось в API-режиме;
- seed fallback сохранён;
- backend не возвращает данные, которые frontend вынужден вычислять.

---

## 12. Этап F6 — состояния источников и отказов, 27:00–32:00

Добавить в header или компактный popover:

- healthy;
- degraded;
- rate limited;
- failed;
- cache available;
- last success time.

Формулировки:

- правильно: «GDELT ограничил запросы; используется кэш»;
- неправильно: «Новых событий нет», если запрос завершился 429;
- правильно: «Данные течений недоступны»;
- неправильно: «Течений нет».

Проверить:

- backend 500;
- backend недоступен;
- пустой incidents;
- malformed response;
- source degraded при работающем API;
- cached source link.

---

## 13. Этап F7 — UX и доступность, 32:00–38:00

Проверить:

- 1280×720 — основной размер демо;
- 1440×900;
- узкий экран как fallback;
- светлая/тёмная тема;
- клавиатура;
- видимый focus;
- contrast;
- scroll каждой колонки;
- отсутствие layout shift при replay;
- длинные русские заголовки;
- числа через `Intl.NumberFormat('ru-RU')`;
- `Asia/Atyrau` для точных дат;
- неполный месяц не превращается в точную дату.

Не подключать MapLibre без подтверждённых координат. Линейная схема остаётся основной визуализацией.

---

## 14. Этап F8 — frontend-тесты, 38:00–43:00

### Unit/component

- replay reducer/store;
- projection на каждом шаге;
- formatting `0,234`;
- `sourceHref` с `#page=22`;
- `sourcePage=null` без якоря;
- L0–L3 metadata;
- insufficient-data state.

### E2E

1. Открыть сентябрь.
2. Запустить replay.
3. Pause/seek.
4. Проверить четыре значения.
5. Открыть PDF page 22.
6. Переключить май.
7. Проверить `+0,079` в серверном conclusion/evidence, не вычисляя его в UI.
8. Открыть Актау.
9. Открыть dossier.
10. Скачать JSON.

Пока backend нестабилен, E2E использует network fixtures. После контрольной точки D прогнать тот же тест против реального API.

---

## 15. Этап F9 — feature freeze и демо, 43:00–55:00

После 43-го часа:

- не добавлять новую карту;
- не менять дизайн-систему;
- не менять API shapes;
- не переписывать layout;
- не добавлять новый state manager.

Сделать:

- production build;
- очистить console errors;
- проверить отсутствие забытых `STUB:` в API-режиме;
- настроить demo query parameter на сентябрь;
- подготовить кнопки replay/dossier;
- провести минимум пять трёхминутных прогонов;
- записать резервное видео;
- проверить seed fallback без backend.

---

## 16. План commits

Рекомендуемые commits:

```text
feat(web): implement deterministic replay playback
refactor(web): make API and seed modes interchangeable
feat(web): add printable investigation dossier
feat(web): connect incidents and live status API
feat(web): connect evidence replay and export API
test(web): cover three-minute demo flow
fix(web): stabilize projector layout and failure states
```

Не объединять весь frontend в один финальный commit.

---

## 17. Handoff для интегратора

Перед merge передать:

- branch/commit SHA;
- список подключённых endpoints;
- список оставшихся seed fallbacks;
- точную команду запуска;
- production build result;
- E2E result;
- известные UI-проблемы;
- ссылку/путь на резервное видео.

Frontend-ветка не должна содержать изменений Prisma schema, NestJS modules и investigation-core.

---

## 18. Definition of Done frontend

- [ ] Все изменения находятся в разрешённой зоне файлов.
- [ ] Replay работает с pause/seek/reset.
- [ ] Все колонки синхронизированы одной projection.
- [ ] API и seed режимы переключаются env-переменной.
- [ ] Все обязательные endpoints подключены.
- [ ] Нет вычисления delta/L0–L3/corridor во frontend.
- [ ] Сентябрь, май и Актау отображаются корректно.
- [ ] Досье открывается и печатается.
- [ ] Каждое число ведёт к источнику.
- [ ] Ошибки источника отличаются от отсутствия событий.
- [ ] Typecheck, lint и build зелёные.
- [ ] Критический E2E зелёный.
- [ ] 1280×720 проверено.
- [ ] Seed fallback проверен без backend.
- [ ] Трёхминутное демо отрепетировано.

---

## 19. Общий порядок объединения веток

1. Backend 1 первым вливает короткий bootstrap commit в `main`.
2. Все трое обновляют/перебазируют свои feature-ветки.
3. Перед финальным `main` создать `integration/mvp`.
4. Сначала влить `feat/backend-platform`.
5. Затем `feat/backend-investigation`; конфликты в его feature-папках решает Backend 2, в Prisma/contracts/AppModule — Backend 1.
6. Затем влить `feat/frontend-mvp`; конфликты в `apps/web` решает frontend-разработчик.
7. Backend 1 обновляет один `package-lock.json`, запускает Prisma generate/migrations.
8. Все трое запускают свои tests на одном integration commit.
9. Только после полного трёхминутного прогона объединить `integration/mvp` с `main`.

Никто не разрешает конфликт удалением чужой версии файла целиком.
