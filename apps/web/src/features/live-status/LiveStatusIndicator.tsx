import { useQuery } from "@tanstack/react-query"

import type { SourceHealthItem } from "@/api/contracts"
import { liveStatusQueryOptions } from "@/api/queries"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { DATA_MODE } from "@/constants/api"
import {
  LIVE_STATUS_DISCLAIMER,
  LIVE_STATUS_ALL_HEALTHY,
  LIVE_STATUS_ERROR,
  LIVE_STATUS_LOADING,
  LIVE_STATUS_SOURCES_TITLE,
  LIVE_STATUS_TITLE,
  LIVE_STATUS_TRIGGER_LABEL,
  SOURCE_HEALTH_META,
} from "@/constants/live-status"
import { STUB_BADGE_LABEL } from "@/constants/stubs"
import { IS_SEED_MODE } from "@/api/client"
import { DataModeNotice } from "./DataModeNotice"
import { SourceHealthMarkIcon } from "./SourceHealthMark"
import { SourceStatusList } from "./SourceStatusList"
import { summarizeSources } from "./live-status-model"

// Этап F6. Индикатор стоит в шапке, потому что состояние источников относится
// ко всему экрану, а не к выбранному событию. Подробности — в поповере:
// на проекторе шапка должна оставаться одной строкой.
//
// Свой `staleTime` (60 с) задан в `liveStatusQueryOptions`: это единственные
// данные демо, которые во время показа могут измениться.

function SourcesSection({
  sources,
  isPending,
  isError,
}: {
  sources: readonly SourceHealthItem[] | undefined
  isPending: boolean
  isError: boolean
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="font-medium">{LIVE_STATUS_SOURCES_TITLE}</h3>
      {isPending && (
        <p className="text-muted-foreground">{LIVE_STATUS_LOADING}</p>
      )}
      {isError && <p className="text-muted-foreground">{LIVE_STATUS_ERROR}</p>}
      {sources && <SourceStatusList sources={sources} />}
    </section>
  )
}

export function LiveStatusIndicator() {
  const { data, isPending, isError } = useQuery(liveStatusQueryOptions)
  const summary = data ? summarizeSources(data.sources) : null

  // Строка триггера: худшее состояние и сколько источников в нём. «Не знаем»
  // (запрос идёт или не удался) — тоже состояние, и оно не притворяется нулём.
  const summaryText = isPending
    ? LIVE_STATUS_LOADING
    : isError
      ? LIVE_STATUS_ERROR
      : summary === null
        ? null
        : summary.allHealthy
          ? LIVE_STATUS_ALL_HEALTHY
          : `${SOURCE_HEALTH_META[summary.worstStatus].shortLabel}: ${summary.worstCount} из ${summary.total}`

  return (
    <Popover>
      <PopoverTrigger
        className="-my-1 ml-auto flex shrink-0 items-center gap-2 px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`${LIVE_STATUS_TITLE}. ${LIVE_STATUS_TRIGGER_LABEL}${
          summaryText === null ? "" : ` — ${summaryText}`
        }`}
      >
        {/* «Не знаем» и «ни разу не опрашивался» — одно начертание: обе метки
            говорят, что успешного опроса не было. */}
        <SourceHealthMarkIcon
          mark={
            summary === null
              ? "dashed"
              : SOURCE_HEALTH_META[summary.worstStatus].mark
          }
        />
        <span className="hidden sm:inline">{LIVE_STATUS_TRIGGER_LABEL}</span>
        {summaryText !== null && (
          <span className="hidden truncate md:inline">{summaryText}</span>
        )}
        {IS_SEED_MODE && (
          <Badge variant="outline" className="font-normal">
            {STUB_BADGE_LABEL}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[calc(100svh-4rem)] w-104 max-w-[calc(100vw-2rem)] gap-2.5 overflow-y-auto"
      >
        <PopoverTitle>{LIVE_STATUS_TITLE}</PopoverTitle>
        {/* Оговорка стоит первой: поповер прокручивается, а именно эту строку
            зритель обязан увидеть без прокрутки. */}
        <p className="border-b pb-2.5 text-pretty text-muted-foreground">
          {LIVE_STATUS_DISCLAIMER}
        </p>
        <DataModeNotice mode={DATA_MODE} />
        <SourcesSection
          sources={data?.sources}
          isPending={isPending}
          isError={isError}
        />
      </PopoverContent>
    </Popover>
  )
}
