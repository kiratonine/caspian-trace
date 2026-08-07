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
 *
 * Имя створа усекается, число — никогда: колонка узкая, названия длинные
 * («0,5 км выше сброса КГП „Атырау су арнасы"»), и обрезанное значение было бы
 * обрезанным доказательством. Полное имя остаётся в `title`, в правой панели
 * и в таблице досье.
 */
export function MapStationPin({ node, showUnit }: MapStationPinProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2.5 shrink-0 rounded-full border-[1.5px] border-foreground bg-background" />
      <span className="flex min-w-0 items-baseline gap-1.5 rounded bg-background/85 px-1.5 py-0.5 text-xs">
        <span
          className="min-w-0 truncate text-muted-foreground"
          title={node.station.name}
        >
          {node.station.name}
        </span>
        {node.measurement && node.sourceDocument && (
          <MeasurementValue
            measurement={node.measurement}
            sourceDocument={node.sourceDocument}
            showUnit={showUnit}
            className="shrink-0"
          />
        )}
      </span>
    </div>
  )
}
