import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  MAP_CANDIDATE_LABEL,
  MAP_OBJECT_INSIDE_CORRIDOR,
  MAP_OBJECT_OUTSIDE_CORRIDOR,
} from "@/constants/map"
import type { MapObjectMarker } from "./map-model"

/**
 * Объект для проверки на карте. Имя печатается ТОЛЬКО с подписью «объект для
 * проверки» (ТЗ §4); оценки объекта здесь нет и быть не может — показывается
 * лишь факт, вычисленный ядром: попадает объект в участок или нет.
 * Основание положения — в тултипе, а не умалчивается.
 */
export function MapObjectPin({ marker }: { marker: MapObjectMarker }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="flex cursor-help items-center gap-2 whitespace-nowrap">
            <span className="rounded bg-background/85 px-1.5 py-0.5 text-right text-xs">
              <span className="font-medium">{marker.object.name}</span>
              <span className="block text-muted-foreground">
                {MAP_CANDIDATE_LABEL} ·{" "}
                {marker.insideCorridor
                  ? MAP_OBJECT_INSIDE_CORRIDOR
                  : MAP_OBJECT_OUTSIDE_CORRIDOR}
              </span>
            </span>
            <span className="size-2.5 shrink-0 rotate-45 border-[1.5px] border-foreground bg-background" />
          </div>
        }
      />
      <TooltipContent>
        <p className="max-w-72 text-pretty">{marker.basis}</p>
      </TooltipContent>
    </Tooltip>
  )
}
