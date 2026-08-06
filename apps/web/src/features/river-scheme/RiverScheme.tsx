import { useMemo, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import type { IncidentDetail } from "@/api/contracts"
import { incidentsQueryOptions } from "@/api/queries"
import { Skeleton } from "@/components/ui/skeleton"
import { INCIDENT_SEARCH_PARAM } from "@/constants/routing"
import {
  SCHEME_PARTIAL_ORDER_HINT,
  SCHEME_UNCONFIRMED_ORDER_HINT,
  SCHEME_UPSTREAM_HINT,
} from "@/constants/scheme"
import { unitLabel } from "@/constants/units"
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
import { formatSampledDate } from "@/lib/format"
import { OrderedStations } from "./OrderedStations"
import { UnorderedStations } from "./UnorderedStations"
import { buildSchemeModel } from "./scheme-model"

/** Колонка схемы: рисует выбранное событие (общий хук выбора). */
export function RiverScheme() {
  const { t } = useTranslation()
  const { selectedIncidentId, detail, isError } = useSelectedIncidentDetail()
  // Во время реплея схема показывает только «уже загруженные» шагами
  // измерения и коридор — селектор поверх данных, без рефетча (план сессии 9).
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

  return (
    <section aria-label="Линейная схема реки" className="flex min-h-0 flex-col">
      {shownDetail ? (
        <RiverSchemeContent
          detail={shownDetail}
          hasPeriodSwitcher={hasComparablePeriods(periods)}
          periodSwitcher={
            <PeriodSwitcher
              periods={periods}
              selectedIncidentId={selectedIncidentId}
              onSelect={selectPeriod}
            />
          }
        />
      ) : (
        <>
          <SchemeHeader subtitle={null} />
          <div className="flex min-h-0 flex-1 items-center justify-center p-8">
            {isError ? (
              <p className="text-sm text-muted-foreground">
                {t("app.dataLoadError")}
              </p>
            ) : (
              <SchemeSkeleton />
            )}
          </div>
        </>
      )}
    </section>
  )
}

type RiverSchemeContentProps = {
  detail: IncidentDetail
  /** Переключатель периодов участка; у события без пары его нет. */
  periodSwitcher?: ReactNode
  /**
   * Переключатель периодов виден — тогда период не дублируется строкой
   * контекста. Без пары периодов дата отбора остаётся здесь: иначе она
   * не попала бы на экран вовсе.
   */
  hasPeriodSwitcher?: boolean
}

/** Презентационная часть схемы — контейнер и дев-превью отдают ей готовые данные. */
export function RiverSchemeContent({
  detail,
  periodSwitcher = null,
  hasPeriodSwitcher = false,
}: RiverSchemeContentProps) {
  const model = useMemo(() => buildSchemeModel(detail), [detail])
  const hasUnordered = model.unordered.length > 0

  // Без единого створа рисовать нечего: вместо рамки схемы — полноценный
  // экран «недостаточно данных» (ТЗ §13 «Экран Актау»); заголовок
  // «Линейная схема реки» для прибрежного кейса был бы неправдой.
  if (detail.stations.length === 0) {
    return <InsufficientDataScreen detail={detail} />
  }

  const waterBody = detail.stations[0]?.waterBody ?? null
  // Пока хоть одна станция без подтверждённого порядка — «вверху — выше по
  // течению» обещать нельзя. Но если часть створов всё-таки выстроена
  // проверенными связями, «порядок не подтверждён» тоже неправда.
  const orderHint = !hasUnordered
    ? SCHEME_UPSTREAM_HINT
    : model.ordered.length > 0
      ? SCHEME_PARTIAL_ORDER_HINT
      : SCHEME_UNCONFIRMED_ORDER_HINT
  const subtitle = [waterBody, orderHint].filter(Boolean).join(" · ") || null
  const firstMeasurement = detail.measurements[0] ?? null
  // Период уже стоит на активной кнопке переключателя — второй раз его здесь
  // не печатаем. Если пары периодов нет и кнопок тоже, дата остаётся тут.
  const sampledDate =
    hasPeriodSwitcher || !firstMeasurement
      ? null
      : formatSampledDate(firstMeasurement)
  const unit = model.commonUnit === null ? null : unitLabel(model.commonUnit)

  return (
    <>
      <SchemeHeader subtitle={subtitle} />
      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
          {periodSwitcher}
          <p className="text-xs text-muted-foreground">
            {detail.investigation.indicator}
            {unit && `, ${unit}`}
            {sampledDate && ` · ${sampledDate}`}
          </p>
          {model.ordered.length > 0 && (
            <OrderedStations
              entries={model.ordered}
              corridor={model.corridor}
              showUnit={model.commonUnit === null}
            />
          )}
          {hasUnordered && (
            <UnorderedStations
              entries={model.unordered}
              corridor={model.corridor}
              showUnit={model.commonUnit === null}
            />
          )}
        </div>
      </div>
    </>
  )
}

function SchemeHeader({ subtitle }: { subtitle: string | null }) {
  return (
    <header className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
      <h2 className="text-xs font-medium text-muted-foreground">
        Линейная схема реки
      </h2>
      {subtitle && (
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      )}
    </header>
  )
}

const SKELETON_NODES = 4

function SchemeSkeleton() {
  return (
    <div aria-hidden className="relative flex flex-col gap-10">
      <div className="absolute inset-y-1 left-1.25 w-px border-l border-dashed" />
      {Array.from({ length: SKELETON_NODES }, (_, index) => (
        <div key={index} className="relative flex items-center gap-4">
          <Skeleton className="size-2.5 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-3 w-14" />
        </div>
      ))}
    </div>
  )
}
