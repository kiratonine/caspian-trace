import { useMemo } from "react"

import { DATA_LOAD_ERROR } from "@/constants/strings"
import { InsufficientDataScreen } from "@/features/aktau/InsufficientDataScreen"
import { useSelectedTab } from "@/features/tabs/use-selected-tab"
import { useSelectedIncidentDetail } from "@/hooks/use-selected-incident-detail"
import { MapLibreMap } from "./MapLibreMap"
import { MapNotices } from "./MapNotices"
import { MapVerdict } from "./MapVerdict"
import { buildCorridorLabel, buildMapModel } from "./map-model"

/**
 * Вкладка «Историческое событие»: вывод расследования на карте.
 * Данные — тот же `useSelectedIncidentDetail`, что кормит экран разбора,
 * поэтому ни одного нового запроса вкладка не делает.
 */
export function MapTab() {
  const { detail, isError } = useSelectedIncidentDetail()
  const { selectTab } = useSelectedTab()
  const model = useMemo(() => (detail ? buildMapModel(detail) : null), [detail])
  const corridorLabel = useMemo(
    () => (detail && model ? buildCorridorLabel(detail, model) : null),
    [detail, model]
  )

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
    <div className="flex min-h-0 flex-col p-4 lg:p-6">
      <MapLibreMap
        model={model}
        notices={
          <MapNotices
            unplacedStations={model.unplacedStations}
            unplacedObjects={model.unplacedObjects}
          />
        }
        overlay={
          <MapVerdict
            detail={detail}
            corridorLabel={corridorLabel}
            onOpenEvidence={() => selectTab("evidence")}
          />
        }
      />
    </div>
  )
}
