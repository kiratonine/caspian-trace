import type { ReactNode } from "react"

import type { SourceHealthItem } from "@/api/contracts"
import { liveStatusSeed } from "@/api/seed-data"
import { DataModeNotice } from "@/features/live-status/DataModeNotice"
import { LiveStatusIndicator } from "@/features/live-status/LiveStatusIndicator"
import { SourceStatusList } from "@/features/live-status/SourceStatusList"

// Дев-превью состояний источников (только dev-сборка, см. router.tsx).
// В фикстуре все четыре источника — `never_run` без кэша, поэтому healthy /
// degraded / rate_limited / failed проверяются на ЯВНО синтетическом списке:
// это разметка для вёрстки, а не данные. Придумывать «зелёные» источники
// в seed-данных нельзя — экран показывал бы опросы, которых не было.

const SYNTHETIC_SOURCES: SourceHealthItem[] = [
  {
    id: "demo-healthy",
    name: "Пример: источник отвечает",
    lastSuccessAt: "2026-08-05T09:12:00+05:00",
    cacheAvailable: true,
    status: "healthy",
  },
  {
    id: "demo-degraded",
    name: "Пример: источник отвечает с перебоями",
    lastSuccessAt: "2026-08-05T06:40:00+05:00",
    cacheAvailable: true,
    status: "degraded",
  },
  {
    id: "demo-rate-limited",
    name: "Пример: источник ограничил частоту запросов",
    lastSuccessAt: "2026-08-04T21:05:00+05:00",
    cacheAvailable: true,
    status: "rate_limited",
  },
  {
    id: "demo-failed",
    name: "Пример: источник недоступен, кэша нет",
    lastSuccessAt: null,
    cacheAvailable: false,
    status: "failed",
  },
]

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        {title}
      </h2>
      <div className="w-96 max-w-full border p-2.5 text-xs">{children}</div>
    </section>
  )
}

export default function LiveStatusGallery() {
  return (
    <main className="flex flex-col gap-6 p-8">
      <header>
        <h1 className="text-sm font-semibold tracking-[0.14em] uppercase">
          Дев-превью: состояние источников
        </h1>
        <p className="max-w-2xl text-xs text-pretty text-muted-foreground">
          Только dev-сборка. Клавиша D переключает тему. Состояния healthy /
          degraded / rate_limited / failed показаны на синтетическом списке — в
          проверенных данных все источники ни разу не опрашивались.
        </p>
      </header>

      <div className="flex flex-wrap items-start gap-6">
        <Frame title="Индикатор шапки — реальные данные, клик открывает поповер">
          <div className="flex justify-end">
            <LiveStatusIndicator />
          </div>
        </Frame>
        <Frame title="Фикстура: четыре источника, ни одного опроса">
          <SourceStatusList sources={liveStatusSeed.sources} />
        </Frame>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <Frame title="Синтетический список: четыре остальных состояния">
          <SourceStatusList sources={SYNTHETIC_SOURCES} />
        </Frame>
        <Frame title="Пустой список источников">
          <SourceStatusList sources={[]} />
        </Frame>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <Frame title="Режим данных: seed (текущий)">
          <DataModeNotice mode="seed" />
        </Frame>
        <Frame title="Режим данных: api (после подключения бэка)">
          <DataModeNotice mode="api" />
        </Frame>
      </div>
    </main>
  )
}
