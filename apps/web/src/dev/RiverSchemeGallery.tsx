import type { ReactNode } from "react"

import type { IncidentDetail } from "@/api/contracts"
import { incidentDetails } from "@/api/seed-data"
import { RiverSchemeContent } from "@/features/river-scheme/RiverScheme"

// Дев-превью линейной схемы (только dev-сборка, см. router.tsx). Ветка с линией
// в данных недостижима, пока riverOrder = null (вопрос 1 плана), поэтому здесь
// станциям присваивается УСЛОВНЫЙ порядок — номер строки в таблице бюллетеня
// ТЗ §5. Это разметка для проверки вёрстки линии и коридора, а не утверждение
// о реальном порядке створов по течению.

const september = incidentDetails["inv-atyrau-2025-09"]
const may = incidentDetails["inv-atyrau-2025-05"]
const aktau = incidentDetails["inv-aktau-insufficient"]

function withProvisionalOrder(detail: IncidentDetail): IncidentDetail {
  return {
    ...detail,
    stations: detail.stations.map((station, index) => ({
      ...station,
      riverOrder: index + 1,
    })),
  }
}

function SchemeFrame({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        {title}
      </h2>
      <div className="flex h-[26rem] flex-col overflow-hidden border">
        {children}
      </div>
    </section>
  )
}

export default function RiverSchemeGallery() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <header>
        <h1 className="text-sm font-semibold tracking-[0.14em] uppercase">
          Дев-превью: линейная схема реки
        </h1>
        <p className="text-xs text-pretty text-muted-foreground">
          Только dev-сборка. «Условный порядок» — номера строк таблицы ТЗ §5
          исключительно для проверки вёрстки; порядок створов по течению не
          подтверждён.
        </p>
      </header>

      <SchemeFrame title="Сентябрь — как в данных: порядок не подтверждён">
        <RiverSchemeContent detail={september} />
      </SchemeFrame>

      <SchemeFrame title="Сентябрь — условный порядок: линия, коридор открыт вверх">
        <RiverSchemeContent detail={withProvisionalOrder(september)} />
      </SchemeFrame>

      <SchemeFrame title="Май — условный порядок: коридор между парой створов">
        <RiverSchemeContent detail={withProvisionalOrder(may)} />
      </SchemeFrame>

      <SchemeFrame title="Актау — недостаточно данных">
        <RiverSchemeContent detail={aktau} />
      </SchemeFrame>
    </main>
  )
}
