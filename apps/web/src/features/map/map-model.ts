import type { IncidentDetail } from "@/api/contracts"
import {
  MAP_OBJECT_PLACEMENT,
  MAP_PADDING_Y,
  MAP_VIEWBOX_HEIGHT,
} from "@/constants/map"
import type {
  CandidateObject,
  Measurement,
  SourceDocument,
  Station,
} from "@/types"

// Чистая подготовка геометрии карты. Никаких выводов фронт здесь не считает
// (запрет 6 CLAUDE.md): участок приходит границами `corridorBounds`, порядок —
// подтверждённым `riverOrder`. Всё, что делает модуль, — раскладывает уже
// принятые бэком факты по вертикали.

export type MapStationNode = {
  station: Station
  measurement: Measurement | null
  sourceDocument: SourceDocument | null
  /** Координата Y в единицах viewBox: меньше — выше по течению. */
  y: number
}

export type MapObjectMarker = {
  object: CandidateObject
  y: number
  /** Чем обосновано положение — печатается пользователю, а не умалчивается. */
  basis: string
  /** Объект лежит внутри участка. false — участок его не включает. */
  insideCorridor: boolean
}

export type MapModel = {
  nodes: MapStationNode[]
  markers: MapObjectMarker[]
  unplacedStations: Station[]
  unplacedObjects: CandidateObject[]
  /** Верх участка в viewBox; null — участок открыт вверх, границы нет. */
  corridorTopY: number | null
  /** Низ участка в viewBox; null — участка нет вовсе. */
  corridorBottomY: number | null
  /**
   * Единица, общая для ВСЕХ измерений события — тогда её печатают один раз,
   * а не у каждого значения (решение сессии 18). Разные единицы так свернуть
   * нельзя: null означает «печатать у каждого значения свою».
   */
  commonUnit: string | null
}

export function buildMapModel(detail: IncidentDetail): MapModel {
  const documentsById = new Map(
    detail.sourceDocuments.map((document) => [document.id, document])
  )

  const ordered = detail.stations
    .filter((station) => station.riverOrder !== null)
    .sort((a, b) => (a.riverOrder ?? 0) - (b.riverOrder ?? 0))

  const step =
    ordered.length > 1
      ? (MAP_VIEWBOX_HEIGHT - MAP_PADDING_Y * 2) / (ordered.length - 1)
      : 0

  const nodes: MapStationNode[] = ordered.map((station, index) => {
    const measurement =
      detail.measurements.find((m) => m.stationId === station.id) ?? null
    return {
      station,
      measurement,
      sourceDocument: measurement
        ? (documentsById.get(measurement.sourceDocumentId) ?? null)
        : null,
      y: MAP_PADDING_Y + step * index,
    }
  })

  const yByStationId = new Map(nodes.map((node) => [node.station.id, node.y]))
  const bounds = detail.corridorBounds
  const corridorTopY = bounds?.upstreamStationId
    ? (yByStationId.get(bounds.upstreamStationId) ?? null)
    : null
  const corridorBottomY = bounds
    ? (yByStationId.get(bounds.downstreamStationId) ?? null)
    : null

  const markers: MapObjectMarker[] = []
  const unplacedObjects: CandidateObject[] = []

  for (const object of detail.candidateObjects) {
    const placement = MAP_OBJECT_PLACEMENT[object.id]
    const first = placement
      ? yByStationId.get(placement.betweenStationIds[0])
      : undefined
    const second = placement
      ? yByStationId.get(placement.betweenStationIds[1])
      : undefined

    // Разместить объект можно, только если ОБА опорных створа есть в событии
    // и у обоих подтверждён порядок. Иначе честнее сказать «не знаем», чем
    // поставить точку наугад (запрет 2 CLAUDE.md).
    if (placement && first !== undefined && second !== undefined) {
      const y = (first + second) / 2
      markers.push({
        object,
        y,
        basis: placement.basis,
        insideCorridor:
          corridorBottomY !== null &&
          y <= corridorBottomY &&
          (corridorTopY === null || y >= corridorTopY),
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
      (station) => station.riverOrder === null
    ),
    unplacedObjects,
    corridorTopY,
    corridorBottomY,
    commonUnit,
  }
}
