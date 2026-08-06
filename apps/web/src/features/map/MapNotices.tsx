import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  MAP_PLACEHOLDER_CHIP,
  MAP_PLACEHOLDER_WARNING,
  MAP_UNPLACED_CHIP,
  MAP_UNPLACED_NOTE,
} from "@/constants/map"
import type { CandidateObject, Station } from "@/types"

type MapNoticesProps = {
  unplacedStations: Station[]
  unplacedObjects: CandidateObject[]
}

/**
 * Оговорки карты — компактными метками, а не тремя абзацами поверх экрана
 * (просьба владельца продукта 06.08.2026: экран забит текстом). Содержание
 * не потеряно: полные формулировки в тултипах. Тот же приём, что в сессии 18,
 * — «один факт — одно место», а не удаление факта.
 */
export function MapNotices({
  unplacedStations,
  unplacedObjects,
}: MapNoticesProps) {
  const unplacedCount = unplacedStations.length + unplacedObjects.length

  return (
    <div className="pointer-events-auto absolute top-3 left-3 z-10 flex flex-wrap gap-2">
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="cursor-help rounded-full border bg-background/90 px-2.5 py-1 text-xs shadow-sm backdrop-blur-sm">
              {MAP_PLACEHOLDER_CHIP}
            </span>
          }
        />
        <TooltipContent>
          <p className="max-w-72 text-pretty">{MAP_PLACEHOLDER_WARNING}</p>
        </TooltipContent>
      </Tooltip>

      {unplacedCount > 0 && (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="cursor-help rounded-full border bg-background/90 px-2.5 py-1 text-xs shadow-sm backdrop-blur-sm">
                {MAP_UNPLACED_CHIP} · {unplacedCount}
              </span>
            }
          />
          <TooltipContent>
            <div className="max-w-72 space-y-1">
              <p className="text-pretty">{MAP_UNPLACED_NOTE}</p>
              <ul>
                {unplacedObjects.map((object) => (
                  <li key={object.id}>{object.name}</li>
                ))}
                {unplacedStations.map((station) => (
                  <li key={station.id}>{station.name}</li>
                ))}
              </ul>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
