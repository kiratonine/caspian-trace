import { useTranslation } from "react-i18next"

import { SourceLink } from "@/components/common"
import { MeasurementValue } from "@/components/common/MeasurementValue"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { MapStationNode } from "./map-model"

type MapStationPinProps = {
  node: MapStationNode
  showUnit: boolean
}

/**
 * Створ на карте: точка и подпись со значением. Значение остаётся кликабельным
 * `MeasurementValue` — критерий §16 п. 5 («каждое число ведёт к источнику»)
 * действует и на карте.
 *
 * Имя створа усекается, число — никогда: колонка узкая, названия длинные
 * («0,5 км выше сброса КГП „Атырау су арнасы"»), и обрезанное значение было бы
 * обрезанным доказательством. Полное имя остаётся в `title`, в правой панели
 * и в таблице досье.
 */
export function MapStationPin({ node, showUnit }: MapStationPinProps) {
  const { t } = useTranslation()
  const coordinateLabel =
    node.coordinateMode === "verified"
      ? t("map.coordinateMode.verifiedStation")
      : t("map.coordinateMode.schematicStation")

  return (
    <div className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={`${node.station.name}: ${coordinateLabel}`}
              className={cn(
                "size-2.5 shrink-0 cursor-help rounded-full border-[1.5px] border-foreground bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                node.coordinateMode === "schematic" && "border-dashed"
              )}
            />
          }
        />
        <TooltipContent className="flex max-w-80 flex-col gap-2">
          <p className="text-pretty">{coordinateLabel}</p>
          {node.coordinateMode === "schematic" && (
            <p className="text-pretty text-muted-foreground">
              {t("map.coordinateMode.schematicStationDetail")}
            </p>
          )}
          {node.coordinateSourceDocument && (
            <SourceLink
              sourceDocument={node.coordinateSourceDocument}
              className="text-foreground"
            />
          )}
        </TooltipContent>
      </Tooltip>
      <span className="flex min-w-0 items-baseline gap-1.5 rounded bg-background/85 px-1.5 py-0.5 text-xs">
        <span
          className="min-w-0 truncate text-muted-foreground"
          title={node.station.name}
        >
          {node.station.name}
        </span>
        {node.measurement && node.measurementSourceDocument && (
          <MeasurementValue
            measurement={node.measurement}
            sourceDocument={node.measurementSourceDocument}
            showUnit={showUnit}
            className="shrink-0"
          />
        )}
      </span>
    </div>
  )
}
