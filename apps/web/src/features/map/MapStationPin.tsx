import { MeasurementValue } from "@/components/common/MeasurementValue"
import type { MapStationNode } from "./map-model"

type MapStationPinProps = {
  node: MapStationNode
  showUnit: boolean
}

/**
 * Створ на карте: точка и подпись со значением. Значение остаётся кликабельным
 * `MeasurementValue` — критерий §16 п. 5 («каждое число ведёт к источнику»)
 * действует и на карте.
 */
export function MapStationPin({ node, showUnit }: MapStationPinProps) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="size-2.5 shrink-0 rounded-full border-[1.5px] border-foreground bg-background" />
      <span className="rounded bg-background/85 px-1.5 py-0.5 text-xs">
        <span className="text-muted-foreground">{node.station.name}</span>
        {node.measurement && node.sourceDocument && (
          <>
            {" "}
            <MeasurementValue
              measurement={node.measurement}
              sourceDocument={node.sourceDocument}
              showUnit={showUnit}
            />
          </>
        )}
      </span>
    </div>
  )
}
