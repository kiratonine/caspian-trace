import { MeasurementValue } from "@/components/common/MeasurementValue"
import { MAP_VIEWBOX_HEIGHT } from "@/constants/map"
import type { MapStationNode } from "./map-model"
import { riverXAt } from "./river-geometry"

type MapStationLabelProps = {
  node: MapStationNode
  showUnit: boolean
}

/**
 * Створ на карте — точка и подпись. Оба живут в HTML поверх SVG, а не внутри
 * него: карта растянута `preserveAspectRatio="none"`, и в SVG круг стал бы
 * овалом, а текст менял бы кегль вместе с размером окна. Позиция берётся
 * из той же модели, что и линия реки.
 *
 * Значение остаётся кликабельным `MeasurementValue` — критерий §16 п. 5
 * («каждое число ведёт к источнику») действует и на карте.
 */
export function MapStationLabel({ node, showUnit }: MapStationLabelProps) {
  const top = `${(node.y / MAP_VIEWBOX_HEIGHT) * 100}%`
  const riverX = riverXAt(node.y)

  return (
    <>
      <div
        aria-hidden
        className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-foreground bg-background"
        style={{ top, left: `${riverX}%` }}
      />
      <div
        className="pointer-events-auto absolute flex -translate-y-1/2 items-baseline gap-2 whitespace-nowrap"
        style={{ top, left: `calc(${riverX}% + 0.75rem)` }}
      >
        <span className="text-xs text-muted-foreground">
          {node.station.name}
        </span>
        {node.measurement && node.sourceDocument && (
          <MeasurementValue
            measurement={node.measurement}
            sourceDocument={node.sourceDocument}
            showUnit={showUnit}
            className="text-xs"
          />
        )}
      </div>
    </>
  )
}
