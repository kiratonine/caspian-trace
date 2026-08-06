# Снижение информационного шума — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** убрать со всех экранов демо повторы одних и тех же фактов, чтобы жюри
читало каждый факт ровно один раз.

**Architecture:** правки только презентационные плюс два чистых вычисления
в моделях (`scheme-model.ts` — общая единица события, `dossier-model.ts` —
константные колонки таблицы). Ни один запрос, ни один тип контракта и ни одно
значение данных не меняются. Спека — `docs/superpowers/specs/2026-08-06-visual-noise-reduction-design.md`.

**Tech Stack:** React 19, TypeScript strict, Tailwind 4, shadcn/ui на Base UI,
Vite 8. Проверка — `typecheck` / `lint` / `prettier` / `build` + Playwright.

## Global Constraints

- **Тестовой инфраструктуры в `apps/web` нет** (открытый вопрос 15, ставит
  Full-stack 1). Заводить её этим планом нельзя: новые зависимости и
  `package-lock.json` — зона Full-stack 1 (CLAUDE.md). Поэтому цикл проверки
  каждой задачи — `typecheck` + `lint` + `prettier --check` + Playwright-замер,
  а не unit-тест. Замеры ниже сформулированы как falsifiable-проверки
  с ожидаемым числом.
- **Зона правок — только `apps/web/**` и `docs/**`.** Не трогать `apps/api/**`,
  `packages/**`, `data/verified/**`, `package-lock.json`.
- **Ни одно число, страница, SHA-256 и ссылка на источник не удаляются** —
  критерий приёмки ТЗ §16 п. 5 (любое число открывает документ и страницу)
  должен выполняться после каждой задачи.
- **Состав и нумерация шести блоков `CONCLUSION_SECTIONS` не меняются** —
  порядок массива это контракт ТЗ §13 (решение сессии 3).
- **Тексты, приходящие с бэка, не сокращаются** (`investigation.conclusion`,
  тексты утверждений, `unknowns`) — запрет 3 CLAUDE.md.
- **Уровень на кнопке периода остаётся** — осознанное исключение из принципа
  «один факт — одно место» (решение сессии 10).
- Все команды — из корня репозитория. `lint` запускать из `apps/web`
  (конфиг там; корневая обёртка ищет конфиг в корне).
- Рабочая ветка — `frontend`.

### Замер повторов (используется во многих задачах)

Дев-сервер: `npm run dev` → `http://localhost:5173`.
В консоли браузера (или через Playwright `browser_evaluate`) на нужном экране:

```js
const count = (needle) => document.body.innerText.split(needle).length - 1
```

Идентификаторы событий для deep-link:
`inv-atyrau-2025-09` (сентябрь, L2), `inv-atyrau-2025-05` (май, L3),
`inv-aktau-insufficient` (Актау, L0).

---

### Task 1: Тише хром — заголовки колонок и капс-подзаголовки

Пять заголовков набраны `uppercase` + `tracking-widest` и после вывода звучат
громче всего на экране, хотя несут навигацию, а не содержание.

**Files:**
- Modify: `apps/web/src/features/feed/SignalFeed.tsx:42`, `:166`
- Modify: `apps/web/src/features/river-scheme/RiverScheme.tsx:147`
- Modify: `apps/web/src/features/conclusion/ConclusionPanel.tsx:63`
- Modify: `apps/web/src/components/common/InsufficientData.tsx:41`
- Modify: `apps/web/src/features/river-scheme/CorridorBand.tsx:33-38`

**Interfaces:**
- Consumes: ничего от предыдущих задач.
- Produces: ничего; правки чисто в классах Tailwind.

- [ ] **Step 1: Понизить три заголовка колонок и подзаголовок «Сигналы»**

Во всех четырёх местах строка классов
`"text-xs font-medium tracking-widest text-muted-foreground uppercase"`
заменяется на `"text-xs font-medium text-muted-foreground"`.

`apps/web/src/features/feed/SignalFeed.tsx` — заголовок колонки:

```tsx
      <header className="border-b px-4 py-3">
        <h2 className="text-xs font-medium text-muted-foreground">
          Сигналы и расследования
        </h2>
      </header>
```

Там же, подзаголовок блока сигналов:

```tsx
      <h3 className="text-xs font-medium text-muted-foreground">
        {FEED_SIGNALS_HEADING}
      </h3>
```

`apps/web/src/features/river-scheme/RiverScheme.tsx`:

```tsx
      <h2 className="text-xs font-medium text-muted-foreground">
        Линейная схема реки
      </h2>
```

`apps/web/src/features/conclusion/ConclusionPanel.tsx`:

```tsx
        <h2 className="text-xs font-medium text-muted-foreground">
          Вывод и доказательства
        </h2>
```

- [ ] **Step 2: Понизить заголовок «Чего не хватает»**

`apps/web/src/components/common/InsufficientData.tsx`:

```tsx
          <h4 className="text-xs font-medium text-muted-foreground">
            {INSUFFICIENT_DATA_REASONS_LABEL}
          </h4>
```

- [ ] **Step 3: Понизить подпись коридора**

`apps/web/src/features/river-scheme/CorridorBand.tsx`. Вместе с `uppercase`
уходит и обёртка `normal-case`: она была нужна только чтобы отменить капс
у части строки.

```tsx
      <p className="flex items-center justify-end gap-1 px-3 pb-1 text-[10px] font-medium text-muted-foreground">
        {openUp && <ArrowUp aria-hidden className="size-3 shrink-0" />}
        {SCHEME_CORRIDOR_LABEL}
        {openUp && <span>· {SCHEME_CORRIDOR_OPEN_UP_NOTE}</span>}
      </p>
```

- [ ] **Step 4: Проверить сборку**

```bash
npm run typecheck && npm run format && npm run build
cd apps/web && npx eslint . && cd ../..
```

Ожидается: все зелёные, ошибок нет.

- [ ] **Step 5: Проверить, что капса на экране не осталось**

Открыть `http://localhost:5173/?incident=inv-atyrau-2025-09`, выполнить:

```js
document.body.innerText.split("\n").filter((line) => {
  const letters = line.replace(/[^А-ЯЁA-Zа-яёa-z]/g, "")
  return letters.length > 3 && letters === letters.toUpperCase()
})
```

Ожидается: массив содержит только `"CASPIAN TRACE"` (логотип — единственный
намеренный капс) и коды уровней вида `"L2"` внутри более длинных строк
не попадают под фильтр. Ни одного заголовка колонки в списке быть не должно.

- [ ] **Step 6: Коммит**

```bash
git add apps/web/src
git commit -m "refactor(ui): понизить капс-заголовки колонок и подписи коридора"
```

---

### Task 2: Карточка ленты — убрать метастроку

Строка «нефтепродукты · Атырауская область» дублирует заголовок карточки,
который приходит с бэка («Жайык, Атырау: нефтепродукты, сентябрь 2025»).
Заголовок мы не переписываем — он данные; удаляется наша строка.

**Files:**
- Modify: `apps/web/src/features/feed/SignalFeed.tsx:14`, `:149-151`

**Interfaces:**
- Consumes: ничего.
- Produces: ничего. `REGION_LABELS` остаётся живой константой —
  её использует `features/dossier/DossierDocument.tsx:125`.

- [ ] **Step 1: Удалить метастроку из `IncidentCard`**

Удалить целиком блок после `</div>` закрывающего `flex items-start`:

```tsx
      <p className="text-xs text-muted-foreground">
        {incident.indicator} · {REGION_LABELS[incident.region]}
      </p>
```

Тело `IncidentCard` после правки:

```tsx
    <li
      className={cn(
        "relative flex flex-col gap-1.5 border p-3 transition-colors",
        selected ? "border-foreground/40 bg-muted/40" : "hover:bg-muted/20"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Кнопка растянута на карточку псевдоэлементом: бейдж с тултипом и
            ссылки сигналов остаются настоящими интерактивными элементами,
            вложенных interactive внутри button нет. */}
        <button
          type="button"
          aria-current={selected || undefined}
          onClick={() => onSelect(incident.id)}
          className="cursor-pointer text-left text-sm font-medium text-pretty outline-none after:absolute after:inset-0 focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
        >
          {incident.title}
        </button>
        <EvidenceLevelBadge
          level={incident.evidenceLevel}
          compact
          className="relative"
        />
      </div>
      {selected && <SignalsBlock detail={detail} detailError={detailError} />}
    </li>
```

- [ ] **Step 2: Удалить осиротевший импорт**

Удалить строку `import { REGION_LABELS } from "@/constants/regions"` из
`apps/web/src/features/feed/SignalFeed.tsx`. Без этого `tsc -b`
с `noUnusedLocals` уронит сборку.

- [ ] **Step 3: Проверить сборку**

```bash
npm run typecheck && npm run format && npm run build
cd apps/web && npx eslint . && cd ../..
```

Ожидается: зелёные. Если `typecheck` ругается на неиспользуемый импорт —
шаг 2 не выполнен.

- [ ] **Step 4: Замерить исчезновение дублей**

На `http://localhost:5173/?incident=inv-atyrau-2025-09`:

```js
const count = (needle) => document.body.innerText.split(needle).length - 1
;[count("нефтепродукты"), count("Атырауская область")]
```

Ожидается: `[2, 0]` — «нефтепродукты» осталось в двух заголовках карточек
(данные с бэка, не наш текст) и уйдёт из подписи схемы в Task 3;
«Атырауская область» исчезла с экрана полностью.

- [ ] **Step 5: Проверить, что выбор события не сломан**

Кликнуть карточку «Жайык, Атырау: нефтепродукты, май 2025». Ожидается:
URL становится `?incident=inv-atyrau-2025-05`, все три колонки
переключаются, у карточки появляется `aria-current`.

- [ ] **Step 6: Коммит**

```bash
git add apps/web/src/features/feed/SignalFeed.tsx
git commit -m "refactor(feed): убрать метастроку карточки — дубль заголовка события"
```

---

### Task 3: Схема — единица измерения один раз, период с кнопки

Семь повторов «мг/дм³» и период, продублированный кнопкой переключателя.

**Files:**
- Modify: `apps/web/src/features/river-scheme/scheme-model.ts`
- Modify: `apps/web/src/components/common/MeasurementValue.tsx`
- Modify: `apps/web/src/features/river-scheme/StationNode.tsx`
- Modify: `apps/web/src/features/river-scheme/OrderedStations.tsx`
- Modify: `apps/web/src/features/river-scheme/UnorderedStations.tsx`
- Modify: `apps/web/src/features/river-scheme/RiverScheme.tsx`
- Modify: `apps/web/src/features/comparison/PeriodSwitcher.tsx`

**Interfaces:**
- Consumes: ничего от предыдущих задач.
- Produces:
  - `SchemeModel.commonUnit: string | null` — сырой код единицы (`"mg/dm3"`),
    если он одинаков у **всех** измерений события; иначе `null`.
  - `MeasurementValue` — новый необязательный проп `showUnit?: boolean`
    (по умолчанию `true`).
  - `StationNode`, `OrderedStations`, `UnorderedStations` — новый
    необязательный проп `showUnit?: boolean` (по умолчанию `true`).
  - `RiverSchemeContent` — новый необязательный проп
    `hasPeriodSwitcher?: boolean` (по умолчанию `false`).

- [ ] **Step 1: Посчитать общую единицу события в модели схемы**

`apps/web/src/features/river-scheme/scheme-model.ts` — добавить поле в тип
и вычисление в функцию.

В тип `SchemeModel`:

```ts
export type SchemeModel = {
  /** По riverOrder, меньший — выше по течению (ТЗ §8). */
  ordered: StationSchemeEntry[]
  /** riverOrder = null — в порядке, в котором станции отдал бэк, без ранжирования. */
  unordered: StationSchemeEntry[]
  corridor: IncidentDetail["corridorBounds"]
  /**
   * Единица, общая для ВСЕХ измерений события — тогда её печатают один раз
   * подписью столбца, а не у каждого значения. Разные единицы внутри события
   * так свернуть нельзя: null означает «печатать у каждого значения свою».
   */
  commonUnit: string | null
}
```

Перед `return` в `buildSchemeModel`:

```ts
  const [firstMeasurement, ...restMeasurements] = detail.measurements
  const commonUnit =
    firstMeasurement &&
    restMeasurements.every((m) => m.unit === firstMeasurement.unit)
      ? firstMeasurement.unit
      : null
```

И в объект результата добавить `commonUnit,` последним полем.

- [ ] **Step 2: Научить `MeasurementValue` печатать число без единицы**

`apps/web/src/components/common/MeasurementValue.tsx`. Единица не пропадает
насовсем — она переезжает в тултип, иначе число осталось бы без размерности
для того, кто не увидел подпись столбца.

Импорт: добавить `formatNumber` рядом с `formatMeasurement`.

```tsx
import { formatMeasurement, formatNumber, formatSampledDate } from "@/lib/format"
```

Проп в тип:

```tsx
type MeasurementValueProps = {
  measurement: Measurement
  /** Документ, из которого взято число; ищется по `measurement.sourceDocumentId`. */
  sourceDocument: SourceDocument
  /**
   * false — единица печатается один раз подписью столбца, а не у каждого
   * значения. Из тултипа она не уходит: число без размерности непроверяемо.
   */
  showUnit?: boolean
  className?: string
}
```

Сигнатура и тело:

```tsx
export function MeasurementValue({
  measurement,
  sourceDocument,
  showUnit = true,
  className,
}: MeasurementValueProps) {
  const pageConfirmed = hasConfirmedPage(sourceDocument, measurement.sourcePage)
  // Даты может не быть вовсе — тогда в подписи её просто нет, а не пустое место.
  const sampledDate = formatSampledDate(measurement)
  const full = formatMeasurement(measurement.value, measurement.unit)

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={sourceHref(sourceDocument, measurement.sourcePage)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "font-medium whitespace-nowrap tabular-nums underline decoration-muted-foreground/50 decoration-dotted underline-offset-4 outline-none hover:decoration-current hover:decoration-solid focus-visible:decoration-current focus-visible:decoration-solid",
              className
            )}
          >
            {showUnit ? full : formatNumber(measurement.value)}
          </a>
        }
      />
      <TooltipContent>
        <p className="max-w-64 text-pretty">
          {!showUnit && <>{full} · </>}
          {measurement.indicator}
          {sampledDate && `, ${sampledDate}`} · {sourceDocument.title}
          {pageConfirmed
            ? `, стр. ${measurement.sourcePage}`
            : " (страница уточняется)"}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
```

- [ ] **Step 3: Пробросить `showUnit` через узлы схемы**

`apps/web/src/features/river-scheme/StationNode.tsx` — в тип пропов добавить:

```tsx
  /** false — единицу печатает подпись столбца, а не каждое значение. */
  showUnit?: boolean
```

В сигнатуру — `showUnit = true,` и в вызов:

```tsx
      {measurement && sourceDocument ? (
        <MeasurementValue
          measurement={measurement}
          sourceDocument={sourceDocument}
          showUnit={showUnit}
          className="text-sm"
        />
      ) : (
```

`apps/web/src/features/river-scheme/OrderedStations.tsx` — в тип пропов
добавить `showUnit?: boolean`, в сигнатуру `showUnit = true`, и в `row`:

```tsx
  const row = (entry: StationSchemeEntry) => (
    <StationNode key={entry.station.id} entry={entry} showUnit={showUnit} />
  )
```

`apps/web/src/features/river-scheme/UnorderedStations.tsx` — так же добавить
`showUnit?: boolean` / `showUnit = true` и передать в `StationNode`:

```tsx
            <StationNode
              key={entry.station.id}
              entry={entry}
              corridorBound={bound}
              corridorOpenUp={openUp}
              showUnit={showUnit}
            />
```

- [ ] **Step 4: Строка контекста схемы — показатель и единица вместо периода**

`apps/web/src/features/river-scheme/RiverScheme.tsx`.

Импорты: удалить `formatSampledDate` из `@/lib/format` (станет неиспользуемым),
добавить `import { unitLabel } from "@/constants/units"`.

В тип `RiverSchemeContentProps` добавить:

```tsx
  /**
   * Переключатель периодов виден — тогда период не дублируется строкой
   * контекста. Без пары периодов дата отбора остаётся здесь: иначе она
   * не попала бы на экран вовсе.
   */
  hasPeriodSwitcher?: boolean
```

Сигнатура: `periodSwitcher = null, hasPeriodSwitcher = false,`.

Заменить блок вычисления `firstMeasurement`/`sampledDate` и разметку строки:

```tsx
  const firstMeasurement = detail.measurements[0] ?? null
  // Период уже стоит на активной кнопке переключателя — второй раз его здесь
  // не печатаем. Если пары периодов нет и кнопок тоже, дата остаётся тут.
  const sampledDate =
    hasPeriodSwitcher || !firstMeasurement
      ? null
      : formatSampledDate(firstMeasurement)
  const unit = model.commonUnit === null ? null : unitLabel(model.commonUnit)
```

```tsx
          {periodSwitcher}
          <p className="text-xs text-muted-foreground">
            {detail.investigation.indicator}
            {unit && `, ${unit}`}
            {sampledDate && ` · ${sampledDate}`}
          </p>
          {model.ordered.length > 0 && (
            <OrderedStations
              entries={model.ordered}
              corridor={model.corridor}
              showUnit={model.commonUnit === null}
            />
          )}
          {hasUnordered && (
            <UnorderedStations
              entries={model.unordered}
              corridor={model.corridor}
              showUnit={model.commonUnit === null}
            />
          )}
```

В контейнере `RiverScheme` передать новый проп:

```tsx
        <RiverSchemeContent
          detail={shownDetail}
          hasPeriodSwitcher={periods.length >= 2}
          periodSwitcher={
            <PeriodSwitcher
              periods={periods}
              selectedIncidentId={selectedIncidentId}
              onSelect={selectPeriod}
            />
          }
        />
```

`periods.length >= 2` — то же условие, по которому `PeriodSwitcher`
возвращает `null` (см. его первую строку). Держать порог в двух местах
неприятно, но альтернатива — заставить контейнер знать внутренности
компонента; порог зафиксирован комментарием в обоих файлах.

Добавить в `PeriodSwitcher.tsx` над `if (periods.length < 2) return null`:

```tsx
  // Порог продублирован в RiverScheme (hasPeriodSwitcher): строка контекста
  // схемы печатает дату только тогда, когда кнопок нет.
```

- [ ] **Step 5: Убрать заголовок над кнопками периодов**

`apps/web/src/features/comparison/PeriodSwitcher.tsx` — удалить видимый
абзац, оставив `aria-label` на `<nav>`: две кнопки с месяцем и уровнем
объясняют себя сами, а для скринридера название группы нужно.

```tsx
    <nav aria-label={COMPARISON_SWITCHER_LABEL} className="flex flex-col gap-1">
      <ul className="flex flex-wrap gap-2">
```

Импорт `COMPARISON_SWITCHER_LABEL` остаётся — он всё ещё нужен для `aria-label`.

- [ ] **Step 6: Проверить сборку**

```bash
npm run typecheck && npm run format && npm run build
cd apps/web && npx eslint . && cd ../..
```

Ожидается: зелёные.

- [ ] **Step 7: Замерить сентябрь**

На `http://localhost:5173/?incident=inv-atyrau-2025-09`:

```js
const count = (needle) => document.body.innerText.split(needle).length - 1
;[count("мг/дм³"), count("нефтепродукты"), count("сентябрь 2025")]
```

Ожидается: `[1, 1, 1]` — единица только в подписи столбца, показатель только
в подписи столбца (в заголовках карточек он часть строки «нефтепродукты,
сентябрь 2025», поэтому обе подстроки считаются один раз в карточке… **если
результат больше — сверить, где именно**: допустимы вхождения внутри
заголовков событий с бэка, они данные и не правятся).

Более строгая проверка, независимая от текстов бэка — счёт только в колонке схемы:

```js
const scheme = document.querySelector('section[aria-label="Линейная схема реки"]')
const c = (needle) => scheme.innerText.split(needle).length - 1
;[c("мг/дм³"), c("сентябрь 2025")]
```

Ожидается: `[1, 1]` — единица один раз в подписи столбца, период один раз
на активной кнопке переключателя.

- [ ] **Step 8: Проверить, что числа остались кликабельными**

В колонке схемы навести курсор на `0,234`. Ожидается: тултип начинается
с `0,234 мг/дм³ · нефтепродукты, сентябрь 2025 г. · …, стр. 22`.
Клик открывает PDF с якорем `#page=22`.

- [ ] **Step 9: Проверить май (нет пары → дата остаётся)**

Открыть `http://localhost:5173/?incident=inv-atyrau-2025-05`. У мая пара
периодов есть (сентябрь), поэтому переключатель виден и даты в строке
контекста быть не должно.

Проверить ветку «без пары» в дев-превью `http://localhost:5173/dev/river-scheme`:
там `RiverSchemeContent` вызывается без `hasPeriodSwitcher`, значит дата
отбора **должна** присутствовать в строке контекста каждого кадра.

- [ ] **Step 10: Коммит**

```bash
git add apps/web/src
git commit -m "refactor(scheme): единица измерения один раз, период только на кнопке"
```

---

### Task 4: Схема — короткая метка вместо трёхстрочной плашки

`SCHEME_UNORDERED_NOTE` занимает три строки посреди колонки и повторяет
подзаголовок шапки «порядок подтверждён не для всех створов».

**Files:**
- Modify: `apps/web/src/constants/scheme.ts`
- Modify: `apps/web/src/features/river-scheme/UnorderedStations.tsx`

**Interfaces:**
- Consumes: `showUnit?: boolean` у `UnorderedStations` из Task 3.
- Produces: новая константа `SCHEME_UNORDERED_LABEL: string`.
  `SCHEME_UNORDERED_NOTE` остаётся и переезжает в тултип — полная
  формулировка нужна тому, кто спросит.

- [ ] **Step 1: Добавить короткую метку**

`apps/web/src/constants/scheme.ts` — рядом с `SCHEME_UNORDERED_NOTE`:

```ts
// Короткая метка группы на экране; полная формулировка ниже — в тултипе.
// Подзаголовок схемы уже сообщает, что порядок подтверждён не для всех
// створов, поэтому здесь достаточно отличить группу от упорядоченной части.
export const SCHEME_UNORDERED_LABEL = "порядок этих створов не подтверждён"
```

- [ ] **Step 2: Заменить плашку меткой с тултипом**

`apps/web/src/features/river-scheme/UnorderedStations.tsx` целиком:

```tsx
import { Info } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  SCHEME_UNORDERED_LABEL,
  SCHEME_UNORDERED_NOTE,
} from "@/constants/scheme"
import { StationNode } from "./StationNode"
import type { SchemeModel, StationSchemeEntry } from "./scheme-model"

type UnorderedStationsProps = {
  entries: StationSchemeEntry[]
  corridor: SchemeModel["corridor"]
  /** false — единицу печатает подпись столбца, а не каждое значение. */
  showUnit?: boolean
}

/**
 * Группа «порядок не подтверждён»: станции с riverOrder = null не встраиваются
 * в линию (решение сессии 1 — ТЗ запрещает тихое ранжирование). Без линии
 * и ленты коридора; границы коридора отмечаются бейджем на самом створе.
 */
export function UnorderedStations({
  entries,
  corridor,
  showUnit = true,
}: UnorderedStationsProps) {
  const openUp = corridor?.upstreamStationId == null

  return (
    <div className="flex flex-col gap-3">
      {/* Не рамка, а рельс слева — как у ленты коридора. Три строки оговорки
          повторяли подзаголовок схемы, поэтому на экране осталась метка,
          а дословная формулировка живёт в тултипе. */}
      <Tooltip>
        <TooltipTrigger
          render={
            <p className="flex w-fit cursor-help items-center gap-2 border-l-2 py-1 pl-3 text-xs text-muted-foreground">
              <Info aria-hidden className="size-3.5 shrink-0" />
              {SCHEME_UNORDERED_LABEL}
            </p>
          }
        />
        <TooltipContent>
          <p className="max-w-72 text-pretty">{SCHEME_UNORDERED_NOTE}</p>
        </TooltipContent>
      </Tooltip>
      <div className="flex flex-col divide-y divide-border/60">
        {entries.map((entry) => {
          const bound =
            corridor?.downstreamStationId === entry.station.id
              ? "downstream"
              : corridor?.upstreamStationId === entry.station.id
                ? "upstream"
                : null
          return (
            <StationNode
              key={entry.station.id}
              entry={entry}
              corridorBound={bound}
              corridorOpenUp={openUp}
              showUnit={showUnit}
            />
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Проверить сборку**

```bash
npm run typecheck && npm run format && npm run build
cd apps/web && npx eslint . && cd ../..
```

- [ ] **Step 4: Проверить на экране**

На `http://localhost:5173/?incident=inv-atyrau-2025-09`:

```js
const scheme = document.querySelector('section[aria-label="Линейная схема реки"]')
scheme.innerText.split("\n").filter((l) => l.includes("порядок"))
```

Ожидается: ровно две строки — подзаголовок шапки
`"Жайык · порядок подтверждён не для всех створов"` и метка группы
`"порядок этих створов не подтверждён"`. Прежней трёхстрочной формулировки
(«последовательность строк не отражает течение реки») в `innerText` нет.

Навести курсор на метку — тултип печатает полный `SCHEME_UNORDERED_NOTE`.

- [ ] **Step 5: Коммит**

```bash
git add apps/web/src/constants/scheme.ts apps/web/src/features/river-scheme/UnorderedStations.tsx
git commit -m "refactor(scheme): метка вместо трёхстрочной оговорки о порядке створов"
```

---

### Task 5: Панель — определение уровня в тултип

Блок 2 печатает три ступени одного факта: заголовок, бейдж с расшифровкой
и две строки определения. Видимой расшифровкой остаётся бейдж
(«L2 Источник локализован до участка») — этого требует ТЗ §13; абзац-определение
уходит в тултип бейджа, где он уже и так печатается.

**Files:**
- Modify: `apps/web/src/features/conclusion/ConclusionPanel.tsx:242-254`

**Interfaces:**
- Consumes: ничего.
- Produces: ничего. `EVIDENCE_LEVEL_META` продолжает использоваться
  в `EvidenceLevelBadge`; из `ConclusionPanel.tsx` импорт удаляется.

- [ ] **Step 1: Убрать абзац определения из блока 2**

`apps/web/src/features/conclusion/ConclusionPanel.tsx`, ветка `evidenceLevel`
в `SectionBody`:

```tsx
    case "evidenceLevel": {
      // Уровень на текущем шаге реплея приходит в payload шага (запрет 6:
      // фронт уровни не вычисляет — ни финальные, ни промежуточные).
      // Расшифровка §13 остаётся видимой — её несёт сам бейдж («L2 Источник
      // локализован до участка»); абзац-определение печатается в его тултипе,
      // третьей копией одного факта он на экране не нужен.
      const level = replayFrame?.evidenceLevel ?? investigation.evidenceLevel
      return <EvidenceLevelBadge level={level} />
    }
```

- [ ] **Step 2: Удалить осиротевший импорт**

Удалить строку `import { EVIDENCE_LEVEL_META } from "@/constants/evidence"`
из `apps/web/src/features/conclusion/ConclusionPanel.tsx`.

- [ ] **Step 3: Проверить сборку**

```bash
npm run typecheck && npm run format && npm run build
cd apps/web && npx eslint . && cd ../..
```

- [ ] **Step 4: Проверить блок 2 на экране**

На `http://localhost:5173/?incident=inv-atyrau-2025-09`:

```js
const panel = document.querySelector('section[aria-label="Вывод и доказательства"]')
panel.innerText.includes("Определён физически допустимый участок")
```

Ожидается: `false` — определения на экране нет.

```js
panel.innerText.includes("Источник локализован до участка")
```

Ожидается: `true` — расшифровка §13 осталась видимой в бейдже.

Навести курсор на бейдж — тултип печатает
`L2 — Источник локализован до участка.` и следом полное определение.

- [ ] **Step 5: Проверить все три уровня**

Открыть `?incident=inv-atyrau-2025-05` (L3) и `?incident=inv-aktau-insufficient`
(L0). Ожидается: в блоке 2 виден бейдж с текстовой расшифровкой,
абзаца-определения нет ни на одном.

- [ ] **Step 6: Коммит**

```bash
git add apps/web/src/features/conclusion/ConclusionPanel.tsx
git commit -m "refactor(panel): определение уровня в тултип, на экране остаётся бейдж"
```

---

### Task 6: Экран Актау — центр перестаёт повторять панель

Самый грубый дубль демо: центральная колонка печатает тот же заголовок, тот же
бейдж уровня, тот же дословный вывод и тот же список пробелов, что блоки 1, 2
и 5 правой панели.

**Files:**
- Modify: `apps/web/src/features/aktau/InsufficientDataScreen.tsx`

**Interfaces:**
- Consumes: ничего.
- Produces: `InsufficientDataScreen` сохраняет прежнюю сигнатуру
  `({ detail }: { detail: IncidentDetail })` — вызов из
  `RiverScheme.tsx:99` не меняется.

- [ ] **Step 1: Переписать экран**

`apps/web/src/features/aktau/InsufficientDataScreen.tsx` целиком:

```tsx
import type { IncidentDetail } from "@/api/contracts"
import { InsufficientData } from "@/components/common"

// Экран «недостаточно данных» (ТЗ §13 «Экран Актау», §7.6) — полноценное
// состояние центральной колонки, когда у события нет ни одного створа:
// отказ от вывода показывается так же охотно, как схема показывает вывод.
//
// Заголовок события, бейдж уровня и дословный вывод отсюда убраны: все три
// печатает правая панель (выбранная карточка ленты, блоки 2 и 1), и на экране
// Актау центральная колонка дословно повторяла её целиком. За центром остался
// его собственный слой — почему схемы нет и чего для неё не хватает.
// Причины по-прежнему приходят с бэка (unknowns), экран ничего не сочиняет.

type InsufficientDataScreenProps = {
  detail: IncidentDetail
}

export function InsufficientDataScreen({
  detail,
}: InsufficientDataScreenProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-6">
        <InsufficientData
          reasons={detail.investigation.unknowns}
          className="w-full max-w-xl"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Проверить сборку**

```bash
npm run typecheck && npm run format && npm run build
cd apps/web && npx eslint . && cd ../..
```

Ожидается: зелёные. Импорты `EvidenceLevelBadge` и `REGION_LABELS` удалены
вместе с разметкой — если `typecheck` ругается на неиспользуемое, значит
в файле остался хвост.

- [ ] **Step 3: Замерить исчезновение дубля**

На `http://localhost:5173/?incident=inv-aktau-insufficient`:

```js
const count = (needle) => document.body.innerText.split(needle).length - 1
count("Источник не локализован")
```

Ожидается: `1`. До правки было `2`.

```js
count("Непроверенный сигнал")
```

Ожидается: `1` — бейдж уровня остался только в блоке 2 панели.

```js
count("Актау, побережье Каспия")
```

Ожидается: `1` — заголовок остался только в карточке ленты.

- [ ] **Step 4: Проверить, что состояние читается**

Визуально: центральная колонка показывает рамку «Недостаточно данных»
с пояснением «Это не ошибка…» и тремя причинами. Правая панель показывает
вывод в блоке 1, бейдж L0 в блоке 2, «Что неизвестно · 3» свёрнутым.

Развернуть блок 5 — там тот же список причин. Это принято осознанно
(состав §13 — контракт), и одновременно два списка на экране не видны,
пока блок свёрнут.

- [ ] **Step 5: Проверить, что события со створами не задеты**

Открыть `?incident=inv-atyrau-2025-09` и `?incident=inv-atyrau-2025-05`.
Ожидается: схема рисуется как раньше, экран «недостаточно данных»
не появляется.

- [ ] **Step 6: Коммит**

```bash
git add apps/web/src/features/aktau/InsufficientDataScreen.tsx
git commit -m "refactor(aktau): центр перестаёт дублировать правую панель"
```

---

### Task 7: Шкала реплея — подсказка и подписи шагов

Постоянная инструкция по клавишам и шесть подписей сразу, из которых
«Применение правила» стоит дважды подряд.

**Files:**
- Modify: `apps/web/src/features/replay/ReplayTimeline.tsx`

**Interfaces:**
- Consumes: ничего.
- Produces: ничего. `REPLAY_KEYBOARD_HINT` остаётся живой константой —
  переезжает в `title` кнопки воспроизведения.

- [ ] **Step 1: Перенести подсказку в `title` кнопки**

`apps/web/src/features/replay/ReplayTimeline.tsx`, кнопка play:

```tsx
        <Button
          variant="outline"
          size="icon"
          disabled={!canReplay}
          onClick={togglePlayback}
          aria-label={playLabel}
          // Подсказка по клавишам живёт здесь, а не строкой на экране: она
          // нужна ведущему демо один раз, а занимала место на всех экранах.
          title={`${playLabel} · ${REPLAY_KEYBOARD_HINT}`}
        >
          {isPlaying ? <Pause /> : <Play />}
        </Button>
```

`aria-label` остаётся коротким: скринридер не должен читать инструкцию
при каждом фокусе.

- [ ] **Step 2: Заменить подсказку в строке шага на название действия**

Там же, строка состояния над шкалой. В покое строка теперь говорит, что
сделает кнопка, а не как нажимать клавиши:

```tsx
          {frame ? (
            <>
              <span className="font-medium text-foreground">
                {REPLAY_STEP_TYPE_LABELS[frame.step.type]}
              </span>
              <EvidenceLevelBadge
                level={frame.evidenceLevel}
                compact
                className="mx-2 align-middle"
              />
              {stepSummary}
            </>
          ) : scenarioQuery.isError ? (
            REPLAY_UNAVAILABLE
          ) : (
            REPLAY_PLAY_LABEL
          )}
```

- [ ] **Step 3: Показывать подпись только у текущего шага**

Там же, разметка маркеров. Название шага уходит в `title` маркера, чтобы
оставаться доступным по наведению:

```tsx
          {steps.map((step, index) => {
            const reached = frame !== null && index <= frame.stepIndex
            const isCurrent = frame !== null && index === frame.stepIndex
            const label = REPLAY_STEP_TYPE_LABELS[step.type]
            return (
              <div
                key={step.id}
                className="absolute top-0 h-full"
                style={{ left: `${(step.offsetMs / totalMs) * 100}%` }}
              >
                <button
                  type="button"
                  disabled={!canReplay}
                  onClick={() => handleMarkerClick(index)}
                  aria-label={replayStepAriaLabel(label)}
                  aria-current={isCurrent ? "step" : undefined}
                  title={label}
                  className="absolute top-2.25 -translate-x-1/2 -translate-y-1/2 rounded-full p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-default"
                >
                  <span
                    className={cn(
                      "block size-2 rounded-full bg-muted-foreground/50 transition-colors",
                      reached && "bg-foreground",
                      isCurrent && "ring-4 ring-foreground/15"
                    )}
                  />
                </button>
                {/* Подпись только у текущего шага: шесть подписей сразу давали
                    два одинаковых «Применение правила» подряд (в сценарии по
                    шагу inference на каждое правило). Названия остальных
                    доступны по наведению и скринридеру. */}
                {isCurrent && (
                  <span
                    className={cn(
                      "absolute top-5 block w-max text-[10px] leading-tight font-medium text-foreground",
                      labelAlignment(index, steps.length)
                    )}
                  >
                    {label}
                  </span>
                )}
              </div>
            )
          })}
```

- [ ] **Step 4: Проверить сборку**

```bash
npm run typecheck && npm run format && npm run build
cd apps/web && npx eslint . && cd ../..
```

Ожидается: зелёные. `labelAlignment` по-прежнему используется — если линтер
сообщает о неиспользуемой функции, шаг 3 применён не полностью.

- [ ] **Step 5: Замерить исчезновение дубля**

На `http://localhost:5173/?incident=inv-atyrau-2025-09` до запуска реплея:

```js
const footer = document.querySelector('footer[aria-label="Шкала реплея"]')
const count = (needle) => footer.innerText.split(needle).length - 1
;[count("Применение правила"), count("пробел — пуск и пауза")]
```

Ожидается: `[0, 0]` — подписей шагов в покое нет, инструкции по клавишам нет.

- [ ] **Step 6: Проверить реплей по шагам**

Нажать play. На каждом шаге под плейхедом должна стоять ровно одна подпись —
название текущего шага. Проверить на шагах 4 и 5 (оба `inference`): подпись
«Применение правила» видна по одной за раз, а не двумя соседними.

```js
const footer = document.querySelector('footer[aria-label="Шкала реплея"]')
footer.innerText.split("Применение правила").length - 1
```

Ожидается на шаге `inference`: `2` — один раз в строке состояния над шкалой
и один раз подписью текущего маркера. На остальных шагах: `0`.

- [ ] **Step 7: Проверить клавиатуру и Актау**

Пробел — пуск и пауза, ←/→ — переход по шагам (поведение не менялось).
На `?incident=inv-aktau-insufficient` строка над шкалой печатает
«Сценарий реплея для этого события пока недоступен», кнопки погашены.

- [ ] **Step 8: Коммит**

```bash
git add apps/web/src/features/replay/ReplayTimeline.tsx
git commit -m "refactor(replay): подпись только у текущего шага, подсказка клавиш в title"
```

---

### Task 8: Досье — константные колонки и общие основания

Таблица измерений печатает «нефтепродукты / вода / сентябрь 2025 г. /
РГП «Казгидромет», стр. 22» семь раз подряд.

**Files:**
- Modify: `apps/web/src/features/dossier/dossier-model.ts`
- Modify: `apps/web/src/features/dossier/MeasurementTable.tsx`
- Modify: `apps/web/src/features/dossier/CandidateObjectList.tsx`

**Interfaces:**
- Consumes: ничего от предыдущих задач.
- Produces:
  - `measurementSourceLabel(row: DossierMeasurementRow): string | null` —
    «издатель, стр. N»; `null`, если документа нет.
  - `type SharedMeasurementColumns = { indicator: string | null; matrix: string | null; sampledDate: string | null; source: string | null }`
  - `sharedMeasurementColumns(rows: DossierMeasurementRow[]): SharedMeasurementColumns` —
    значение поля, если оно одинаково во **всех** строках; иначе `null`.

- [ ] **Step 1: Вынести подпись источника и вычисление общих колонок в модель**

`apps/web/src/features/dossier/dossier-model.ts`. Сейчас файл импортирует
только `IncidentDetail`, `buildPanelModel` с его типами и типы данных —
все четыре импорта ниже новые, добавляются к существующим:

```ts
import { DOSSIER_SOURCE_PAGE_PREFIX } from "@/constants/dossier"
import { matrixLabel } from "@/constants/units"
import { formatSampledDate } from "@/lib/format"
import { hasConfirmedPage } from "@/lib/source"
```

Дальше — в конец файла:

```ts
/** «РГП «Казгидромет», стр. 22» — издатель и страница; null, если документа нет. */
export function measurementSourceLabel(
  row: DossierMeasurementRow
): string | null {
  const { measurement, sourceDocument } = row
  if (!sourceDocument) return null
  return [
    sourceDocument.publisher,
    hasConfirmedPage(sourceDocument, measurement.sourcePage) &&
      `${DOSSIER_SOURCE_PAGE_PREFIX} ${measurement.sourcePage}`,
  ]
    .filter((part): part is string => typeof part === "string")
    .join(", ")
}

/**
 * Колонки, значение которых одинаково во всех строках события: их печатают
 * один раз подзаголовком таблицы. null — строки различаются (или значения
 * нет), тогда колонка печатается как есть. Свёртка выводится из данных,
 * а не задаётся списком: у события с разными показателями или датами
 * таблица обязана остаться полной.
 */
export type SharedMeasurementColumns = {
  indicator: string | null
  matrix: string | null
  sampledDate: string | null
  source: string | null
}

function sharedValue(
  rows: DossierMeasurementRow[],
  pick: (row: DossierMeasurementRow) => string | null
): string | null {
  const [first, ...rest] = rows
  if (!first) return null
  const value = pick(first)
  if (value === null) return null
  return rest.every((row) => pick(row) === value) ? value : null
}

export function sharedMeasurementColumns(
  rows: DossierMeasurementRow[]
): SharedMeasurementColumns {
  return {
    indicator: sharedValue(rows, (row) => row.measurement.indicator),
    matrix: sharedValue(rows, (row) => matrixLabel(row.measurement.matrix)),
    sampledDate: sharedValue(rows, (row) => formatSampledDate(row.measurement)),
    source: sharedValue(rows, measurementSourceLabel),
  }
}
```

- [ ] **Step 2: Добавить строку-подзаголовок таблицы в константы**

`apps/web/src/constants/dossier.ts` — рядом с `DOSSIER_MEASUREMENT_COLUMNS`:

```ts
// Одинаковые во всех строках значения печатаются один раз над таблицей:
// семь повторов «нефтепродукты · вода · сентябрь 2025 г. · …» — шум, а не
// данные. Подпись перечисляет, что верно для каждой строки ниже.
export const DOSSIER_MEASUREMENT_SHARED_PREFIX = "Во всех строках"
```

- [ ] **Step 3: Свернуть константные колонки в таблице**

`apps/web/src/features/dossier/MeasurementTable.tsx` целиком:

```tsx
import { MeasurementValue } from "@/components/common"
import {
  DOSSIER_MEASUREMENT_COLUMNS,
  DOSSIER_MEASUREMENT_SHARED_PREFIX,
  DOSSIER_NO_DATE,
  DOSSIER_NO_MEASUREMENTS,
} from "@/constants/dossier"
import { matrixLabel } from "@/constants/units"
import { formatMeasurement, formatSampledDate } from "@/lib/format"
import {
  measurementSourceLabel,
  sharedMeasurementColumns,
  type DossierMeasurementRow,
} from "./dossier-model"

type MeasurementTableProps = {
  rows: DossierMeasurementRow[]
}

/**
 * Таблица измерений (роадмап §21.1, п. 6) — те же числа, что в бюллетене.
 * Значение остаётся кликабельным и в досье (критерий §16 п.5), а полные
 * названия и URL документов печатаются в разделе «Источники»: в колонке
 * достаточно издателя и страницы.
 *
 * Колонки, одинаковые во всех строках, печатаются один раз подзаголовком:
 * у события с однородными измерениями четыре колонки из шести были копиями
 * самих себя. Свёртка считается по данным (sharedMeasurementColumns), поэтому
 * разнородное событие получит полную таблицу.
 */
export function MeasurementTable({ rows }: MeasurementTableProps) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground">{DOSSIER_NO_MEASUREMENTS}</p>
  }

  const shared = sharedMeasurementColumns(rows)
  const sharedParts = [
    shared.indicator,
    shared.matrix,
    shared.sampledDate,
    shared.source,
  ].filter((part): part is string => part !== null)

  return (
    <div className="flex flex-col gap-1.5">
      {sharedParts.length > 0 && (
        <p className="text-xs text-pretty text-muted-foreground">
          {DOSSIER_MEASUREMENT_SHARED_PREFIX}: {sharedParts.join(" · ")}
        </p>
      )}
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b">
            <th className="py-1.5 pr-3 font-medium">
              {DOSSIER_MEASUREMENT_COLUMNS.station}
            </th>
            {shared.indicator === null && (
              <th className="py-1.5 pr-3 font-medium">
                {DOSSIER_MEASUREMENT_COLUMNS.indicator}
              </th>
            )}
            {shared.matrix === null && (
              <th className="py-1.5 pr-3 font-medium">
                {DOSSIER_MEASUREMENT_COLUMNS.matrix}
              </th>
            )}
            {shared.sampledDate === null && (
              <th className="py-1.5 pr-3 font-medium">
                {DOSSIER_MEASUREMENT_COLUMNS.sampledAt}
              </th>
            )}
            <th className="py-1.5 pr-3 font-medium last:pr-0">
              {DOSSIER_MEASUREMENT_COLUMNS.value}
            </th>
            {shared.source === null && (
              <th className="py-1.5 font-medium">
                {DOSSIER_MEASUREMENT_COLUMNS.source}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { measurement, station, sourceDocument } = row
            const sampledDate = formatSampledDate(measurement)

            return (
              <tr
                key={measurement.id}
                className="break-inside-avoid border-b align-baseline"
              >
                <td className="py-1.5 pr-3 text-pretty">
                  {station?.name ?? measurement.stationId}
                </td>
                {shared.indicator === null && (
                  <td className="py-1.5 pr-3">{measurement.indicator}</td>
                )}
                {shared.matrix === null && (
                  <td className="py-1.5 pr-3">
                    {matrixLabel(measurement.matrix)}
                  </td>
                )}
                {shared.sampledDate === null && (
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {sampledDate ?? (
                      <span className="text-muted-foreground">
                        {DOSSIER_NO_DATE}
                      </span>
                    )}
                  </td>
                )}
                <td className="py-1.5 pr-3">
                  {sourceDocument ? (
                    <MeasurementValue
                      measurement={measurement}
                      sourceDocument={sourceDocument}
                      className="text-xs"
                    />
                  ) : (
                    // Документа нет в ответе — число печатается без ссылки,
                    // но остаётся на своём месте в таблице.
                    <span className="font-medium tabular-nums">
                      {formatMeasurement(measurement.value, measurement.unit)}
                    </span>
                  )}
                </td>
                {shared.source === null && (
                  <td className="py-1.5 text-pretty text-muted-foreground">
                    {measurementSourceLabel(row)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

`DOSSIER_SOURCE_PAGE_PREFIX` и `hasConfirmedPage` из этого файла уходят —
они переехали в `measurementSourceLabel`.

- [ ] **Step 4: Печатать одинаковые основания один раз на группу**

`apps/web/src/features/dossier/CandidateObjectList.tsx` — тело `map`
заменяется так, чтобы повторяющаяся строка оснований не печаталась дважды
подряд (тот же приём, что у расшифровок статусов в поповере, решение
сессии 15):

```tsx
  return (
    <ul className="flex flex-col gap-3">
      {entries.map(({ object, evidenceDocuments }, index) => {
        const basis =
          evidenceDocuments.length > 0
            ? evidenceDocuments.map((document) => document.title).join("; ")
            : DOSSIER_OBJECT_NO_BASIS
        // Одинаковое основание у соседей печатается один раз: два подряд
        // идентичных абзаца — шум, а не подсказка.
        const previous = entries[index - 1]
        const previousBasis = previous
          ? previous.evidenceDocuments.length > 0
            ? previous.evidenceDocuments
                .map((document) => document.title)
                .join("; ")
            : DOSSIER_OBJECT_NO_BASIS
          : null

        return (
          <li key={object.id} className="flex break-inside-avoid flex-col gap-1">
            <p className="text-pretty">
              <span className="font-medium">{object.name}</span>
              {" — "}
              {OBJECT_FOR_REVIEW_LABEL}
            </p>
            <p className="text-xs text-muted-foreground">
              {[
                object.category,
                object.waterBody,
                DOSSIER_COMPLETENESS_LABELS[object.completeness],
              ]
                .filter((part): part is string => typeof part === "string")
                .join(" · ")}
            </p>
            {basis !== previousBasis && (
              <p className="text-xs text-pretty text-muted-foreground">
                {DOSSIER_OBJECT_BASIS_LABEL}: {basis}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
```

- [ ] **Step 5: Проверить сборку**

```bash
npm run typecheck && npm run format && npm run build
cd apps/web && npx eslint . && cd ../..
```

- [ ] **Step 6: Замерить таблицу досье**

На `http://localhost:5173/dossier/inv-atyrau-2025-09`:

Считать нужно внутри таблицы, а не по всей странице: те же слова законно
встречаются в заголовке события и в разделе «Источники», и общий счётчик
ничего не докажет.

```js
const table = document.querySelector("table")
const c = (needle) => table.innerText.split(needle).length - 1
;[c("нефтепродукты"), c("вода"), c("стр. 22")]
```

Ожидается: `[0, 0, 0]` — в теле таблицы этих значений больше нет,
они стоят в подзаголовке над ней. До правки было `[7, 7, 7]`.

Подзаголовок при этом должен существовать:

```js
document.body.innerText.includes(
  "Во всех строках: нефтепродукты · вода · сентябрь 2025 г."
)
```

Ожидается: `true`.

- [ ] **Step 7: Проверить, что числа остались кликабельными**

В таблице досье все семь значений — ссылки. Клик по `0,234` открывает PDF
на `#page=22`. Ожидается: работает как раньше.

- [ ] **Step 8: Проверить событие без свёртки**

Открыть `http://localhost:5173/dossier/inv-atyrau-2025-05`. У мая два
измерения одного показателя — свёртка сработает так же. Проверить, что
таблица не сломана и подзаголовок соответствует содержимому строк.

Открыть `http://localhost:5173/dossier/inv-aktau-insufficient`. Измерений
нет — ожидается прежнее пустое состояние `DOSSIER_NO_MEASUREMENTS`,
без подзаголовка и таблицы.

- [ ] **Step 9: Проверить печать настоящим PDF**

Chrome → Печать → «Сохранить как PDF», A4. Ожидается: таблица не разъезжается
по ширине, ни одна строка не разорвана между страницами, подзаголовок
не отрывается от таблицы.

- [ ] **Step 10: Коммит**

```bash
git add apps/web/src
git commit -m "refactor(dossier): константные колонки таблицы — один раз подзаголовком"
```

---

### Task 9: Поповер «Состояние данных» — группировка источников

Все четыре источника в сиде имеют статус `never_run`, и список печатает
«Ни разу не опрашивался.» четыре раза и «Последний успешный опрос: успешных
опросов не было · кэша нет» тоже четыре раза — восемь одинаковых строк подряд.
Решение сессии 15 уже свернуло на группу длинную расшифровку; тем же приёмом
сворачиваются подпись статуса и строка последнего опроса.

**Files:**
- Modify: `apps/web/src/features/live-status/live-status-model.ts`
- Modify: `apps/web/src/features/live-status/SourceStatusList.tsx`

**Interfaces:**
- Consumes: ничего от предыдущих задач.
- Produces:
  - `sourceDetailLine(source: SourceHealthItem): string` — «Последний успешный
    опрос: … · …».
  - `type SourceHealthGroup = { status: SourceHealthStatus; sources: SourceHealthItem[]; sharedDetail: string | null }`
  - `groupSourcesBySeverity(sources: readonly SourceHealthItem[]): SourceHealthGroup[]` —
    группы в порядке убывания severity; `sharedDetail` не `null`, когда строка
    последнего опроса одинакова у всех источников группы.
  - `sortSourcesBySeverity` остаётся экспортированной: её использует
    дев-превью `/dev/live-status`.

- [ ] **Step 1: Добавить группировку в модель**

`apps/web/src/features/live-status/live-status-model.ts` — добавить в конец
файла, а импорты дополнить строкой формата и подписями:

```ts
import { formatDateTime } from "@/lib/format"
import {
  LIVE_STATUS_CACHE_AVAILABLE,
  LIVE_STATUS_CACHE_MISSING,
  LIVE_STATUS_LAST_SUCCESS_LABEL,
  LIVE_STATUS_NEVER_SUCCEEDED,
  SOURCE_HEALTH_META,
} from "@/constants/live-status"
```

(существующий импорт `SOURCE_HEALTH_META` заменяется этим блоком, второй раз
его писать не нужно)

```ts
/** «Последний успешный опрос: успешных опросов не было · кэша нет». */
export function sourceDetailLine(source: SourceHealthItem): string {
  const lastSuccess =
    source.lastSuccessAt === null
      ? LIVE_STATUS_NEVER_SUCCEEDED
      : formatDateTime(source.lastSuccessAt)
  const cache = source.cacheAvailable
    ? LIVE_STATUS_CACHE_AVAILABLE
    : LIVE_STATUS_CACHE_MISSING
  return `${LIVE_STATUS_LAST_SUCCESS_LABEL}: ${lastSuccess} · ${cache}`
}

export type SourceHealthGroup = {
  status: SourceHealthStatus
  sources: SourceHealthItem[]
  /**
   * Строка последнего опроса, одинаковая у всех источников группы: тогда её
   * печатают один раз рядом с подписью статуса. null — источники группы
   * отличаются друг от друга, и строка нужна каждому.
   */
  sharedDetail: string | null
}

/**
 * Источники группами по состоянию, тяжёлые состояния первыми. Группировка —
 * продолжение решения сессии 15 (одинаковая расшифровка печатается один раз):
 * при четырёх источниках в одном состоянии восемь одинаковых строк подряд
 * это шум, а не подсказка.
 */
export function groupSourcesBySeverity(
  sources: readonly SourceHealthItem[]
): SourceHealthGroup[] {
  const groups: SourceHealthGroup[] = []

  for (const source of sortSourcesBySeverity(sources)) {
    const current = groups[groups.length - 1]
    if (current && current.status === source.status) {
      current.sources.push(source)
    } else {
      groups.push({ status: source.status, sources: [source], sharedDetail: null })
    }
  }

  return groups.map((group) => {
    const [first, ...rest] = group.sources
    if (!first) return group
    const detail = sourceDetailLine(first)
    return {
      ...group,
      sharedDetail: rest.every((source) => sourceDetailLine(source) === detail)
        ? detail
        : null,
    }
  })
}
```

- [ ] **Step 2: Переписать список под группы**

`apps/web/src/features/live-status/SourceStatusList.tsx` целиком:

```tsx
import type { SourceHealthItem } from "@/api/contracts"
import { LIVE_STATUS_EMPTY, SOURCE_HEALTH_META } from "@/constants/live-status"
import { groupSourcesBySeverity, sourceDetailLine } from "./live-status-model"
import { SourceHealthMarkIcon } from "./SourceHealthMark"

// Список источников: состояние, время последнего успешного опроса и наличие
// кэша — три вещи, по которым видно, чем именно наполнен экран. Компонент
// презентационный: данные приходят пропом, дев-превью показывает им же
// состояния, которых нет в фикстуре.
//
// Источники сгруппированы по состоянию: подпись статуса, расшифровка и строка
// последнего опроса печатаются один раз на группу. В сиде все четыре источника
// в одном состоянии, и построчная печать давала восемь одинаковых строк.

type SourceStatusListProps = {
  sources: readonly SourceHealthItem[]
}

export function SourceStatusList({ sources }: SourceStatusListProps) {
  if (sources.length === 0) {
    return <p className="text-muted-foreground">{LIVE_STATUS_EMPTY}</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {groupSourcesBySeverity(sources).map((group) => {
        const meta = SOURCE_HEALTH_META[group.status]

        return (
          <li key={group.status} className="flex gap-2">
            <SourceHealthMarkIcon mark={meta.mark} className="mt-1.5" />
            <div className="min-w-0 flex-1">
              <p className="text-pretty text-muted-foreground">
                <span className="text-foreground">{meta.label}.</span>{" "}
                {meta.description}
              </p>
              <ul className="mt-0.5 flex flex-col">
                {group.sources.map((source) => (
                  <li key={source.id} className="text-pretty">
                    <span className="font-medium">{source.name}</span>
                    {group.sharedDetail === null && (
                      <span className="text-muted-foreground">
                        {" — "}
                        {sourceDetailLine(source)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {group.sharedDetail !== null && (
                <p className="text-muted-foreground">{group.sharedDetail}</p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 3: Проверить сборку**

```bash
npm run typecheck && npm run format && npm run build
cd apps/web && npx eslint . && cd ../..
```

Ожидается: зелёные. Если линтер сообщает о неиспользуемых
`LIVE_STATUS_LAST_SUCCESS_LABEL` / `LIVE_STATUS_NEVER_SUCCEEDED` /
`LIVE_STATUS_CACHE_*` в `SourceStatusList.tsx` — они переехали в модель,
их импорты из компонента удалены (см. код шага 2).

- [ ] **Step 4: Замерить поповер**

На `http://localhost:5173/?incident=inv-atyrau-2025-09` открыть поповер
(кнопка `button[data-slot="popover-trigger"]` в шапке), затем:

```js
const popover = document.querySelector('[data-slot="popover-content"]')
const count = (needle) => popover.innerText.split(needle).length - 1
;[count("Ни разу не опрашивался"), count("успешных опросов не было")]
```

Ожидается: `[1, 1]`. До правки было `[4, 4]`.

Имена всех четырёх источников остаются на месте:

```js
;["Казгидромет", "GDELT", "Open-Meteo Flood", "Open-Meteo Marine"].map(
  (name) => popover.innerText.includes(name)
)
```

Ожидается: `[true, true, true, true]`.

- [ ] **Step 5: Проверить оговорку и разнородные состояния**

Оговорка «Недоступный источник — это пробел в данных…» обязана оставаться
первой строкой поповера и быть видна без прокрутки (решение сессии 15) —
проверить визуально.

Открыть `http://localhost:5173/dev/live-status`. Там есть ЯВНО синтетический
список с healthy / degraded / rate_limited / failed — по одному источнику
в каждом состоянии. Ожидается: четыре группы по одному источнику, у каждой
своя подпись и своя строка последнего опроса (при группе из одного источника
`sharedDetail` не `null`, и строка печатается один раз — это верно). Также
проверить кадры «фикстура 4 × never_run» и «пустой список».

- [ ] **Step 6: Коммит**

```bash
git add apps/web/src/features/live-status
git commit -m "refactor(live-status): источники группами — подпись состояния один раз"
```

---

### Task 10: Сквозная проверка и документы сессии

**Files:**
- Modify: `docs/frontend-plan.md`
- Modify: `docs/decisions.md`

**Interfaces:**
- Consumes: результат всех предыдущих задач.
- Produces: ничего в коде.

- [ ] **Step 1: Полный прогон проверок**

```bash
npm run typecheck && npm run lint && npm run format && npm run build
```

Ожидается: все зелёные. Записать новый размер бандла — он должен
уменьшиться или остаться прежним (кода стало меньше, зависимостей не добавлено).

- [ ] **Step 2: Сводный замер повторов**

На каждом из трёх экранов (`?incident=inv-atyrau-2025-09`,
`?incident=inv-atyrau-2025-05`, `?incident=inv-aktau-insufficient`)
в светлой и тёмной теме, 1280×720 и 1440×900:

```js
const count = (needle) => document.body.innerText.split(needle).length - 1
;({
  unit: count("мг/дм³"),
  region: count("Атырауская область"),
  order: count("последовательность строк не отражает"),
  levelDefinition: count("Определён физически допустимый участок"),
  keyboardHint: count("пробел — пуск и пауза"),
  switcherHeading: count("Периоды наблюдений этого участка"),
})
```

Ожидается на всех экранах: `unit ≤ 1`, остальные — `0`.

Отдельно поповер (открыть его на любом экране):

```js
const popover = document.querySelector('[data-slot="popover-content"]')
const p = (needle) => popover.innerText.split(needle).length - 1
;[p("Ни разу не опрашивался"), p("успешных опросов не было")]
```

Ожидается: `[1, 1]`.

И досье (`/dossier/inv-atyrau-2025-09`):

```js
const table = document.querySelector("table")
const c = (needle) => table.innerText.split(needle).length - 1
;[c("нефтепродукты"), c("вода"), c("стр. 22")]
```

Ожидается: `[0, 0, 0]`.

- [ ] **Step 3: Проверить отсутствие горизонтальной прокрутки**

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

Ожидается: `true` на обоих разрешениях и всех трёх экранах.

- [ ] **Step 4: Проверить консоль**

Ожидается: ошибок нет, предупреждения — только `STUB:`.

- [ ] **Step 5: Проверить реплей целиком**

Запустить реплей на сентябре, пройти все шесть шагов. Ожидается: блоки
панели раскрываются сами при появлении содержимого, значения и коридор
проявляются по шагам, подпись стоит только у текущего шага, drag шкалы
и `prefers-reduced-motion` работают как раньше.

- [ ] **Step 6: Обновить `docs/frontend-plan.md`**

Добавить в начало файла блок сессии 18 по образцу предыдущих: что сделано
(разгрузка экрана по принципу «один факт — одно место»), замеры повторов
до и после, новый размер бандла, что проверено, следующая задача
(предпоказный прогон: печать досье PDF, 1440×900, офлайн-запуск собранного
бандла). Предыдущий блок «Сессия 17» свернуть в `<details>`.

- [ ] **Step 7: Обновить `docs/decisions.md`**

Добавить раздел «## Сессия 18 (06.08.2026, разгрузка экрана)» с решениями
и обоснованиями — по одной строке обоснования на решение, как в остальных
разделах файла. Минимум зафиксировать:

- принцип «один факт — одно место» и распределение слоёв по колонкам;
- почему метастрока карточки удалена целиком, а заголовок события не правится;
- почему единица выносится подписью столбца только при однородных единицах;
- почему расшифровкой §13 считается бейдж, а определение уходит в тултип;
- почему центральная колонка Актау отдала вывод и уровень правой панели,
  а список пробелов остался в двух местах;
- почему подпись шага показывается только у текущего;
- почему свёртка колонок досье считается по данным, а не задана списком;
- почему источники в поповере сгруппированы по состоянию (продолжение
  решения сессии 15, а не его отмена).

- [ ] **Step 8: Коммит**

```bash
git add docs/frontend-plan.md docs/decisions.md
git commit -m "docs: итоги сессии 18 — разгрузка экрана по принципу «один факт — одно место»"
```

---

## Замечания для исполнителя

- **`docs/stubs.md` не трогается**: заглушки не менялись, транспорт данных
  не менялся, реестр `constants/stubs.ts` тоже.
- **Дев-превью (`/dev/*`) обязаны продолжать собираться и открываться.**
  `RiverSchemeContent` в `dev/RiverSchemeGallery.tsx` вызывается без
  `hasPeriodSwitcher` — значение по умолчанию `false` покрывает этот случай.
  В прод-бандл чанки галерей не попадают (`import.meta.env.DEV` + lazy),
  поэтому `npm run build` их не проверяет: открыть вручную на дев-сервере
  `/dev/primitives`, `/dev/river-scheme`, `/dev/conclusion`, `/dev/feed`,
  `/dev/comparison`, `/dev/live-status` и убедиться, что ошибок в консоли нет.
  `/dev/live-status` и `/dev/river-scheme` задеты сильнее прочих (Task 9
  и Task 3).
- **Если замер не сходится с ожидаемым числом — не подгонять проверку.**
  Расхождение означает, что либо правка неполная, либо факт приходит из
  данных бэка (тогда он не наш и не правится) — разобраться, что именно,
  и записать вывод в `docs/decisions.md`.
