import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { Feature, LineString } from "geojson"
import {
  LngLatBounds,
  Map as MapLibreGl,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
// MapLibre парсит GeoJSON в Web Worker, и без воркера источник навсегда
// остаётся незагруженным: слои не рисуются, а DOM-маркеры видны — то есть
// карта выглядит рабочей, но без линий, и в консоли пусто.
//
// Свой URL воркера MapLibre строит в рантайме, а не через `new URL(...)`,
// поэтому сборщик его статически не находит и в dist не кладёт: в dev это
// маскировал `optimizeDeps.exclude: ['maplibre-gl']`, а прод-сборка
// оставалась без воркера совсем.
//
// `?worker&url` заставляет Vite собрать воркер ВМЕСТЕ с его зависимостями
// (сам файл импортирует `./maplibre-gl-shared.mjs`, поэтому голый `?url`
// дал бы 404) и вернуть готовую ссылку. Формат воркеров — `es`
// (vite.config.ts), а MapLibre создаёт `new Worker(url, { type: 'module' })`.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"

setWorkerUrl(maplibreWorkerUrl)

import {
  MAP_FIT_PADDING,
  MAP_FLOW_DASH_FRAMES,
  MAP_FLOW_FRAME_MS,
  MAP_INITIAL_CENTER,
  MAP_INITIAL_ZOOM,
  MAP_LABEL_MAX_WIDTH,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_URL,
} from "@/constants/map"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { MapObjectPin } from "./MapObjectPin"
import { MapStationPin } from "./MapStationPin"
import type { MapModel } from "./map-model"

// Подложка — растровые тайлы OSM (решение владельца продукта 06.08.2026).
// Без сети тайлы не придут, и карта останется на пустом фоне: наши слои,
// маркеры и весь остальной экран при этом работают, то есть офлайн ломается
// только картинка подложки, а не демо. Подписи всё равно рисуются
// HTML-маркерами, а не symbol-слоями: symbol требует шрифтовых PBF
// по `glyphs`, и это был бы второй сетевой источник.
const BASE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [MAP_TILE_URL],
      tileSize: 256,
      attribution: MAP_TILE_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "transparent" },
    },
    { id: "osm", type: "raster", source: "osm" },
  ],
}

const RIVER_LAYER = "river"
const CORRIDOR_LAYER = "corridor"
const FLOW_LAYER = "flow"

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
  const prefersReducedMotion = usePrefersReducedMotion()
  const [stationSlots, setStationSlots] = useState<MarkerSlot[]>([])
  const [objectSlots, setObjectSlots] = useState<MarkerSlot[]>([])

  useEffect(() => {
    if (!containerRef.current) return
    const instance = new MapLibreGl({
      container: containerRef.current,
      style: BASE_STYLE,
      center: MAP_INITIAL_CENTER,
      zoom: MAP_INITIAL_ZOOM,
      // Атрибуция OSM обязательна условиями использования тайлов.
      attributionControl: { compact: true },
    })
    instance.addControl(new NavigationControl({ showCompass: false }))
    // Без сети тайлы не придут. Это не поломка приложения, а отсутствие
    // подложки: гасим ошибку, чтобы она не сыпалась в консоль на каждый тайл.
    instance.on("error", (event) => {
      if (import.meta.env.DEV) console.warn("MapLibre:", event.error?.message)
    })

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
      // Слой сноса поверх русла: тот же путь, но бегущим пунктиром.
      instance.addLayer({
        id: FLOW_LAYER,
        type: "line",
        source: RIVER_LAYER,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#e2e8f0",
          "line-width": 2,
          "line-dasharray": [0, 4, 3],
        },
      })
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
      // Ширину подписи ограничиваем здесь: маркер MapLibre позиционируется
      // абсолютно, и без потолка длинное имя створа уезжает за край карты,
      // унося с собой значение.
      element.style.maxWidth = MAP_LABEL_MAX_WIDTH
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

  // Снос вниз по течению. Это не украшение, а содержание: перенос идёт
  // сверху вниз, поэтому источник ищут выше участка. При prefers-reduced-motion
  // движение гасится, но пунктир остаётся — направление продолжает читаться
  // (тот же принцип, что у реплея, решение сессии 17).
  useEffect(() => {
    if (!map || prefersReducedMotion) return
    let frame = 0
    const timer = window.setInterval(() => {
      frame = (frame + 1) % MAP_FLOW_DASH_FRAMES.length
      if (map.getLayer(FLOW_LAYER)) {
        map.setPaintProperty(
          FLOW_LAYER,
          "line-dasharray",
          MAP_FLOW_DASH_FRAMES[frame]
        )
      }
    }, MAP_FLOW_FRAME_MS)
    return () => window.clearInterval(timer)
  }, [map, prefersReducedMotion])

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border">
      <div ref={containerRef} className="size-full" />
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
