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
