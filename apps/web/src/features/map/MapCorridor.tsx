import { useId } from "react"

import {
  MAP_CORRIDOR_HALF_WIDTH,
  MAP_CORRIDOR_OPEN_UPSTREAM_LABEL,
  MAP_VIEWBOX_HEIGHT,
} from "@/constants/map"
import { riverBandPathD, riverXAt } from "./river-geometry"

type MapCorridorProps = {
  /** null — участок открыт вверх по течению, верхней границы нет. */
  topY: number | null
  bottomY: number
}

/**
 * Лента участка внутри SVG. У открытого вверх интервала заливка растворяется
 * маской, а не обрывается гранью: срезанный край читается как недорисованный
 * прямоугольник, то есть как дефект вёрстки (решение сессии 16).
 */
export function MapCorridorBand({ topY, bottomY }: MapCorridorProps) {
  const maskId = useId()
  const gradientId = useId()
  const isOpenUpstream = topY === null
  const y = isOpenUpstream ? 0 : topY

  return (
    <g>
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1={y}
          x2="0"
          y2={bottomY}
          gradientUnits="userSpaceOnUse"
        >
          <stop
            offset="0%"
            stopColor="white"
            stopOpacity={isOpenUpstream ? 0 : 1}
          />
          <stop offset="45%" stopColor="white" stopOpacity={1} />
          <stop offset="100%" stopColor="white" stopOpacity={1} />
        </linearGradient>
        <mask id={maskId}>
          <path
            d={riverBandPathD(y, bottomY, MAP_CORRIDOR_HALF_WIDTH)}
            fill={`url(#${gradientId})`}
          />
        </mask>
      </defs>
      <path
        d={riverBandPathD(y, bottomY, MAP_CORRIDOR_HALF_WIDTH)}
        mask={`url(#${maskId})`}
        className="fill-foreground/15"
      />
    </g>
  )
}

/**
 * Подпись участка — в HTML-слое, как и остальной текст карты: в SVG её кегль
 * зависел бы от размера окна.
 */
export function MapCorridorLabel({ topY, bottomY }: MapCorridorProps) {
  if (topY !== null) return null

  return (
    <p
      className="absolute -translate-y-1/2 text-xs whitespace-nowrap text-muted-foreground"
      style={{
        top: `${(Math.max(bottomY / 2, 6) / MAP_VIEWBOX_HEIGHT) * 100}%`,
        left: `calc(${riverXAt(bottomY / 2) + MAP_CORRIDOR_HALF_WIDTH}% + 0.5rem)`,
      }}
    >
      ↑ {MAP_CORRIDOR_OPEN_UPSTREAM_LABEL}
    </p>
  )
}
