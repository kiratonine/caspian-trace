import type { ReactNode } from "react"

import { incidentDetails } from "@/api/seed-data"
import { ConclusionPanelContent } from "@/features/conclusion/ConclusionPanel"

// Дев-превью правой панели (только dev-сборка, см. router.tsx): все три события
// заглушек в ширине реальной колонки (340–400px), включая пустые состояния
// Актау. Данные — seed ТЗ §5/§7, ничего выдуманного.

const september = incidentDetails["inv-atyrau-2025-09"]
const may = incidentDetails["inv-atyrau-2025-05"]
const aktau = incidentDetails["inv-aktau-insufficient"]

function PanelFrame({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex shrink-0 flex-col gap-2">
      <h2 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        {title}
      </h2>
      <div className="w-95 overflow-hidden border">{children}</div>
    </section>
  )
}

export default function ConclusionGallery() {
  return (
    <main className="flex flex-col gap-6 p-8">
      <header>
        <h1 className="text-sm font-semibold tracking-[0.14em] uppercase">
          Дев-превью: правая панель
        </h1>
        <p className="text-xs text-muted-foreground">
          Только dev-сборка. Клавиша D переключает тему.
        </p>
      </header>
      <div className="flex flex-wrap items-start gap-6">
        <PanelFrame title="Сентябрь — L2, исключённая версия">
          <ConclusionPanelContent detail={september} />
        </PanelFrame>
        <PanelFrame title="Май — L3, версии не исключались">
          <ConclusionPanelContent detail={may} />
        </PanelFrame>
        <PanelFrame title="Актау — L0, пустые состояния">
          <ConclusionPanelContent detail={aktau} />
        </PanelFrame>
      </div>
    </main>
  )
}
