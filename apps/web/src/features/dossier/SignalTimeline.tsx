import { useTranslation } from "react-i18next"

import { useFormat } from "@/i18n/use-format"
import { usePhenomenonLabel } from "@/i18n/use-labels"
import type { DossierSignalEntry } from "./dossier-model"

type SignalTimelineProps = {
  entries: DossierSignalEntry[]
}

/**
 * Хронология сигналов (роадмап §21.1, п. 5): что и когда наблюдали, когда
 * об этом сообщили и откуда цитата. Даты — те же, что на экране; неизвестная
 * дата наблюдения просто не выводится, а не заменяется датой публикации.
 */
export function SignalTimeline({ entries }: SignalTimelineProps) {
  const { t } = useTranslation()
  const phenomenonLabel = usePhenomenonLabel()
  const { formatDateTime, formatObservedDate } = useFormat()
  if (entries.length === 0) {
    return <p className="text-muted-foreground">{t("dossier.noSignals")}</p>
  }

  return (
    <ol className="flex flex-col gap-3">
      {entries.map(({ signal, sourceDocument }) => {
        const observedDate = formatObservedDate(signal)
        const chronology = [
          observedDate !== null &&
            `${t("dossier.timelineObserved")}: ${observedDate}`,
          `${t("dossier.timelineReported")}: ${formatDateTime(signal.reportedAt)}`,
        ].filter((part): part is string => typeof part === "string")

        return (
          <li
            key={signal.id}
            className="flex break-inside-avoid flex-col gap-1 border-l pl-3"
          >
            <p className="text-xs text-muted-foreground">
              {chronology.join(" · ")}
            </p>
            <p className="font-medium text-pretty">{signal.title}</p>
            <p className="text-xs text-muted-foreground">
              {[
                phenomenonLabel(signal.phenomenon),
                t(`phenomena.verificationStatus.${signal.verificationStatus}`),
                signal.locationText,
              ].join(" · ")}
            </p>
            {signal.excerpt && (
              <p className="text-pretty italic">«{signal.excerpt}»</p>
            )}
            {/* URL и хэш документа печатаются в разделе «Источники» — здесь
                достаточно названия, чтобы строку хронологии можно было
                сверить с полным списком. */}
            {sourceDocument && (
              <p className="text-xs text-pretty text-muted-foreground">
                {sourceDocument.title} · {sourceDocument.publisher}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
