import {
  DOSSIER_NO_SIGNALS,
  DOSSIER_TIMELINE_OBSERVED,
  DOSSIER_TIMELINE_REPORTED,
} from "@/constants/dossier"
import {
  phenomenonLabel,
  VERIFICATION_STATUS_META,
} from "@/constants/phenomena"
import { formatDateTime, formatObservedDate } from "@/lib/format"
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
  if (entries.length === 0) {
    return <p className="text-muted-foreground">{DOSSIER_NO_SIGNALS}</p>
  }

  return (
    <ol className="flex flex-col gap-3">
      {entries.map(({ signal, sourceDocument }) => {
        const observedDate = formatObservedDate(signal)
        const chronology = [
          observedDate !== null &&
            `${DOSSIER_TIMELINE_OBSERVED}: ${observedDate}`,
          `${DOSSIER_TIMELINE_REPORTED}: ${formatDateTime(signal.reportedAt)}`,
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
                VERIFICATION_STATUS_META[signal.verificationStatus].label,
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
              <p className="text-xs text-muted-foreground text-pretty">
                {sourceDocument.title} · {sourceDocument.publisher}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
