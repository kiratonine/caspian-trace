import { useState, type ReactNode } from "react"

import { incidentSummaries } from "@/api/seed-data"
import { incidentDetails } from "@/api/seed-data"
import { PeriodSwitcher } from "@/features/comparison/PeriodSwitcher"
import { VerdictChange } from "@/features/comparison/VerdictChange"
import { findComparablePeriods } from "@/features/comparison/comparison-model"

// Дев-превью сравнения периодов (только dev-сборка, см. router.tsx):
// переключатель и плашка смены вывода на реальных данных заглушек §5.
// Клики живут в локальном state, URL не трогается.

const september = incidentSummaries.find((s) => s.id === "inv-atyrau-2025-09")!
const may = incidentSummaries.find((s) => s.id === "inv-atyrau-2025-05")!
const aktau = incidentSummaries.find((s) => s.id === "inv-aktau-insufficient")!

function side(summary: typeof september) {
  return {
    period: summary.period,
    evidenceLevel: summary.evidenceLevel,
    conclusion: incidentDetails[summary.id].investigation.conclusion,
  }
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex shrink-0 flex-col gap-2">
      <h2 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        {title}
      </h2>
      <div className="w-95 overflow-hidden border p-4">{children}</div>
    </section>
  )
}

export default function ComparisonGallery() {
  const [selectedId, setSelectedId] = useState(september.id)
  const periods = findComparablePeriods(incidentSummaries, selectedId)

  return (
    <main className="flex flex-col gap-6 p-8">
      <header>
        <h1 className="text-sm font-semibold tracking-[0.14em] uppercase">
          Дев-превью: сравнение периодов
        </h1>
        <p className="text-xs text-muted-foreground">
          Только dev-сборка. Клавиша D переключает тему.
        </p>
      </header>
      <div className="flex flex-wrap items-start gap-6">
        <Frame title="Переключатель — клик меняет выбранный период">
          <PeriodSwitcher
            periods={periods}
            selectedIncidentId={selectedId}
            onSelect={setSelectedId}
          />
        </Frame>
        <Frame title="Актау — пары нет, переключателя тоже">
          <PeriodSwitcher
            periods={findComparablePeriods(incidentSummaries, aktau.id)}
            selectedIncidentId={aktau.id}
            onSelect={() => {}}
          />
          <p className="text-xs text-muted-foreground">
            Переключатель не отрисован — сравнивать не с чем.
          </p>
        </Frame>
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <Frame title="Сентябрь → май: L2 сменился на L3">
          <VerdictChange
            before={side(september)}
            after={side(may)}
            onDismiss={() => {}}
          />
        </Frame>
        <Frame title="Май → сентябрь: обратный переход">
          <VerdictChange
            before={side(may)}
            after={side(september)}
            onDismiss={() => {}}
          />
        </Frame>
      </div>
    </main>
  )
}
