# План фронтенда «Каспийский след»

## Состояние на конец последней сессии

**Сессия 3 (04.08.2026) — каркас трёх колонок + шкала реплея + роутер/провайдеры. Завершена.**

- `src/router.tsx` — createBrowserRouter, пока один маршрут `/` → `App`;
  `/dossier/:id` и search-параметры deep-link добавятся в своих сессиях.
- `src/main.tsx` — ThemeProvider → QueryClientProvider → RouterProvider.
  QueryClient: `staleTime: Infinity`, `retry: false`, `refetchOnWindowFocus: false`
  (офлайн-демо, данные бюллетеней во время показа не меняются).
- `src/App.tsx` — грид `header / три колонки / шкала` на `h-svh`; на `<lg`
  колонки складываются в столбец. Колонки: `SignalFeed` (features/feed),
  `RiverScheme` (features/river-scheme, заготовка узлов + подпись
  «вверху — выше по течению»), `ConclusionPanel` (features/conclusion —
  6 нумерованных блоков строго из `CONCLUSION_SECTIONS`), `ReplayTimeline`
  (features/replay — маркеры на реальных `REPLAY_STEP_OFFSETS_MS`, play отключён),
  `AppHeader` (components/layout). Наполнение — скелетоны, данные не подключались.
- Константы: `panel.ts` (CONCLUSION_SECTIONS §13 — порядок массива = контракт),
  `strings.ts` + APP_NAME/APP_TAGLINE, `replay.ts` + REPLAY_STEP_TYPE_ORDER (§14).
- shadcn добавлены: `skeleton`, `scroll-area`, `separator` (separator пока не
  используется — блоки панели разделены border-t). В сгенерированном
  `scroll-area.tsx` удалён неиспользуемый импорт React — валил `tsc -b`.
- `index.html`: `lang="ru"`, title «Каспийский след».
- Проверено: `typecheck`, `lint`, `build` — зелёные; визуально через Playwright
  на 1280×720 (свет и тьма): все 6 блоков §13 видны без прокрутки, консоль чистая.
- **Следующая задача (сессия 4): common-примитивы** — `MeasurementValue`,
  `SourceLink`, `EvidenceLevelBadge`, `InsufficientData` + `lib/format.ts`
  (ru-RU числа, даты +05:00) — они нужны до любых экранов.
- **Блокеры прежние:** вопросы 1 (порядок створов) и 2 (incident vs investigation).
  Каркас от них не зависит; контракт заглушек — провизорный.

<details>
<summary>Сессия 2 (04.08.2026) — типы + константы + api-слой с заглушками. Завершена.</summary>

- Установлены: @tanstack/react-query, zustand, react-router-dom, @types/geojson (dev).
- `src/types/` — 1:1 из ТЗ §8 + `ReplayStep` из §12 (payload = unknown), barrel `index.ts`.
- `src/constants/` — `api` (API_BASE_URL с фолбэком `/api`, MAX_INCIDENTS_LIMIT),
  `evidence` (EVIDENCE_LEVEL_META по §6), `phenomena` (PHENOMENON_LABELS,
  VERIFICATION_STATUS_META), `replay` (REPLAY_STEP_OFFSETS_MS §12, лейблы шагов),
  `strings` (LEGAL_DISCLAIMER, OBJECT_FOR_REVIEW_LABEL, INSUFFICIENT_DATA_TITLE).
- `src/api/` — `client` (apiGet/apiPost + warnStubOnce), `contracts` (**провизорные**
  формы ответов §12 — вопросы 2/3/6 открыты), `seed-data` (только данные ТЗ
  §5/§7/§10/§14, riverOrder везде null), заглушки `incidents`, `replays`,
  `investigations`, `live-status` — реестр в `docs/stubs.md`.
- `.env.example` (VITE_API_BASE_URL, необязателен), `vite-env.d.ts`;
  в eslint отключён react-refresh/only-export-components для `src/components/ui`.
- ВАЖНО: eslint запускать из `apps/web` (конфиг там), корневой `npm run lint`
  через обёртку может искать конфиг в корне.
</details>

<details>
<summary>Сессия 1 (04.08.2026) — аудит ТЗ, монорепа. Завершена.</summary>

- Созданы файлы памяти: `CLAUDE.md`, `docs/frontend-plan.md`, `docs/decisions.md`, `docs/stubs.md`.
- Монорепа по ТЗ §11 (вопрос 9 закрыт): `apps/web` + npm workspaces, команды из корня.
- `.gitignore`: `.env`/`.env.*` игнорируются, `.env.example` разрешён.
- Установлены React 19, TS strict, Tailwind 4, shadcn на Base UI (base-lyra), @fontsource Inter.
</details>

## Открытые вопросы к команде (закрыть в первые 2 часа хакатона)

1. **Порядок створов:** утверждённый сверху-вниз `riverOrder` для 7 сентябрьских и 2 майских
   точек; где в порядке «посёлок Дамба» и «1 км выше/ниже Атырау» относительно точек
   «Атырау су арнасы». ← БЛОКЕР линейной схемы
2. **Incident vs Investigation:** одна сущность или две? Какой эндпоинт отдаёт ленту слева
   и какой — полные данные правой панели? Будет ли `GET /api/investigations/:id`? ← БЛОКЕР
   фиксации контракта. Провизорный вариант зафиксирован в `src/api/contracts.ts`
   (IncidentSummary/IncidentDetail: investigation + signals + measurements + stations
   + candidateObjects + sourceDocuments) — команде подтвердить или поправить.
3. **Реплей:** `:id` в `POST /api/replays/:id/start` — чей? Пример JSON полного сентябрьского
   сценария со всеми 5 типами шагов — для типизации `payload` (дискриминированный юнион).
   Провизорный юнион — `TypedReplayStep` в `src/api/contracts.ts`.
4. **Май/сентябрь:** как в данных связаны два расследования одного участка — признак для UI
   сравнения (главный «вау»-момент демо).
5. **Экспорт:** досье печатает фронт из тех же данных, бэковский `/export` не используем — подтвердить.
6. **Коридор:** добавить в контракт пару `stationId` границ (GeoJSON для линейной схемы недостаточен;
   можно в `properties` GeoJSON-фичи). Провизорно — `corridorBounds` в `IncidentDetail`
   (`upstreamStationId: null` = интервал открыт вверх, кейс сентября).
7. **Актау:** формат кейса «недостаточно данных» — incident с `region=mangystau`? причины отказа
   в `unknowns`? кто их формирует?
8. **Страницы PDF:** подтвердить `source_pages` майских значений; проверить, открываются ли URL
   Казгидромета с якорем `#page=N` без принудительного скачивания. В заглушке майская
   `sourcePage = 0` (сентинел «не подтверждено») — заменить после проверки.
9. ~~**Монорепа:** переезд в `apps/web` сейчас или отказ.~~ РЕШЕНО 04.08: переезд выполнен,
   структура по ТЗ §11; бэкендерам — `git pull` до первого файла, их зона `apps/api` и `packages/*`.
10. **Цвет значений:** формула «относительного положения» (моё предложение: монохромная
    min–max нормировка внутри события).
11. **packages/shared:** когда появится, кто владелец.
12. **Dev-окружение:** порт/URL API (CORS или Vite proxy)? Язык UI — только русский?
13. **Секреты бэка:** репо публичный — ключи Gemini/Groq только в `apps/api/.env`
    (в git только `.env.example`); проверить коммиты до пуша. Демо-режим `verified_seed`
    по ТЗ работает без ключей.

## Задачи по блокам

### Сессия 1 — аудит ТЗ, план, файлы памяти
- [x] Завершена 04.08.2026.

### Блок 2–24 ч (фронт работает параллельно бэку, ничего не ждёт)
- [x] **Типы + константы + api-слой с заглушками** — сессия 2, 04.08.2026
  - [x] deps: @tanstack/react-query, zustand, react-router-dom (+ @types/geojson);
  - [x] `src/types/` буквально по ТЗ §8;
  - [x] `src/constants/` (api, evidence, phenomena, replay, strings — юр. оговорка);
  - [x] `src/api/` с заглушками (только реальные данные ТЗ §5 + кейс Актау);
  - [x] `.env.example` с `VITE_API_BASE_URL`; чтение с фолбэком — сборка работает без `.env`.
- [x] Каркас трёх колонок + шкала снизу (порядок блоков панели строго по ТЗ §13) — сессия 3, 04.08.2026
- [ ] Common-примитивы: `MeasurementValue`, `SourceLink`, `EvidenceLevelBadge`, `InsufficientData` + `lib/format.ts`. ← СЛЕДУЮЩАЯ (сессия 4)
- [ ] Линейная схема реки v1 на сентябрьских данных, числа кликабельны.
- **Контрольная точка 12 ч:** сентябрьский кейс виден на схеме, каждое число открывает источник.

### Блок 24–36 ч
- [ ] Правая панель: 6 блоков по ТЗ §13 (Вывод → Уровень → Установлено → Не подтверждается → Неизвестно → Источники).
- [ ] Состояния L0–L3 через `EVIDENCE_LEVEL_META` (цвета из ТЗ §6: серый/синий/янтарный/зелёный).
- [ ] Лента слева: сигналы + расследования.
- [ ] Экран Актау «недостаточно данных» — полноценный, часть демо.

### Блок 36–45 ч
- [ ] Реплей: шкала, play/пауза, перемотка по шагам, клавиатура (Space, ←/→).
- [ ] Переключение май/сентябрь с ЯВНОЙ визуальной сменой вывода (если выглядит как смена фильтра — провал).
- [ ] Печатное досье: маршрут `/dossier/:id`, `@media print`; print preview проверить сразу.
- [ ] Подключение реальных эндпоинтов по мере готовности бэка; вычёркивание строк из `docs/stubs.md`.

### Блок 45–52 ч
- [ ] Данные Мангистау.
- [ ] Проверка на 1280×720 (проектор): контраст, размер шрифта, три колонки.
- [ ] Интеграционный прогон с бэком.
- [ ] Мобильная вёрстка — остаточный принцип.

### Блок 52–60 ч
- [ ] Полировка. Полный прогон демо офлайн и без бэка. Резервное видео. Новых фич нет.

## Порядок выбрасывания при отставании
MapLibre-карта → слой волн Актау → мобильная адаптация → строка live/status → анимации.
**НЕ выбрасывать:** реплей, досье, экран Актау, кликабельные числа, смена вывода май/сентябрь.

## Целевая структура src/

```
src/
  api/            — слой запросов; ЕДИНСТВЕННОЕ место заглушек (client, incidents, investigations, replays, liveStatus)
  types/          — типы 1:1 из ТЗ §8
  constants/      — api, evidence (EVIDENCE_LEVEL_META), phenomena, replay, strings (юр. оговорка)
  lib/format.ts   — числа ru-RU, даты +05:00, мг/дм³
  stores/replayStore.ts — Zustand: шаги, индекс, play/pause/seek
  components/ui/  — shadcn (Base UI)
  components/common/ — MeasurementValue, SourceLink, EvidenceLevelBadge, InsufficientData
  features/
    feed/         — SignalFeed, SignalCard
    river-scheme/ — RiverScheme (SVG), StationNode, CorridorBand, UnorderedStations (riverOrder=null)
    conclusion/   — ConclusionPanel + FactsList, RejectedList, UnknownsList, SourcesList
    replay/       — ReplayTimeline, ReplayControls, useReplayPlayback (таймеры от performance.now())
    comparison/   — переключатель май/сентябрь
    dossier/      — печатный маршрут
    aktau/        — экран «недостаточно данных»
  App.tsx, main.tsx, router.tsx
```

## Подводные камни (сверх раздела 8 промпта; полный аудит — сессия 1)
- Таймеры реплея: от `performance.now()` с хранимым offset; пауза/seek сбрасывают таймеры;
  цепочка `setTimeout` дрейфует.
- TanStack Query и реплей не смешивать: панели читают состояние текущего шага из селектора
  replayStore поверх загруженных данных, без рефетча на шаг.
- PDF-якоря `#page=N` зависят от заголовков сервера Казгидромета — проверить реальные URL;
  фолбэк: попап с `sourceExcerpt` + номер страницы текстом.
- Длинные подписи створов («0,5 км ниже сброса ГКП "Атырау су арнасы"») — сокращение + тултип;
  тултипы Base UI над SVG проверить в первый день схемы.
- Deep-link: выбранное расследование и месяц в URL (защита: открыть экран закладкой, пережить F5).
- Печать проверять в блоке 36–45, не в последний час.
- Всё офлайн: никаких CDN (шрифт уже локален; тайлы карт — аргумент против MapLibre).
- React 19 / Vite 8 / TS 6 / ESLint 10 — примеры из интернета устарели в обе стороны,
  сверяться с установленными версиями.
