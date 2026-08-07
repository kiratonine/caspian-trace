import type { TFunction } from "i18next"

import type { IncidentDetail } from "@/api/contracts"
import {
  MAP_OBJECT_PLACEMENT,
  MAP_OPEN_CORRIDOR_EXTENSION_DEG,
  MAP_SCHEMATIC_STATION_COORDS,
} from "@/constants/map"
import type {
  CandidateObject,
  Measurement,
  SourceDocument,
  Station,
} from "@/types"

// Чистая подготовка данных карты. Никаких выводов фронт не считает
// (запрет 6 CLAUDE.md): участок приходит границами `corridorBounds`, порядок —
// подтверждённым `riverOrder`. При отсутствии координат с provenance модель
// явно помечает демонстрационное размещение как schematic.

/** [lon, lat] — порядок MapLibre. */
export type LngLat = [number, number]

export type CoordinateMode = "verified" | "schematic"

export type ResolvedMapCoordinate = {
  coords: LngLat
  coordinateMode: CoordinateMode
  sourceDocumentId: string | null
  coordinateSourceDocument: SourceDocument | null
}

export type MapStationNode = ResolvedMapCoordinate & {
  station: Station
  measurement: Measurement | null
  measurementSourceDocument: SourceDocument | null
}

export type MapObjectMarker = ResolvedMapCoordinate & {
  object: CandidateObject
  /** Чем обосновано положение — печатается пользователю, а не умалчивается. */
  basis: string
  /** null — данных для сопоставления с границами участка недостаточно. */
  insideCorridor: boolean | null
}

export type MapModel = {
  nodes: MapStationNode[]
  markers: MapObjectMarker[]
  unplacedStations: Station[]
  unplacedObjects: CandidateObject[]
  /** Линия русла по подтверждённому порядку створов. */
  riverLine: LngLat[]
  /** Линия участка; пустая — участка нет. */
  corridorLine: LngLat[]
  /** Участок открыт вверх по течению: верхней границы у него нет. */
  corridorOpenUpstream: boolean
  commonUnit: string | null
  verifiedMarkerCount: number
  schematicMarkerCount: number
}

export function resolveStationCoordinate(
  station: Station,
  documentsById: ReadonlyMap<string, SourceDocument>
): ResolvedMapCoordinate | null {
  if (station.location && station.locationSourceDocumentId) {
    const coordinateSourceDocument = documentsById.get(
      station.locationSourceDocumentId
    )
    if (coordinateSourceDocument) {
      return {
        coords: [station.location.lon, station.location.lat],
        coordinateMode: "verified",
        sourceDocumentId: station.locationSourceDocumentId,
        coordinateSourceDocument,
      }
    }
  }

  const schematic = MAP_SCHEMATIC_STATION_COORDS[station.id]
  return schematic
    ? {
        coords: schematic,
        coordinateMode: "schematic",
        sourceDocumentId: null,
        coordinateSourceDocument: null,
      }
    : null
}

/**
 * Подпись участка для заключения. Имена створов не берутся в кавычки:
 * у них уже есть свои («Атырау су арнасы»), и вложенные ёлочки читаются
 * как опечатка (решение сессии 12).
 */
export function buildCorridorLabel(
  detail: IncidentDetail,
  model: MapModel,
  t: TFunction
): string | null {
  const bounds = detail.corridorBounds
  if (!bounds || model.corridorLine.length === 0) return null

  const nameOf = (id: string) =>
    model.nodes.find((node) => node.station.id === id)?.station.name ?? null

  const downstream = nameOf(bounds.downstreamStationId)
  if (!downstream) return null

  if (!bounds.upstreamStationId) {
    return `${t("map.verdictOpenUpstreamPrefix")} ${downstream}`
  }
  const upstream = nameOf(bounds.upstreamStationId)
  return upstream
    ? `${t("map.verdictBetweenPrefix")} ${upstream} и ${downstream}`
    : `${t("map.verdictOpenUpstreamPrefix")} ${downstream}`
}

export function buildMapModel(detail: IncidentDetail, t: TFunction): MapModel {
  const documentsById = new Map(
    detail.sourceDocuments.map((document) => [document.id, document])
  )

  const ordered = detail.stations
    .filter((station) => station.riverOrder !== null)
    .sort((a, b) => (a.riverOrder ?? 0) - (b.riverOrder ?? 0))

  const nodes: MapStationNode[] = ordered.flatMap((station) => {
    const coordinate = resolveStationCoordinate(station, documentsById)
    if (!coordinate) return []
    const measurement =
      detail.measurements.find((m) => m.stationId === station.id) ?? null
    return [
      {
        ...coordinate,
        station,
        measurement,
        measurementSourceDocument: measurement
          ? (documentsById.get(measurement.sourceDocumentId) ?? null)
          : null,
      },
    ]
  })

  const placedIds = new Set(nodes.map((node) => node.station.id))
  const coordsByStationId = new Map(
    nodes.map((node) => [node.station.id, node.coords])
  )
  const riverLine = nodes.map((node) => node.coords)

  const bounds = detail.corridorBounds
  const corridorBottom = bounds
    ? coordsByStationId.get(bounds.downstreamStationId)
    : undefined
  const corridorTop = bounds?.upstreamStationId
    ? coordsByStationId.get(bounds.upstreamStationId)
    : undefined
  const corridorOpenUpstream = Boolean(bounds && !bounds.upstreamStationId)

  let corridorLine: LngLat[] = []
  if (corridorBottom && corridorTop) {
    // Закрытый интервал: отрезок русла между двумя границами.
    const fromIndex = riverLine.findIndex((c) => c === corridorTop)
    const toIndex = riverLine.findIndex((c) => c === corridorBottom)
    corridorLine = riverLine.slice(
      Math.min(fromIndex, toIndex),
      Math.max(fromIndex, toIndex) + 1
    )
  } else if (corridorBottom && corridorOpenUpstream) {
    // Открытый вверх: от нижней границы вверх по течению за пределы схемы.
    // Направление берётся у самого русла, а не выдумывается: если следующего
    // створа нет, идём строго на север.
    const index = riverLine.findIndex((c) => c === corridorBottom)
    const next = riverLine[index + 1]
    const [lon, lat] = corridorBottom
    const direction = next
      ? [lon - next[0], lat - next[1]]
      : ([0, 1] as [number, number])
    const length = Math.hypot(direction[0], direction[1]) || 1
    corridorLine = [
      corridorBottom,
      [
        lon + (direction[0] / length) * MAP_OPEN_CORRIDOR_EXTENSION_DEG,
        lat + (direction[1] / length) * MAP_OPEN_CORRIDOR_EXTENSION_DEG,
      ],
    ]
  }

  const markers: MapObjectMarker[] = []
  const unplacedObjects: CandidateObject[] = []

  const insideCorridorForOrder = (objectOrder: number | null) => {
    if (objectOrder === null) return null
    const bottomOrder = corridorBottom ? orderOf(corridorBottom) : null
    const topOrder = corridorTop ? orderOf(corridorTop) : null
    return bottomOrder === null
      ? null
      : objectOrder <= bottomOrder &&
          (topOrder === null || objectOrder >= topOrder)
  }

  function orderOf(coord: LngLat): number | null {
    return nodes.find((node) => node.coords === coord)?.station.riverOrder ?? null
  }

  for (const object of detail.candidateObjects) {
    const objectCoordinateSource = object.locationSourceDocumentId
      ? documentsById.get(object.locationSourceDocumentId)
      : undefined
    if (
      object.location &&
      object.locationSourceDocumentId &&
      objectCoordinateSource
    ) {
      markers.push({
        object,
        coords: [object.location.lon, object.location.lat],
        coordinateMode: "verified",
        sourceDocumentId: object.locationSourceDocumentId,
        coordinateSourceDocument: objectCoordinateSource,
        basis: t("map.coordinateMode.verifiedObject"),
        insideCorridor: insideCorridorForOrder(object.riverOrder),
      })
      continue
    }

    const placement = MAP_OBJECT_PLACEMENT[object.id]
    const first = placement
      ? coordsByStationId.get(placement.betweenStationIds[0])
      : undefined
    const second = placement
      ? coordsByStationId.get(placement.betweenStationIds[1])
      : undefined

    if (placement && first && second) {
      const coords: LngLat = [
        (first[0] + second[0]) / 2,
        (first[1] + second[1]) / 2,
      ]
      // Внутри участка — если объект попадает между границами по течению.
      // Считается по порядку створов, а не по расстоянию: порядок подтверждён
      // документами, а координаты демонстрационные.
      const objectOrder = ((orderOf(first) ?? 0) + (orderOf(second) ?? 0)) / 2
      const sourceDocumentId = object.evidenceDocumentIds.find((id) =>
        documentsById.has(id)
      )

      markers.push({
        object,
        coords,
        coordinateMode: "schematic",
        sourceDocumentId: sourceDocumentId ?? null,
        coordinateSourceDocument: sourceDocumentId
          ? (documentsById.get(sourceDocumentId) ?? null)
          : null,
        // object.id — свободная строка данных (не закрытый enum), поэтому
        // лукап с fallback: неизвестный id не должен уронить рендер.
        basis: t(`map.objectPlacementBasis.${object.id}`, { defaultValue: "" }),
        insideCorridor: insideCorridorForOrder(objectOrder),
      })
    } else {
      unplacedObjects.push(object)
    }
  }

  const [firstMeasurement, ...restMeasurements] = detail.measurements
  const commonUnit =
    firstMeasurement &&
    restMeasurements.every((m) => m.unit === firstMeasurement.unit)
      ? firstMeasurement.unit
      : null

  return {
    nodes,
    markers,
    unplacedStations: detail.stations.filter(
      (station) => !placedIds.has(station.id)
    ),
    unplacedObjects,
    riverLine,
    corridorLine,
    corridorOpenUpstream,
    commonUnit,
    verifiedMarkerCount:
      nodes.filter(({ coordinateMode }) => coordinateMode === "verified")
        .length +
      markers.filter(({ coordinateMode }) => coordinateMode === "verified")
        .length,
    schematicMarkerCount:
      nodes.filter(({ coordinateMode }) => coordinateMode === "schematic")
        .length +
      markers.filter(({ coordinateMode }) => coordinateMode === "schematic")
        .length,
  }
}
