import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { Feature, LineString } from "geojson"
import {
  LngLatBounds,
  Map as MapLibreGl,
  Marker,
  NavigationControl,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

import {
  MAP_FIT_PADDING,
  MAP_INITIAL_CENTER,
  MAP_INITIAL_ZOOM,
  MAP_PLACEHOLDER_WARNING,
} from "@/constants/map"
import { MapObjectPin } from "./MapObjectPin"
import { MapStationPin } from "./MapStationPin"
import type { MapModel } from "./map-model"

// Стиль задан инлайн и содержит ТОЛЬКО фоновый слой: карта не делает ни
// одного сетевого запроса. Критерий приёмки — демо работает офлайн, без CDN,
// а внешние тайлы это ровно запрос в сеть. По той же причине подписи —
// HTML-маркеры, а не symbol-слои: symbol требует шрифтовых PBF по `glyphs`.
const BLANK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "transparent" },
    },
  ],
}

const RIVER_LAYER = "river"
const CORRIDOR_LAYER = "corridor"

const EMPTY_LINE: Feature<LineString> = {
  type: "Feature",
  properties: {},
  geometry: { type: "LineString", coordinates: [] },
}

type MarkerSlot = { key: string; element: HTMLElement }

export function MapLibreMap({ model }: { model: MapModel }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<Marker[]>([])
  // Карта живёт в state, а не в ref: в StrictMode эффект монтируется дважды,
  // карта пересоздаётся, и эффект данных должен переисполниться на НОВОМ
  // экземпляре. С ref он этого не замечал, и линии оставались пустыми,
  // хотя слои были заведены.
  const [map, setMap] = useState<MapLibreGl | null>(null)
  const [stationSlots, setStationSlots] = useState<MarkerSlot[]>([])
  const [objectSlots, setObjectSlots] = useState<MarkerSlot[]>([])

  useEffect(() => {
    if (!containerRef.current) return
    const instance = new MapLibreGl({
      container: containerRef.current,
      style: BLANK_STYLE,
      center: MAP_INITIAL_CENTER,
      zoom: MAP_INITIAL_ZOOM,
      attributionControl: false,
    })
    instance.addControl(new NavigationControl({ showCompass: false }))

    instance.on("load", () => {
      instance.addSource(RIVER_LAYER, { type: "geojson", data: EMPTY_LINE })
      instance.addLayer({
        id: RIVER_LAYER,
        type: "line",
        source: RIVER_LAYER,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#64748b", "line-width": 3 },
      })
      // lineMetrics нужен для line-gradient: без него растворение открытого
      // вверх участка не работает.
      instance.addSource(CORRIDOR_LAYER, {
        type: "geojson",
        data: EMPTY_LINE,
        lineMetrics: true,
      })
      instance.addLayer(
        {
          id: CORRIDOR_LAYER,
          type: "line",
          source: CORRIDOR_LAYER,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-width": 24, "line-opacity": 0.45 },
        },
        RIVER_LAYER
      )
      if (import.meta.env.DEV) {
        ;(window as unknown as Record<string, unknown>).__caspianMap = instance
      }
      // Публикуем карту наверх только когда слои готовы — эффект данных
      // не должен застать её полусобранной.
      setMap(instance)
    })

    return () => {
      instance.remove()
      setMap(null)
    }
  }, [])

  useEffect(() => {
    if (!map) return

    setLineData(map, RIVER_LAYER, model.riverLine)
    setLineData(map, CORRIDOR_LAYER, model.corridorLine)

    // Открытый вверх интервал растворяется к своему свободному концу:
    // верхней границы у него нет, и обрубленная линия читалась бы как
    // граница, которой в данных не существует (решение сессии 16).
    map.setPaintProperty(CORRIDOR_LAYER, "line-gradient", [
      "interpolate",
      ["linear"],
      ["line-progress"],
      0,
      "#f59e0b",
      1,
      model.corridorOpenUpstream ? "rgba(245,158,11,0)" : "#f59e0b",
    ])

    for (const marker of markersRef.current) marker.remove()
    markersRef.current = []

    const stations = model.nodes.map((node) => {
      const element = document.createElement("div")
      markersRef.current.push(
        new Marker({ element, anchor: "left" })
          .setLngLat(node.coords)
          .addTo(map)
      )
      return { key: node.station.id, element }
    })
    const objects = model.markers.map((marker) => {
      const element = document.createElement("div")
      markersRef.current.push(
        new Marker({ element, anchor: "right" })
          .setLngLat(marker.coords)
          .addTo(map)
      )
      return { key: marker.object.id, element }
    })
    setStationSlots(stations)
    setObjectSlots(objects)

    const all = [...model.riverLine, ...model.corridorLine]
    if (all.length > 0) {
      const bounds = all.reduce(
        (acc, coord) => acc.extend(coord),
        new LngLatBounds(all[0], all[0])
      )
      map.fitBounds(bounds, { padding: MAP_FIT_PADDING, duration: 0 })
    }
  }, [map, model])

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border">
      <div ref={containerRef} className="size-full" />
      <p className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-background/90 px-3 py-2 text-center text-xs text-muted-foreground">
        {MAP_PLACEHOLDER_WARNING}
      </p>
      {stationSlots.map((slot) => {
        const node = model.nodes.find((n) => n.station.id === slot.key)
        return node
          ? createPortal(
              <MapStationPin
                node={node}
                showUnit={model.commonUnit === null}
              />,
              slot.element,
              slot.key
            )
          : null
      })}
      {objectSlots.map((slot) => {
        const marker = model.markers.find((m) => m.object.id === slot.key)
        return marker
          ? createPortal(
              <MapObjectPin marker={marker} />,
              slot.element,
              slot.key
            )
          : null
      })}
    </div>
  )
}

function setLineData(
  map: MapLibreGl,
  id: string,
  coordinates: [number, number][]
) {
  const source = map.getSource(id) as GeoJSONSource | undefined
  source?.setData({
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates },
  })
}
