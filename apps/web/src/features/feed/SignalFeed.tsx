import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import type { IncidentDetail, IncidentSummary } from "@/api/contracts"
import { incidentsQueryOptions } from "@/api/queries"
import { EvidenceLevelBadge } from "@/components/common"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { INCIDENT_SEARCH_PARAM } from "@/constants/routing"
import { useSelectedIncidentDetail } from "@/hooks/use-selected-incident-detail"
import { sameIncidentReference } from "@/lib/incident-reference"
import { cn } from "@/lib/utils"
import { SignalCard } from "./SignalCard"

// Лента §13: список расследований карточками; сигналы показываются под
// карточкой выбранного события из его detail — списковый эндпоинт сигналы
// не отдаёт (вопрос 2 плана), а detail уже загружен для схемы и панели.
export function SignalFeed() {
  const { t } = useTranslation()
  const incidentsQuery = useQuery(incidentsQueryOptions)
  const { selectedIncidentId, detail, isError } = useSelectedIncidentDetail()
  const [, setSearchParams] = useSearchParams()

  const selectIncident = (id: string) => {
    setSearchParams((params) => {
      params.set(INCIDENT_SEARCH_PARAM, id)
      return params
    })
  }

  return (
    <section
      aria-label={t("a11y.feedRegion")}
      className="flex min-h-0 flex-col"
    >
      <header className="border-b px-4 py-3">
        <h2 className="text-xs font-medium text-muted-foreground">
          Сигналы и расследования
        </h2>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        {incidentsQuery.data ? (
          <SignalFeedContent
            incidents={incidentsQuery.data}
            selectedIncidentId={selectedIncidentId}
            selectedDetail={detail}
            detailError={isError}
            onSelect={selectIncident}
          />
        ) : incidentsQuery.isError ? (
          <p className="p-4 text-sm text-muted-foreground">
            {t("app.dataLoadError")}
          </p>
        ) : (
          <FeedSkeleton />
        )}
      </ScrollArea>
    </section>
  )
}

type SignalFeedContentProps = {
  incidents: IncidentSummary[]
  selectedIncidentId: string | null
  /** Детали выбранного события; null — ещё грузятся или не загрузились. */
  selectedDetail: IncidentDetail | null
  detailError?: boolean
  onSelect: (id: string) => void
}

/** Презентационная часть ленты — контейнер и дев-превью отдают ей готовые данные. */
export function SignalFeedContent({
  incidents,
  selectedIncidentId,
  selectedDetail,
  detailError = false,
  onSelect,
}: SignalFeedContentProps) {
  const { t } = useTranslation()
  if (incidents.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {t("feed.noIncidents")}
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3 p-4">
      {incidents.map((incident) => (
        <IncidentCard
          key={incident.id}
          incident={incident}
          selected={sameIncidentReference(incident.id, selectedIncidentId)}
          detail={
            sameIncidentReference(
              selectedDetail?.investigation.id,
              incident.id
            )
              ? selectedDetail
              : null
          }
          detailError={detailError}
          onSelect={onSelect}
        />
      ))}
    </ul>
  )
}

type IncidentCardProps = {
  incident: IncidentSummary
  selected: boolean
  /** Детали — только у выбранной карточки, остальным всегда null. */
  detail: IncidentDetail | null
  detailError: boolean
  onSelect: (id: string) => void
}

function IncidentCard({
  incident,
  selected,
  detail,
  detailError,
  onSelect,
}: IncidentCardProps) {
  return (
    <li
      className={cn(
        "relative flex flex-col gap-1.5 border p-3 transition-colors",
        selected ? "border-foreground/40 bg-muted/40" : "hover:bg-muted/20"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Кнопка растянута на карточку псевдоэлементом: бейдж с тултипом и
            ссылки сигналов остаются настоящими интерактивными элементами,
            вложенных interactive внутри button нет. */}
        <button
          type="button"
          aria-current={selected || undefined}
          onClick={() => onSelect(incident.id)}
          className="cursor-pointer text-left text-sm font-medium text-pretty outline-none after:absolute after:inset-0 focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
        >
          {incident.title}
        </button>
        <EvidenceLevelBadge
          level={incident.evidenceLevel}
          compact
          className="relative"
        />
      </div>
      {selected && <SignalsBlock detail={detail} detailError={detailError} />}
    </li>
  )
}

type SignalsBlockProps = {
  detail: IncidentDetail | null
  detailError: boolean
}

// relative — блок должен ловить клики поверх растянутой кнопки карточки.
function SignalsBlock({ detail, detailError }: SignalsBlockProps) {
  const { t } = useTranslation()
  return (
    <div className="relative mt-1.5 flex flex-col gap-2 border-t pt-2.5">
      <h3 className="text-xs font-medium text-muted-foreground">
        {t("feed.signalsHeading")}
      </h3>
      {detail ? (
        detail.signals.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {detail.signals.map((signal) => (
              <li key={signal.id}>
                <SignalCard
                  signal={signal}
                  sourceDocument={
                    detail.sourceDocuments.find(
                      (doc) => doc.id === signal.sourceDocumentId
                    ) ?? null
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("feed.noSignals")}
          </p>
        )
      ) : detailError ? (
        <p className="text-xs text-muted-foreground">
          {t("app.dataLoadError")}
        </p>
      ) : (
        <div aria-hidden className="flex flex-col gap-2">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      )}
    </div>
  )
}

const FEED_SKELETON_CARDS = 3

function FeedSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3 p-4">
      {Array.from({ length: FEED_SKELETON_CARDS }, (_, index) => (
        <div key={index} className="flex flex-col gap-2 border p-3">
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ))}
    </div>
  )
}
