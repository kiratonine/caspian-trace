import { Info } from "lucide-react"

import { SCHEME_UNORDERED_NOTE } from "@/constants/scheme"
import { StationNode } from "./StationNode"
import type { SchemeModel, StationSchemeEntry } from "./scheme-model"

type UnorderedStationsProps = {
  entries: StationSchemeEntry[]
  corridor: SchemeModel["corridor"]
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
      {/* Не рамка, а рельс слева — как у ленты коридора: пунктирный
          прямоугольник посреди колонки читался как ещё один элемент схемы,
          хотя это примечание к ней. */}
      <p className="flex items-start gap-2 border-l-2 py-1 pl-3 text-xs text-pretty text-muted-foreground">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {SCHEME_UNORDERED_NOTE}
      </p>
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
