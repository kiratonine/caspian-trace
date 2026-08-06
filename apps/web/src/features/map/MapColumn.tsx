import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"

import { incidentsQueryOptions } from "@/api/queries"
import { INCIDENT_SEARCH_PARAM } from "@/constants/routing"
import { DATA_LOAD_ERROR } from "@/constants/strings"
import { InsufficientDataScreen } from "@/features/aktau/InsufficientDataScreen"
import { PeriodSwitcher } from "@/features/comparison/PeriodSwitcher"
import {
  findComparablePeriods,
  hasComparablePeriods,
} from "@/features/comparison/comparison-model"
import {
  projectDetailForReplay,
  useReplayFrame,
} from "@/features/replay/replay-frame"
import { useSelectedIncidentDetail } from "@/hooks/use-selected-incident-detail"
import { MapLibreMap } from "./MapLibreMap"
import { buildMapModel } from "./map-model"

/**
 * Центральная колонка: карта участка вместо линейной схемы (решение владельца
 * продукта 06.08.2026). Числа с экрана не исчезли — значение подписано у
 * своего створа прямо на карте и остаётся кликабельным до страницы документа
 * (§16 п. 5).
 */
export function MapColumn() {
  const { selectedIncidentId, detail, isError } = useSelectedIncidentDetail()
  // Во время реплея показываем только «уже загруженные» шагами измерения
  // и коридор — селектор поверх данных, без рефетча (решение сессии 9).
  const frame = useReplayFrame(selectedIncidentId)
  const shownDetail = useMemo(
    () => (detail && frame ? projectDetailForReplay(detail, frame) : detail),
    [detail, frame]
  )

  const incidentsQuery = useQuery(incidentsQueryOptions)
  const [, setSearchParams] = useSearchParams()
  const periods = useMemo(
    () => findComparablePeriods(incidentsQuery.data ?? [], selectedIncidentId),
    [incidentsQuery.data, selectedIncidentId]
  )
  const selectPeriod = (id: string) => {
    setSearchParams((params) => {
      params.set(INCIDENT_SEARCH_PARAM, id)
      return params
    })
  }

  const mapModel = useMemo(
    () => (shownDetail ? buildMapModel(shownDetail) : null),
    [shownDetail]
  )

  if (!shownDetail || !mapModel) {
    return (
      <section aria-label="Карта участка" className="flex min-h-0 flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          {isError && (
            <p className="text-sm text-muted-foreground">{DATA_LOAD_ERROR}</p>
          )}
        </div>
      </section>
    )
  }

  // Событие без единого створа отдаёт экран «недостаточно данных» целиком
  // (решение сессии 8): пустая карта читалась бы как поломка, а не как отказ.
  if (shownDetail.stations.length === 0) {
    return <InsufficientDataScreen detail={shownDetail} />
  }

  return (
    <section
      aria-label="Карта участка"
      className="flex min-h-0 flex-col gap-3 p-4"
    >
      {hasComparablePeriods(periods) && (
        <PeriodSwitcher
          periods={periods}
          selectedIncidentId={selectedIncidentId}
          onSelect={selectPeriod}
        />
      )}
      <MapLibreMap model={mapModel} />
    </section>
  )
}
