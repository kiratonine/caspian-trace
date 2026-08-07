# Карта и вкладки — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показать вывод сентябрьского расследования на геосхеме-карте, где видно, что объект для проверки лежит НИЖЕ участка и потому версия отпала, и развести карту, будущего агента и нынешний доказательный экран по вкладкам.

**Architecture:** Вкладка живёт в URL (`?tab=`), рядом с существующим `?incident=`. Карта — чистый SVG в `features/map/`, позиции считает одна чистая функция `buildMapModel` поверх того же `IncidentDetail`, что кормит нынешний экран. Нынешний трёхколоночный `App` целиком переезжает внутрь третьей вкладки без правок.

**Tech Stack:** React 19, TypeScript strict, Tailwind 4, Base UI (shadcn), react-router-dom, TanStack Query. Новых зависимостей нет.

## Global Constraints

- **Никаких выдуманных координат.** У всех `Station.location` и `CandidateObject.location` — `null`. Ни одна точка на карте не претендует на географические координаты; под картой стоит подпись, что форма русла условна.
- **Никаких выдуманных данных.** Только `IncidentDetail` выбранного события. Новых заглушек в `src/api/` не появляется, `docs/stubs.md` не меняется.
- **Никаких обвинительных формулировок.** Имя объекта печатается только с подписью «объект для проверки» и ссылкой на документ-основание. Слова «виновен», «нарушитель», «источник установлен», «доказано» запрещены. Процент вероятности не выводится.
- **Фронт не считает выводы.** Уровень, коридор, утверждения приходят готовыми.
- **Никаких новых зависимостей.** MapLibre не ставим; `package-lock.json` не трогаем.
- **Правим только `apps/web/**` и `docs/**`.**
- **Лейблы и числа — в `src/constants/`,** в JSX ни магических чисел, ни зашитых строк.
- **Числа — `Intl.NumberFormat('ru-RU')`** через существующий `MeasurementValue`.
- **Тестовой инфраструктуры в `apps/web` нет** (вопрос 15 к бэкенду не закрыт: ни `vitest`, ни `@playwright/test`). Поэтому цикл проверки каждой задачи — `typecheck` + `lint` + `prettier` + `build` по `-w web`, затем реальная проверка в браузере через Playwright MCP. Корневые `npm run typecheck` / `build` после слияния `integration/mvp` падают на `apps/api`, поэтому **всегда `-w web`**.

**Команда проверки (повторяется в каждой задаче):**

```bash
npm run typecheck -w web && npm run lint -w web && npx prettier --check "apps/web/src/**/*.{ts,tsx,css}" && npm run build -w web
```

---

### Task 1: Вкладки — параметр URL, таб-бар, перенос нынешнего экрана

**Files:**
- Create: `apps/web/src/constants/tabs.ts`
- Create: `apps/web/src/features/tabs/TabBar.tsx`
- Create: `apps/web/src/features/tabs/AgentTabPlaceholder.tsx`
- Create: `apps/web/src/features/tabs/use-selected-tab.ts`
- Modify: `apps/web/src/constants/routing.ts` (добавить `TAB_SEARCH_PARAM`)
- Modify: `apps/web/src/App.tsx` (обёртка вкладок)

**Interfaces:**
- Produces: `TAB_SEARCH_PARAM: "tab"`, `APP_TABS: readonly AppTab[]`, `type AppTabId = "agent" | "map" | "evidence"`, `useSelectedTab(): { tabId: AppTabId; selectTab: (id: AppTabId) => void }`, `<TabBar />`, `<AgentTabPlaceholder />`.
- Consumes: ничего.

- [ ] **Step 1: Константы вкладок**

Создать `apps/web/src/constants/tabs.ts`. Массив и есть контракт состава вкладок — тот же приём, что у `CONCLUSION_SECTIONS` и `DOSSIER_SECTIONS`: поменять порядок или убрать вкладку можно только здесь, и это будет видимое решение.

```ts
// Состав и порядок вкладок — контракт в одном месте (тот же приём, что
// CONCLUSION_SECTIONS сессии 3): удалить вкладку можно только отсюда.
export type AppTabId = "agent" | "map" | "evidence"

export type AppTab = {
  id: AppTabId
  label: string
}

export const APP_TABS = [
  { id: "agent", label: "Агент в реальном времени" },
  { id: "map", label: "Историческое событие" },
  { id: "evidence", label: "Разбор и доказательства" },
] as const satisfies readonly AppTab[]

/** Вкладка по умолчанию: демо открывается картой (решение владельца продукта 06.08.2026). */
export const DEFAULT_TAB_ID: AppTabId = "map"

// Вкладка агента отложена прямым указанием владельца продукта («это пока
// не делай»). Строка описывает состояние честно: агент подключается к живым
// источникам, а на демо мы показываем разбор состоявшегося события. Выдуманной
// активности здесь нет и не будет — это запрет 1 CLAUDE.md.
export const AGENT_TAB_TITLE = "Агент реального времени"

export const AGENT_TAB_BODY =
  "Агент опрашивает публикации и бюллетени по мере их появления. Пока свежих поступлений нет, демонстрация идёт на состоявшемся событии — вкладка «Историческое событие»."
```

- [ ] **Step 2: Параметр вкладки в routing.ts**

Добавить в конец `apps/web/src/constants/routing.ts`:

```ts
// Вкладка живёт в URL рядом с `?incident=`: F5 на демо не должен сбрасывать
// показ, а «открой сразу карту» обязано быть ссылкой.
export const TAB_SEARCH_PARAM = "tab"
```

- [ ] **Step 3: Хук выбора вкладки**

Создать `apps/web/src/features/tabs/use-selected-tab.ts`:

```ts
import { useSearchParams } from "react-router-dom"

import { APP_TABS, DEFAULT_TAB_ID, type AppTabId } from "@/constants/tabs"
import { TAB_SEARCH_PARAM } from "@/constants/routing"

function isAppTabId(value: string | null): value is AppTabId {
  return APP_TABS.some((tab) => tab.id === value)
}

/**
 * Выбранная вкладка — из URL, как и выбранное событие (решение сессии 1).
 * Незнакомое значение параметра молча падает на вкладку по умолчанию:
 * чужая ссылка не должна показывать пустой экран.
 */
export function useSelectedTab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get(TAB_SEARCH_PARAM)
  const tabId = isAppTabId(raw) ? raw : DEFAULT_TAB_ID

  const selectTab = (id: AppTabId) => {
    setSearchParams(
      (params) => {
        params.set(TAB_SEARCH_PARAM, id)
        return params
      },
      // Переключение вкладки — не навигация по содержанию: замусоривать
      // историю «назад» им не нужно, в отличие от выбора события.
      { replace: true }
    )
  }

  return { tabId, selectTab }
}
```

- [ ] **Step 4: Таб-бар**

Создать `apps/web/src/features/tabs/TabBar.tsx`. Кнопки, а не ссылки: переключение вкладки меняет только один search-параметр, и `replace`-навигация уже сделана в хуке.

```tsx
import { APP_TABS, type AppTabId } from "@/constants/tabs"
import { cn } from "@/lib/utils"

type TabBarProps = {
  tabId: AppTabId
  onSelect: (id: AppTabId) => void
}

export function TabBar({ tabId, onSelect }: TabBarProps) {
  return (
    <nav aria-label="Разделы" className="flex gap-1 border-b px-4">
      {APP_TABS.map((tab) => {
        const isActive = tab.id === tabId
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors",
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 5: Заглушка вкладки агента**

Создать `apps/web/src/features/tabs/AgentTabPlaceholder.tsx`:

```tsx
import { AGENT_TAB_BODY, AGENT_TAB_TITLE } from "@/constants/tabs"

/**
 * Вкладка агента отложена владельцем продукта. Показываем состояние словами,
 * а не выдуманной активностью: имитация «агент сейчас ищет» была бы
 * выдуманными данными (запрет 1 CLAUDE.md).
 */
export function AgentTabPlaceholder() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="max-w-md space-y-2 text-center">
        <h2 className="text-sm font-medium">{AGENT_TAB_TITLE}</h2>
        <p className="text-sm text-muted-foreground">{AGENT_TAB_BODY}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Обёртка вкладок в App.tsx**

Переписать `apps/web/src/App.tsx`. Нынешний трёхколоночный экран целиком уезжает в `EvidenceTab` — ни одна строка его разметки не меняется. Шкала реплея остаётся только на вкладке разбора: реплей — механика доказательств, на карте ему делать нечего.

```tsx
import { AppHeader } from "@/components/layout/AppHeader"
import { ConclusionPanel } from "@/features/conclusion/ConclusionPanel"
import { SignalFeed } from "@/features/feed/SignalFeed"
import { MapTab } from "@/features/map/MapTab"
import { ReplayTimeline } from "@/features/replay/ReplayTimeline"
import { RiverScheme } from "@/features/river-scheme/RiverScheme"
import { AgentTabPlaceholder } from "@/features/tabs/AgentTabPlaceholder"
import { TabBar } from "@/features/tabs/TabBar"
import { useSelectedTab } from "@/features/tabs/use-selected-tab"

export function App() {
  const { tabId, selectTab } = useSelectedTab()

  return (
    <div className="grid h-svh grid-rows-[auto_auto_minmax(0,1fr)]">
      <AppHeader />
      <TabBar tabId={tabId} onSelect={selectTab} />
      {tabId === "agent" && <AgentTabPlaceholder />}
      {tabId === "map" && <MapTab />}
      {tabId === "evidence" && <EvidenceTab />}
    </div>
  )
}

/**
 * Нынешний экран ТЗ §13 без изменений: слева лента, в центре схема реки,
 * справа вывод, внизу шкала реплея.
 */
function EvidenceTab() {
  return (
    <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]">
      <main className="grid min-h-0 divide-y overflow-y-auto lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)_minmax(340px,400px)] lg:divide-x lg:divide-y-0 lg:overflow-y-hidden">
        <SignalFeed />
        <RiverScheme />
        <ConclusionPanel />
      </main>
      <ReplayTimeline />
    </div>
  )
}

export default App
```

- [ ] **Step 7: Временная заглушка MapTab, чтобы задача собиралась**

Создать `apps/web/src/features/map/MapTab.tsx` минимальным — содержимое приедет в задачах 2–7:

```tsx
export function MapTab() {
  return <div className="min-h-0 p-4" />
}
```

- [ ] **Step 8: Проверка**

```bash
npm run typecheck -w web && npm run lint -w web && npx prettier --check "apps/web/src/**/*.{ts,tsx,css}" && npm run build -w web
```

Затем в браузере (Playwright MCP, 1280×720): открыть `/`, убедиться, что открылась вкладка «Историческое событие»; перейти на «Разбор и доказательства» — три колонки и шкала реплея работают как раньше; проверить, что в URL появился `?tab=evidence` и **F5 оставляет ту же вкладку**; открыть `/?tab=agent` — видна строка-заглушка; открыть `/?tab=чушь` — падает на карту без ошибок в консоли.

- [ ] **Step 9: Коммит**

```bash
git add apps/web/src/constants/tabs.ts apps/web/src/constants/routing.ts apps/web/src/features/tabs apps/web/src/features/map apps/web/src/App.tsx
git commit -m "feat(tabs): три вкладки с состоянием в URL, разбор переезжает как есть"
```

---

### Task 2: Модель карты — чистая функция позиций

**Files:**
- Create: `apps/web/src/constants/map.ts`
- Create: `apps/web/src/features/map/map-model.ts`

**Interfaces:**
- Consumes: `IncidentDetail` из `@/api/contracts`, `buildSchemeModel` не используется (у карты своя геометрия).
- Produces: `buildMapModel(detail: IncidentDetail): MapModel`, типы `MapModel`, `MapStationNode`, `MapObjectMarker`.

- [ ] **Step 1: Константы карты**

Создать `apps/web/src/constants/map.ts`:

```ts
// Геометрия геосхемы в единицах viewBox. Карта не претендует на координаты:
// форма русла условна, а вертикаль — только порядок течения (ТЗ §17,
// решение сессии 1: линейная схема вместо карты, пока координат нет).
export const MAP_VIEWBOX_WIDTH = 100
export const MAP_VIEWBOX_HEIGHT = 220

/** Отступ сверху и снизу, чтобы участок «открыт вверх» было куда рисовать. */
export const MAP_PADDING_Y = 30

/** Горизонтальное положение русла в viewBox. */
export const MAP_RIVER_X = 42

export const MAP_CAPTION =
  "Географическая схема. Порядок створов подтверждён документами; точные координаты не переданы и на схеме не утверждаются."

export const MAP_CORRIDOR_OPEN_UPSTREAM_LABEL = "Участок открыт вверх по течению"

export const MAP_UNPLACED_TITLE = "Положение не подтверждено"

export const MAP_UNPLACED_NOTE =
  "Для этих створов и объектов место в цепочке течения не подтверждено документами, поэтому на схеме они не размещены."

export const MAP_CANDIDATE_LABEL = "объект для проверки"

/**
 * Основание, по которому объект размещается между створами: подписи створов
 * бюллетеня Казгидромета называют сброс по имени, и это проверенные данные
 * (стр. 22). Координат у объекта нет, поэтому положение выводится из подписей,
 * и это печатается пользователю в тултипе маркера, а не умалчивается.
 *
 * Регистр удаляется, когда бэк отдаст либо координаты объекта, либо
 * `candidateObjects[].stationId` в контракте (сейчас это поле живёт только
 * во входе расчётного ядра и в `IncidentDetail` не попадает).
 */
export const MAP_OBJECT_PLACEMENT: Record<
  string,
  { betweenStationIds: readonly [string, string]; basis: string }
> = {
  "obj-atyrau-su-arnasy": {
    betweenStationIds: ["st-asa-0-5km-above", "st-asa-0-5km-below"],
    basis:
      "Положение выведено из подписей створов бюллетеня Казгидромета («0,5 км выше сброса» и «0,5 км ниже сброса», стр. 22), а не из координат.",
  },
}
```

- [ ] **Step 2: Модель**

Создать `apps/web/src/features/map/map-model.ts`:

```ts
import type { IncidentDetail } from "@/api/contracts"
import {
  MAP_OBJECT_PLACEMENT,
  MAP_PADDING_Y,
  MAP_VIEWBOX_HEIGHT,
} from "@/constants/map"
import type {
  CandidateObject,
  Measurement,
  SourceDocument,
  Station,
} from "@/types"

export type MapStationNode = {
  station: Station
  measurement: Measurement | null
  sourceDocument: SourceDocument | null
  /** Координата Y в единицах viewBox: меньше — выше по течению. */
  y: number
}

export type MapObjectMarker = {
  object: CandidateObject
  y: number
  basis: string
  /** Объект лежит внутри участка. false — участок его не включает. */
  insideCorridor: boolean
}

export type MapModel = {
  nodes: MapStationNode[]
  markers: MapObjectMarker[]
  /** Створы и объекты, чьё место в цепочке не подтверждено. */
  unplacedStations: Station[]
  unplacedObjects: CandidateObject[]
  /** Верх участка в viewBox; null — участок открыт вверх (границы нет). */
  corridorTopY: number | null
  /** Низ участка в viewBox; null — участка нет вовсе. */
  corridorBottomY: number | null
  commonUnit: string | null
}

/**
 * Чистая подготовка геометрии. Никаких выводов: участок приходит границами
 * (`corridorBounds`), порядок — подтверждённым `riverOrder`. Всё, что фронт
 * здесь делает, — раскладывает уже принятые бэком факты по вертикали.
 */
export function buildMapModel(detail: IncidentDetail): MapModel {
  const documentsById = new Map(
    detail.sourceDocuments.map((document) => [document.id, document])
  )

  const ordered = detail.stations
    .filter((station) => station.riverOrder !== null)
    .sort((a, b) => (a.riverOrder ?? 0) - (b.riverOrder ?? 0))

  const step =
    ordered.length > 1
      ? (MAP_VIEWBOX_HEIGHT - MAP_PADDING_Y * 2) / (ordered.length - 1)
      : 0

  const nodes: MapStationNode[] = ordered.map((station, index) => {
    const measurement =
      detail.measurements.find((m) => m.stationId === station.id) ?? null
    return {
      station,
      measurement,
      sourceDocument: measurement
        ? (documentsById.get(measurement.sourceDocumentId) ?? null)
        : null,
      y: MAP_PADDING_Y + step * index,
    }
  })

  const yByStationId = new Map(nodes.map((node) => [node.station.id, node.y]))
  const bounds = detail.corridorBounds
  const corridorTopY = bounds?.upstreamStationId
    ? (yByStationId.get(bounds.upstreamStationId) ?? null)
    : null
  const corridorBottomY = bounds
    ? (yByStationId.get(bounds.downstreamStationId) ?? null)
    : null

  const markers: MapObjectMarker[] = []
  const unplacedObjects: CandidateObject[] = []

  for (const object of detail.candidateObjects) {
    const placement = MAP_OBJECT_PLACEMENT[object.id]
    const first = placement && yByStationId.get(placement.betweenStationIds[0])
    const second = placement && yByStationId.get(placement.betweenStationIds[1])

    // Разместить объект можно, только если ОБА опорных створа есть в событии
    // и оба имеют подтверждённый порядок. Иначе честнее сказать «не знаем».
    if (placement && first !== undefined && second !== undefined) {
      const y = (first + second) / 2
      markers.push({
        object,
        y,
        basis: placement.basis,
        insideCorridor:
          corridorBottomY !== null &&
          y <= corridorBottomY &&
          (corridorTopY === null || y >= corridorTopY),
      })
    } else {
      unplacedObjects.push(object)
    }
  }

  const [firstMeasurement, ...restMeasurements] = detail.measurements
  const commonUnit =
    firstMeasurement &&
    restMeasurements.every((m) => m.unit === firstMeasurement.unit)
      ? firstMeasurement.unit
      : null

  return {
    nodes,
    markers,
    unplacedStations: detail.stations.filter(
      (station) => station.riverOrder === null
    ),
    unplacedObjects,
    corridorTopY,
    corridorBottomY,
    commonUnit,
  }
}
```

- [ ] **Step 3: Проверка модели на реальных данных**

Ожидаемое для сентября (`inv-atyrau-2025-09`): `nodes.length === 4`, порядок сверху вниз — «1 км выше Атырау», «0,5 км выше сброса», «0,5 км ниже сброса», «1 км ниже Атырау»; `corridorTopY === null` (участок открыт вверх), `corridorBottomY === 30` (y створа `riverOrder: 0`); `markers.length === 1` с `object.id === "obj-atyrau-su-arnasy"` и **`insideCorridor === false`** — объект ниже нижней границы участка; `unplacedStations.length === 3`; `unplacedObjects.length === 1` («Осетровый завод»).

Ожидаемое для мая: `nodes.length === 2`, `corridorTopY` и `corridorBottomY` заданы обоими створами, маркер один и `insideCorridor === true`.

Ожидаемое для Актау: `nodes.length === 0`, `markers.length === 0`.

Проверить типами и сборкой:

```bash
npm run typecheck -w web && npm run lint -w web && npm run build -w web
```

- [ ] **Step 4: Коммит**

```bash
git add apps/web/src/constants/map.ts apps/web/src/features/map/map-model.ts
git commit -m "feat(map): модель геосхемы — позиции створов, участка и объектов"
```

---

### Task 3: SVG-геосхема — русло, створы, значения

**Files:**
- Create: `apps/web/src/features/map/RiverPath.tsx`
- Create: `apps/web/src/features/map/MapStation.tsx`
- Create: `apps/web/src/features/map/GeoSchemeMap.tsx`
- Modify: `apps/web/src/features/map/MapTab.tsx`

**Interfaces:**
- Consumes: `buildMapModel`, `MapModel`, `MapStationNode` (Task 2); константы Task 2.
- Produces: `<GeoSchemeMap model={MapModel} />`, `<MapTab />` с реальным содержимым.

- [ ] **Step 1: Русло**

Создать `apps/web/src/features/map/RiverPath.tsx`. Кривая рисуется один раз и не зависит от данных — это декорация, поэтому `aria-hidden`.

```tsx
import { MAP_RIVER_X, MAP_VIEWBOX_HEIGHT } from "@/constants/map"

/**
 * Русло — декоративная кривая. Форма условна и ничего не утверждает
 * о географии; оговорка стоит подписью под картой (MAP_CAPTION).
 */
export function RiverPath() {
  const d = `M ${MAP_RIVER_X} 0
    C ${MAP_RIVER_X - 10} ${MAP_VIEWBOX_HEIGHT * 0.25},
      ${MAP_RIVER_X + 10} ${MAP_VIEWBOX_HEIGHT * 0.5},
      ${MAP_RIVER_X - 4} ${MAP_VIEWBOX_HEIGHT * 0.75}
    S ${MAP_RIVER_X + 2} ${MAP_VIEWBOX_HEIGHT},
      ${MAP_RIVER_X} ${MAP_VIEWBOX_HEIGHT}`

  return (
    <path
      aria-hidden
      d={d}
      fill="none"
      className="stroke-border"
      strokeWidth={3}
      strokeLinecap="round"
    />
  )
}
```

- [ ] **Step 2: Створ на карте**

Создать `apps/web/src/features/map/MapStation.tsx`. Значение остаётся кликабельным `MeasurementValue` — критерий §16 п.5 действует и на карте.

```tsx
import { MeasurementValue } from "@/components/common/MeasurementValue"
import { MAP_RIVER_X } from "@/constants/map"
import type { MapStationNode } from "./map-model"

type MapStationProps = {
  node: MapStationNode
  showUnit: boolean
}

export function MapStation({ node, showUnit }: MapStationProps) {
  return (
    <g>
      <circle
        cx={MAP_RIVER_X}
        cy={node.y}
        r={2.5}
        className="fill-background stroke-foreground"
        strokeWidth={1.5}
      />
      <foreignObject
        x={MAP_RIVER_X + 5}
        y={node.y - 7}
        width={56}
        height={16}
        className="overflow-visible"
      >
        <div className="flex items-baseline gap-1.5 text-[5px] leading-tight">
          <span className="truncate text-muted-foreground">
            {node.station.name}
          </span>
          {node.measurement && (
            <MeasurementValue
              measurement={node.measurement}
              sourceDocument={node.sourceDocument}
              showUnit={showUnit}
            />
          )}
        </div>
      </foreignObject>
    </g>
  )
}
```

Если `MeasurementValue` внутри `foreignObject` даёт проблемы с тултипом Base UI, подписи выносятся из SVG в абсолютно позиционированный слой поверх него — координата Y уже посчитана моделью, пересчёт не нужен. Решение принимается на шаге проверки.

- [ ] **Step 3: Сборка карты**

Создать `apps/web/src/features/map/GeoSchemeMap.tsx`:

```tsx
import {
  MAP_CAPTION,
  MAP_VIEWBOX_HEIGHT,
  MAP_VIEWBOX_WIDTH,
} from "@/constants/map"
import { MapStation } from "./MapStation"
import { RiverPath } from "./RiverPath"
import type { MapModel } from "./map-model"

export function GeoSchemeMap({ model }: { model: MapModel }) {
  return (
    <figure className="flex min-h-0 flex-1 flex-col gap-2">
      <svg
        role="img"
        aria-label="Географическая схема участка реки со створами наблюдений"
        viewBox={`0 0 ${MAP_VIEWBOX_WIDTH} ${MAP_VIEWBOX_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="min-h-0 flex-1"
      >
        <RiverPath />
        {model.nodes.map((node) => (
          <MapStation
            key={node.station.id}
            node={node}
            showUnit={model.commonUnit === null}
          />
        ))}
      </svg>
      <figcaption className="text-center text-xs text-muted-foreground">
        {MAP_CAPTION}
      </figcaption>
    </figure>
  )
}
```

- [ ] **Step 4: MapTab на реальных данных**

Переписать `apps/web/src/features/map/MapTab.tsx`. Событие без створов отдаёт существующий экран «недостаточно данных» — пустая карта читалась бы как поломка (решение сессии 8).

```tsx
import { useMemo } from "react"

import { DATA_LOAD_ERROR } from "@/constants/strings"
import { InsufficientDataScreen } from "@/features/aktau/InsufficientDataScreen"
import { useSelectedIncidentDetail } from "@/hooks/use-selected-incident-detail"
import { GeoSchemeMap } from "./GeoSchemeMap"
import { buildMapModel } from "./map-model"

export function MapTab() {
  const { detail, isError } = useSelectedIncidentDetail()
  const model = useMemo(() => (detail ? buildMapModel(detail) : null), [detail])

  if (isError) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">{DATA_LOAD_ERROR}</p>
      </div>
    )
  }
  if (!detail || !model) return <div className="min-h-0 flex-1" />
  if (detail.stations.length === 0) {
    return <InsufficientDataScreen detail={detail} />
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
      <GeoSchemeMap model={model} />
    </div>
  )
}
```

- [ ] **Step 5: Проверка**

Прогнать команду проверки. В браузере: `/?tab=map` показывает русло и четыре створа сверху вниз в порядке «1 км выше Атырау» → «0,5 выше сброса» → «0,5 ниже сброса» → «1 км ниже Атырау»; значения кликабельны и ведут на `#page=22`; `/?tab=map&incident=inv-aktau-insufficient` показывает экран «недостаточно данных», а не пустую карту; горизонтальной прокрутки нет на 1280×720 и 1440×900; в консоли только `STUB:`-варны.

- [ ] **Step 6: Коммит**

```bash
git add apps/web/src/features/map
git commit -m "feat(map): геосхема — русло, створы и кликабельные значения"
```

---

### Task 4: Участок-коридор с открытой верхней границей

**Files:**
- Create: `apps/web/src/features/map/MapCorridor.tsx`
- Modify: `apps/web/src/features/map/GeoSchemeMap.tsx`

**Interfaces:**
- Consumes: `MapModel.corridorTopY`, `MapModel.corridorBottomY` (Task 2).
- Produces: `<MapCorridor topY={number | null} bottomY={number} />`.

- [ ] **Step 1: Лента участка**

Создать `apps/web/src/features/map/MapCorridor.tsx`. Открытый вверх интервал растворяется маской, а не обрывается рамкой: срезанная верхняя грань читается как дефект вёрстки (решение сессии 16).

```tsx
import {
  MAP_CORRIDOR_OPEN_UPSTREAM_LABEL,
  MAP_RIVER_X,
} from "@/constants/map"

type MapCorridorProps = {
  /** null — участок открыт вверх по течению, верхней границы нет. */
  topY: number | null
  bottomY: number
}

const MASK_ID = "map-corridor-fade"
const BAND_HALF_WIDTH = 9

export function MapCorridor({ topY, bottomY }: MapCorridorProps) {
  const isOpenUpstream = topY === null
  const y = isOpenUpstream ? 0 : topY
  const height = bottomY - y

  return (
    <g>
      <defs>
        <linearGradient id={`${MASK_ID}-gradient`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity={isOpenUpstream ? 0 : 1} />
          <stop offset="35%" stopColor="white" stopOpacity={1} />
          <stop offset="100%" stopColor="white" stopOpacity={1} />
        </linearGradient>
        <mask id={MASK_ID}>
          <rect
            x={MAP_RIVER_X - BAND_HALF_WIDTH}
            y={y}
            width={BAND_HALF_WIDTH * 2}
            height={height}
            fill={`url(#${MASK_ID}-gradient)`}
          />
        </mask>
      </defs>
      <rect
        x={MAP_RIVER_X - BAND_HALF_WIDTH}
        y={y}
        width={BAND_HALF_WIDTH * 2}
        height={height}
        mask={`url(#${MASK_ID})`}
        className="fill-foreground/10"
      />
      {isOpenUpstream && (
        <text
          x={MAP_RIVER_X - BAND_HALF_WIDTH - 2}
          y={6}
          textAnchor="end"
          className="fill-muted-foreground text-[4.5px]"
        >
          {MAP_CORRIDOR_OPEN_UPSTREAM_LABEL}
        </text>
      )}
    </g>
  )
}
```

- [ ] **Step 2: Включить в карту**

В `GeoSchemeMap.tsx` вставить между `<RiverPath />` и списком створов:

```tsx
{model.corridorBottomY !== null && (
  <MapCorridor topY={model.corridorTopY} bottomY={model.corridorBottomY} />
)}
```

и добавить импорт `import { MapCorridor } from "./MapCorridor"`.

- [ ] **Step 3: Проверка**

Прогнать команду проверки. В браузере: у сентября лента идёт от верхнего края до створа «1 км выше Атырау» и кверху растворяется, рядом подпись «Участок открыт вверх по течению»; у мая (`?tab=map&incident=inv-atyrau-2025-05`) лента зажата между двумя створами и растворения сверху нет; в тёмной теме лента видна.

- [ ] **Step 4: Коммит**

```bash
git add apps/web/src/features/map
git commit -m "feat(map): участок на схеме, открытый вверх растворяется маской"
```

---

### Task 5: Объект для проверки и блок «положение не подтверждено»

**Files:**
- Create: `apps/web/src/features/map/MapObjectMarker.tsx`
- Create: `apps/web/src/features/map/UnplacedList.tsx`
- Modify: `apps/web/src/features/map/GeoSchemeMap.tsx`
- Modify: `apps/web/src/features/map/MapTab.tsx`

**Interfaces:**
- Consumes: `MapModel.markers`, `MapModel.unplacedStations`, `MapModel.unplacedObjects` (Task 2), `MAP_CANDIDATE_LABEL`, `MAP_UNPLACED_TITLE`, `MAP_UNPLACED_NOTE` (Task 2).
- Produces: `<MapObjectMarker marker={MapObjectMarker} />`, `<UnplacedList stations={Station[]} objects={CandidateObject[]} />`.

- [ ] **Step 1: Маркер объекта**

Создать `apps/web/src/features/map/MapObjectMarker.tsx`. Имя объекта печатается ТОЛЬКО с подписью «объект для проверки»; в тултипе — основание положения. Никакой оценки объекта здесь нет и быть не может.

```tsx
import { Tooltip } from "@/components/ui/tooltip"
import { MAP_CANDIDATE_LABEL, MAP_RIVER_X } from "@/constants/map"
import type { MapObjectMarker as MapObjectMarkerModel } from "./map-model"

export function MapObjectMarker({
  marker,
}: {
  marker: MapObjectMarkerModel
}) {
  return (
    <g>
      <rect
        x={MAP_RIVER_X - 12}
        y={marker.y - 2}
        width={4}
        height={4}
        className="fill-background stroke-foreground"
        strokeWidth={1}
      />
      <foreignObject
        x={MAP_RIVER_X - 46}
        y={marker.y - 9}
        width={34}
        height={18}
        className="overflow-visible"
      >
        <Tooltip content={marker.basis}>
          <div className="cursor-help text-right text-[4.5px] leading-tight">
            <p className="truncate font-medium">{marker.object.name}</p>
            <p className="text-muted-foreground">{MAP_CANDIDATE_LABEL}</p>
          </div>
        </Tooltip>
      </foreignObject>
    </g>
  )
}
```

Точный API `Tooltip` сверить по `apps/web/src/components/ui/tooltip.tsx` — Base UI, не Radix: композиция через проп `render`, части `Popup`/`Backdrop`. Если обёртка в проекте называется иначе, использовать её сигнатуру, а не эту.

- [ ] **Step 2: Список неразмещённых**

Создать `apps/web/src/features/map/UnplacedList.tsx`:

```tsx
import { MAP_UNPLACED_NOTE, MAP_UNPLACED_TITLE } from "@/constants/map"
import type { CandidateObject, Station } from "@/types"

type UnplacedListProps = {
  stations: Station[]
  objects: CandidateObject[]
}

/**
 * Створы и объекты, чьё место в цепочке течения не подтверждено. На схему их
 * ставить нельзя, не выдумав положение (запрет 2 CLAUDE.md), поэтому вместо
 * этого прямо говорим, что не знаем.
 */
export function UnplacedList({ stations, objects }: UnplacedListProps) {
  if (stations.length === 0 && objects.length === 0) return null

  return (
    <section className="space-y-1 border-l pl-3">
      <h3 className="text-xs font-medium">{MAP_UNPLACED_TITLE}</h3>
      <p className="text-xs text-muted-foreground">{MAP_UNPLACED_NOTE}</p>
      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {objects.map((object) => (
          <li key={object.id}>{object.name}</li>
        ))}
        {stations.map((station) => (
          <li key={station.id}>{station.name}</li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 3: Включить маркеры в карту, список — в MapTab**

В `GeoSchemeMap.tsx` после списка створов:

```tsx
{model.markers.map((marker) => (
  <MapObjectMarker key={marker.object.id} marker={marker} />
))}
```

В `MapTab.tsx` рядом с картой:

```tsx
<div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
  <GeoSchemeMap model={model} />
  <UnplacedList
    stations={model.unplacedStations}
    objects={model.unplacedObjects}
  />
</div>
```

- [ ] **Step 4: Проверка**

Прогнать команду проверки. В браузере на сентябре: маркер «КГП „Атырау су арнасы“» стоит слева от русла между створами «0,5 выше сброса» и «0,5 ниже сброса», то есть **визуально ниже ленты участка**; под именем подпись «объект для проверки»; тултип показывает основание положения. В блоке справа — «Осетровый завод» и три створа без порядка. Проверить, что имя объекта нигде не встречается без подписи «объект для проверки».

- [ ] **Step 5: Коммит**

```bash
git add apps/web/src/features/map
git commit -m "feat(map): объект для проверки на схеме и блок «положение не подтверждено»"
```

---

### Task 6: Заключение поверх карты

**Files:**
- Create: `apps/web/src/features/map/MapVerdict.tsx`
- Modify: `apps/web/src/constants/map.ts`
- Modify: `apps/web/src/features/map/MapTab.tsx`

**Interfaces:**
- Consumes: `IncidentDetail`, `EVIDENCE_LEVEL_META`, существующий `EvidenceLevelBadge`, `dossierPath` из `@/constants/routing`.
- Produces: `<MapVerdict detail={IncidentDetail} corridorLabel={string | null} onOpenEvidence={() => void} />`.

- [ ] **Step 1: Строки заключения**

Добавить в `apps/web/src/constants/map.ts`:

```ts
export const MAP_VERDICT_CORRIDOR_PREFIX = "Участок:"

export const MAP_VERDICT_OPEN_UPSTREAM = "выше створа"

export const MAP_VERDICT_EXCLUDED_PREFIX = "Исключено фактами:"

export const MAP_VERDICT_EVIDENCE_LINK = "Разбор и доказательства"
```

- [ ] **Step 2: Карточка заключения**

Создать `apps/web/src/features/map/MapVerdict.tsx`. Процента здесь нет: система его не вычисляет, а придуманный процент рядом с именем компании — это обвинение без основания.

```tsx
import { Link } from "react-router-dom"

import { EvidenceLevelBadge } from "@/components/common/EvidenceLevelBadge"
import { buttonVariants } from "@/components/ui/button"
import type { IncidentDetail } from "@/api/contracts"
import {
  MAP_VERDICT_CORRIDOR_PREFIX,
  MAP_VERDICT_EVIDENCE_LINK,
  MAP_VERDICT_EXCLUDED_PREFIX,
} from "@/constants/map"
import { dossierPath } from "@/constants/routing"

type MapVerdictProps = {
  detail: IncidentDetail
  /** Готовая подпись участка; null — участка нет. */
  corridorLabel: string | null
  onOpenEvidence: () => void
}

export function MapVerdict({
  detail,
  corridorLabel,
  onOpenEvidence,
}: MapVerdictProps) {
  const { investigation } = detail
  const excludedCount = investigation.contradictedHypotheses.length

  return (
    <aside className="pointer-events-auto max-w-sm space-y-2 rounded-lg border bg-background/95 p-3 shadow-sm">
      <EvidenceLevelBadge level={investigation.evidenceLevel} />
      {corridorLabel && (
        <p className="text-sm">
          <span className="text-muted-foreground">
            {MAP_VERDICT_CORRIDOR_PREFIX}{" "}
          </span>
          {corridorLabel}
        </p>
      )}
      {excludedCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {MAP_VERDICT_EXCLUDED_PREFIX} {excludedCount}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onOpenEvidence}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {MAP_VERDICT_EVIDENCE_LINK}
        </button>
        <Link
          to={dossierPath(investigation.id)}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Досье
        </Link>
      </div>
    </aside>
  )
}
```

Навигация — `Link` + `buttonVariants`, а не `Button render={<Link/>}`: Base UI вешает на такой `<a>` `role="button"` и ломает «открыть в новой вкладке» (решение сессии 12).

- [ ] **Step 3: Подпись участка и включение в MapTab**

В `MapTab.tsx` собрать подпись участка из имён створов границ и передать `onOpenEvidence`, который зовёт `selectTab("evidence")` из `useSelectedTab`. Подпись: при `corridorTopY === null` — «выше створа «<имя нижней границы>»», иначе «между «<верх>» и «<низ>»». Имена берутся из `model.nodes` по `detail.corridorBounds`; в кавычки имена створов не берутся дважды — у них уже есть свои (решение сессии 12).

Карточка позиционируется поверх карты: контейнер карты получает `relative`, карточка — `absolute top-4 left-4 pointer-events-none` на обёртке и `pointer-events-auto` на самой карточке.

- [ ] **Step 4: Проверка**

Прогнать команду проверки. В браузере: на сентябре карточка показывает «L2 · Источник локализован до участка», строку участка «выше створа «1 км выше Атырау»» и «Исключено фактами: 2»; кнопка «Разбор и доказательства» переключает вкладку и меняет URL; «Досье» открывает `/dossier/inv-atyrau-2025-09`; на майском событии строка исключённых версий отсутствует (их ноль); карточка не перекрывает створы на 1280×720.

- [ ] **Step 5: Коммит**

```bash
git add apps/web/src/features/map apps/web/src/constants/map.ts
git commit -m "feat(map): заключение поверх карты — уровень, участок, исключённые версии"
```

---

### Task 7: Анимация сноса вниз по течению

**Files:**
- Create: `apps/web/src/features/map/FlowAnimation.tsx`
- Modify: `apps/web/src/features/map/GeoSchemeMap.tsx`
- Modify: `apps/web/src/index.css`

**Interfaces:**
- Consumes: `usePrefersReducedMotion` из `@/hooks/use-prefers-reduced-motion` (есть с сессии 17).
- Produces: `<FlowAnimation />`.

Делается последней: карта без неё полноценна.

- [ ] **Step 1: Ключевые кадры**

Добавить в `apps/web/src/index.css` рядом с существующими анимациями:

```css
@keyframes map-flow-drift {
  from {
    stroke-dashoffset: 24;
  }
  to {
    stroke-dashoffset: 0;
  }
}
```

Существующий блок `@media (prefers-reduced-motion: reduce)` уже обнуляет длительности — отдельного правила не нужно, но проверить, что он покрывает и эту анимацию.

- [ ] **Step 2: Слой частиц**

Создать `apps/web/src/features/map/FlowAnimation.tsx`. Тот же путь, что у русла, но пунктиром, который ползёт вниз.

```tsx
import { MAP_RIVER_X, MAP_VIEWBOX_HEIGHT } from "@/constants/map"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"

/**
 * Снос вниз по течению: перенос идёт сверху вниз, поэтому источник ищут выше.
 * При prefers-reduced-motion движение гаснет, направление остаётся пунктиром —
 * это содержание, а не украшение (решение сессии 17).
 */
export function FlowAnimation() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const d = `M ${MAP_RIVER_X} 0
    C ${MAP_RIVER_X - 10} ${MAP_VIEWBOX_HEIGHT * 0.25},
      ${MAP_RIVER_X + 10} ${MAP_VIEWBOX_HEIGHT * 0.5},
      ${MAP_RIVER_X - 4} ${MAP_VIEWBOX_HEIGHT * 0.75}
    S ${MAP_RIVER_X + 2} ${MAP_VIEWBOX_HEIGHT},
      ${MAP_RIVER_X} ${MAP_VIEWBOX_HEIGHT}`

  return (
    <path
      aria-hidden
      d={d}
      fill="none"
      className="stroke-muted-foreground/50"
      strokeWidth={1}
      strokeDasharray="3 9"
      style={
        prefersReducedMotion
          ? undefined
          : { animation: "map-flow-drift 4s linear infinite" }
      }
    />
  )
}
```

Путь дублируется с `RiverPath` — вынести его в общую константу `MAP_RIVER_PATH_D` в `constants/map.ts` и импортировать в обоих компонентах, чтобы кривая не разъехалась.

- [ ] **Step 3: Включить в карту**

В `GeoSchemeMap.tsx` сразу после `<RiverPath />`:

```tsx
<FlowAnimation />
```

- [ ] **Step 4: Проверка**

Прогнать команду проверки. В браузере: пунктир ползёт сверху вниз; при включённом `prefers-reduced-motion` (эмуляция в devtools) движение остановлено, пунктир виден; частота кадров не проседает при переключении вкладок.

- [ ] **Step 5: Коммит**

```bash
git add apps/web/src/features/map apps/web/src/index.css apps/web/src/constants/map.ts
git commit -m "feat(map): снос вниз по течению, гаснет при prefers-reduced-motion"
```

---

### Task 8: Дев-превью, финальная проверка, документы

**Files:**
- Create: `apps/web/src/dev/MapGallery.tsx`
- Modify: `apps/web/src/router.tsx`
- Modify: `docs/frontend-plan.md`
- Modify: `docs/decisions.md`
- Modify: `docs/rollback-map-tabs.md` (проставить хэши коммитов)

- [ ] **Step 1: Дев-превью**

Создать `apps/web/src/dev/MapGallery.tsx` по образцу `RiverSchemeGallery.tsx`: три кадра — сентябрь (участок открыт вверх, объект ниже участка), май (участок между парой, объект внутри), Актау (экран «недостаточно данных»). Галерея импортирует `seed-data` напрямую, минуя api-заглушки, — без ложных `STUB:`-варнов.

- [ ] **Step 2: Маршрут дев-превью**

В `apps/web/src/router.tsx` внутрь блока `if (import.meta.env.DEV)`:

```tsx
const MapGallery = lazy(() => import("@/dev/MapGallery"))
routes.push({ path: "/dev/map", element: <MapGallery /> })
```

- [ ] **Step 3: Полная проверка**

```bash
npm run typecheck -w web && npm run lint -w web && npx prettier --check "apps/web/src/**/*.{ts,tsx,css}" && npm run build -w web
```

Убедиться, что чанк галереи в прод-бандл не попал (по выводу `vite build`), и записать новый размер бандла для плана.

В браузере на 1280×720 и 1440×900, светлая и тёмная темы: все три вкладки; F5 на каждой; `?tab=map&incident=` для всех трёх событий; переход «карта → разбор → досье → назад»; горизонтальной прокрутки нет; консоль без ошибок.

- [ ] **Step 4: Документы**

В `docs/frontend-plan.md` — блок сессии 19 наверх: повод, что сделано, что осознанно не сделано (процент, MapLibre, вкладка агента), замеры, следующая задача. В `docs/decisions.md` — решения сессии 19: вкладка в URL, геосхема вместо MapLibre с тремя причинами, замена процента на «внутри участка / вне участка», положение объекта из подписей створов с печатью основания, реплей остаётся только на вкладке разбора. В `docs/rollback-map-tabs.md` — проставить хэши первого и последнего коммита работы.

- [ ] **Step 5: Коммит**

```bash
git add apps/web/src/dev apps/web/src/router.tsx docs
git commit -m "docs: итоги сессии 19 — карта, вкладки и дев-превью"
```

---

## Самопроверка плана

**Покрытие спеки.** Вкладки и URL — Task 1. Карта, слои 1–2 — Task 3. Слой 3 (участок) — Task 4. Слои 4–5 (объект, неразмещённые) — Task 5. Заключение — Task 6. Анимация — Task 7. Пустые состояния и ошибки — Task 3 (шаг 4). Данные без новых запросов — Task 2. Откат — Task 8 (хэши). Проверка — в каждой задаче.

**Заглушек нет:** каждый шаг с кодом содержит код; два места помечены как требующие сверки с существующим API (`Tooltip` в Task 5, `foreignObject` в Task 3) — там указано, по какому файлу сверять и какое запасное решение брать.

**Согласованность типов:** `MapModel`, `MapStationNode`, `MapObjectMarker` объявлены в Task 2 и используются под теми же именами в Tasks 3–6. `MAP_RIVER_PATH_D` вводится в Task 7 и заменяет дубль пути в `RiverPath` — отмечено явно.
