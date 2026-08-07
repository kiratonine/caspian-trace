import { useTranslation } from "react-i18next"

import { SourceLink } from "@/components/common"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { MapObjectMarker } from "./map-model"

/**
 * Объект для проверки на карте. Имя печатается ТОЛЬКО с подписью «объект для
 * проверки» (ТЗ §4); оценки объекта здесь нет и быть не может — показывается
 * лишь факт, вычисленный ядром: попадает объект в участок или нет.
 * Основание положения — в тултипе, а не умалчивается.
 */
export function MapObjectPin({ marker }: { marker: MapObjectMarker }) {
  const { t } = useTranslation()
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="flex cursor-help items-center gap-2 whitespace-nowrap">
            <span className="rounded bg-background/85 px-1.5 py-0.5 text-right text-xs">
              <span className="font-medium">{marker.object.name}</span>
              <span className="block text-muted-foreground">
                {t("map.candidateLabel")} ·{" "}
                {marker.insideCorridor === null
                  ? t("map.objectCorridorUnknown")
                  : marker.insideCorridor
                    ? t("map.objectInsideCorridor")
                    : t("map.objectOutsideCorridor")}
              </span>
            </span>
            <span className="size-2.5 shrink-0 rotate-45 border-[1.5px] border-foreground bg-background" />
          </div>
        }
      />
      <TooltipContent className="flex max-w-80 flex-col gap-2">
        <p className="font-medium">
          {marker.coordinateMode === "verified"
            ? t("map.coordinateMode.verifiedLabel")
            : t("map.coordinateMode.schematicLabel")}
        </p>
        <p className="max-w-72 text-pretty">{marker.basis}</p>
        {marker.coordinateMode === "schematic" && (
          <p className="max-w-72 text-pretty text-muted-foreground">
            {t("map.coordinateMode.schematicObjectDetail")}
          </p>
        )}
        {marker.coordinateSourceDocument && (
          <SourceLink
            sourceDocument={marker.coordinateSourceDocument}
            className="text-foreground"
          />
        )}
      </TooltipContent>
    </Tooltip>
  )
}
