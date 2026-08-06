import { useMemo } from "react"

import { MAP_CAPTION } from "@/constants/map"
import { DATA_LOAD_ERROR } from "@/constants/strings"
import { InsufficientDataScreen } from "@/features/aktau/InsufficientDataScreen"
import { useSelectedIncidentDetail } from "@/hooks/use-selected-incident-detail"
import { MapLibreMap } from "./MapLibreMap"
import { UnplacedList } from "./UnplacedList"
import { buildMapModel } from "./map-model"

/**
 * Вкладка «Историческое событие»: вывод расследования на карте.
 * Данные — тот же `useSelectedIncidentDetail`, что кормит экран разбора,
 * поэтому ни одного нового запроса вкладка не делает.
 */
export function MapTab() {
  const { detail, isError } = useSelectedIncidentDetail()
  const model = useMemo(() => (detail ? buildMapModel(detail) : null), [detail])

  if (isError) {
    return (
      <div className="flex min-h-0 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">{DATA_LOAD_ERROR}</p>
      </div>
    )
  }

  if (!detail || !model) return <div className="min-h-0" />

  // Событие без единого створа отдаёт полноценный экран «недостаточно данных»
  // (решение сессии 8): пустая карта читалась бы как поломка, а не как отказ.
  if (detail.stations.length === 0) {
    return <InsufficientDataScreen detail={detail} />
  }

  return (
    <div className="flex min-h-0 flex-col gap-3 p-4 lg:p-6">
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <MapLibreMap model={model} />
        <UnplacedList
          stations={model.unplacedStations}
          objects={model.unplacedObjects}
        />
      </div>
      <p className="text-center text-xs text-muted-foreground">{MAP_CAPTION}</p>
    </div>
  )
}
