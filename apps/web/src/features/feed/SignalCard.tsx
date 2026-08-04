import { SourceLink } from "@/components/common"
import {
  FEED_SIGNAL_OBSERVED_PREFIX,
  FEED_SIGNAL_REPORTED_PREFIX,
} from "@/constants/feed"
import {
  phenomenonLabel,
  VERIFICATION_STATUS_META,
} from "@/constants/phenomena"
import { formatDateTime, formatObservedDate } from "@/lib/format"
import type { IncidentSignal, SourceDocument } from "@/types"

type SignalCardProps = {
  signal: IncidentSignal
  /** Документ сигнала из detail.sourceDocuments; null — документ не приложен. */
  sourceDocument: SourceDocument | null
}

/**
 * Публичный сигнал в ленте: явление, статус проверки, дословная цитата
 * и ссылка на первоисточник — сигнал тоже должен вести к документу (§16 п.5).
 */
export function SignalCard({ signal, sourceDocument }: SignalCardProps) {
  // Дата наблюдения может быть известна с точностью до месяца или неизвестна
  // совсем — тогда строки «Наблюдалось …» в хронологии просто нет.
  const observedDate = formatObservedDate(signal)
  const chronology = [
    signal.locationText,
    observedDate !== null && `${FEED_SIGNAL_OBSERVED_PREFIX} ${observedDate}`,
    `${FEED_SIGNAL_REPORTED_PREFIX} ${formatDateTime(signal.reportedAt)}`,
  ].filter((part): part is string => typeof part === "string")

  return (
    <article className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">
        {phenomenonLabel(signal.phenomenon)} ·{" "}
        {VERIFICATION_STATUS_META[signal.verificationStatus].label}
      </p>
      <h4 className="text-sm font-medium text-pretty">{signal.title}</h4>
      {signal.excerpt && (
        <p className="text-xs text-pretty text-muted-foreground italic">
          «{signal.excerpt}»
        </p>
      )}
      <p className="text-xs text-muted-foreground">{chronology.join(" · ")}</p>
      {sourceDocument && <SourceLink sourceDocument={sourceDocument} />}
    </article>
  )
}
