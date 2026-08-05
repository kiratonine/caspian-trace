import type { SourceHealthItem } from "@/api/contracts"
import {
  LIVE_STATUS_CACHE_AVAILABLE,
  LIVE_STATUS_CACHE_MISSING,
  LIVE_STATUS_EMPTY,
  LIVE_STATUS_LAST_SUCCESS_LABEL,
  LIVE_STATUS_NEVER_SUCCEEDED,
  SOURCE_HEALTH_META,
} from "@/constants/live-status"
import { formatDateTime } from "@/lib/format"
import { sortSourcesBySeverity } from "./live-status-model"
import { SourceHealthMarkIcon } from "./SourceHealthMark"

// Список источников: состояние, время последнего успешного опроса и наличие
// кэша — три вещи, по которым видно, чем именно наполнен экран. Компонент
// презентационный: данные приходят пропом, дев-превью показывает им же
// состояния, которых нет в фикстуре.

type SourceStatusListProps = {
  sources: readonly SourceHealthItem[]
}

export function SourceStatusList({ sources }: SourceStatusListProps) {
  if (sources.length === 0) {
    return <p className="text-muted-foreground">{LIVE_STATUS_EMPTY}</p>
  }

  const sorted = sortSourcesBySeverity(sources)

  return (
    <ul className="flex flex-col gap-2.5">
      {sorted.map((source, index) => {
        const meta = SOURCE_HEALTH_META[source.status]
        // Список отсортирован по состоянию, поэтому одинаковые идут подряд:
        // расшифровка печатается один раз на группу. Четыре одинаковых абзаца
        // подряд — шум, а не подсказка (тот же довод, что у тултипов-дублей).
        const isFirstOfStatus =
          index === 0 || sorted[index - 1]!.status !== source.status

        return (
          <li key={source.id} className="flex gap-2">
            <SourceHealthMarkIcon mark={meta.mark} className="mt-1.5" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-pretty">{source.name}</p>
              <p className="text-pretty text-muted-foreground">
                <span className="text-foreground">{meta.label}.</span>{" "}
                {isFirstOfStatus && meta.description}
              </p>
              <p className="text-muted-foreground">
                {LIVE_STATUS_LAST_SUCCESS_LABEL}:{" "}
                {source.lastSuccessAt === null
                  ? LIVE_STATUS_NEVER_SUCCEEDED
                  : formatDateTime(source.lastSuccessAt)}{" "}
                ·{" "}
                {source.cacheAvailable
                  ? LIVE_STATUS_CACHE_AVAILABLE
                  : LIVE_STATUS_CACHE_MISSING}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
