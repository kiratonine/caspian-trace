import { useState } from "react"
import { ChevronRight } from "lucide-react"

import { SourceLink } from "@/components/common"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  FEED_SIGNAL_DETAILS_LABEL,
  FEED_SIGNAL_OBSERVED_PREFIX,
  FEED_SIGNAL_REPORTED_PREFIX,
} from "@/constants/feed"
import {
  phenomenonLabel,
  VERIFICATION_STATUS_META,
} from "@/constants/phenomena"
import { formatDateTime, formatObservedDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { IncidentSignal, SourceDocument } from "@/types"

type SignalCardProps = {
  signal: IncidentSignal
  /** Документ сигнала из detail.sourceDocuments; null — документ не приложен. */
  sourceDocument: SourceDocument | null
}

/**
 * Публичный сигнал в ленте. Свёрнутый вид — заголовок и статус проверки:
 * этого хватает, чтобы понять, что за сигнал и насколько он подтверждён.
 * Цитата, место, хронология и ссылка на первоисточник раскрываются по клику —
 * они остаются доступными (сигнал обязан вести к документу, §16 п.5), но не
 * занимают колонку целиком.
 */
export function SignalCard({ signal, sourceDocument }: SignalCardProps) {
  const [open, setOpen] = useState(false)

  // Дата наблюдения может быть известна с точностью до месяца или неизвестна
  // совсем — тогда строки «Наблюдалось …» в хронологии просто нет.
  const observedDate = formatObservedDate(signal)
  const details = [
    phenomenonLabel(signal.phenomenon),
    signal.locationText,
    observedDate !== null && `${FEED_SIGNAL_OBSERVED_PREFIX} ${observedDate}`,
  ].filter((part): part is string => typeof part === "string")

  return (
    <article className="flex flex-col gap-1">
      <h4 className="text-sm font-medium text-pretty">{signal.title}</h4>
      <p className="text-xs text-muted-foreground">
        {VERIFICATION_STATUS_META[signal.verificationStatus].label} ·{" "}
        {FEED_SIGNAL_REPORTED_PREFIX} {formatDateTime(signal.reportedAt)}
      </p>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronRight
            aria-hidden
            className={cn("size-3 transition-transform", open && "rotate-90")}
          />
          {FEED_SIGNAL_DETAILS_LABEL}
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-1.5 pt-1.5">
          {signal.excerpt && (
            <p className="text-xs text-pretty text-muted-foreground italic">
              «{signal.excerpt}»
            </p>
          )}
          <p className="text-xs text-pretty text-muted-foreground">
            {details.join(" · ")}
          </p>
          {sourceDocument && <SourceLink sourceDocument={sourceDocument} />}
        </CollapsibleContent>
      </Collapsible>
    </article>
  )
}
