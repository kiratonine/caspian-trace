import {
  MAP_CAPTION,
  MAP_VIEWBOX_HEIGHT,
  MAP_VIEWBOX_WIDTH,
} from "@/constants/map"
import { MapCorridorBand, MapCorridorLabel } from "./MapCorridor"
import { MapStationLabel } from "./MapStationLabel"
import type { MapModel } from "./map-model"
import { riverPathD } from "./river-geometry"

/**
 * Геосхема: SVG несёт линию реки, HTML-слой поверх — точки, подписи
 * и интерактив. `preserveAspectRatio="none"` растягивает viewBox ровно
 * по контейнеру, поэтому координаты модели переводятся в проценты напрямую
 * и слои не разъезжаются; толщина линии держится `vector-effect`.
 */
export function GeoSchemeMap({ model }: { model: MapModel }) {
  return (
    <figure className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-3">
      <div className="relative min-h-0 flex-1">
        <svg
          role="img"
          aria-label="Географическая схема участка реки со створами наблюдений"
          viewBox={`0 0 ${MAP_VIEWBOX_WIDTH} ${MAP_VIEWBOX_HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
        >
          <path
            d={riverPathD()}
            fill="none"
            strokeWidth={3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="stroke-border"
          />
          {model.corridorBottomY !== null && (
            <MapCorridorBand
              topY={model.corridorTopY}
              bottomY={model.corridorBottomY}
            />
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0">
          {model.corridorBottomY !== null && (
            <MapCorridorLabel
              topY={model.corridorTopY}
              bottomY={model.corridorBottomY}
            />
          )}
          {model.nodes.map((node) => (
            <MapStationLabel
              key={node.station.id}
              node={node}
              showUnit={model.commonUnit === null}
            />
          ))}
        </div>
      </div>
      <figcaption className="text-center text-xs text-muted-foreground">
        {MAP_CAPTION}
      </figcaption>
    </figure>
  )
}
