import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"

import { SourceLink } from "@/components/common"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useFormat } from "@/i18n/use-format"
import { usePhenomenonLabel } from "@/i18n/use-labels"
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
  const { t } = useTranslation()
  const phenomenonLabel = usePhenomenonLabel()
  const [open, setOpen] = useState(false)
  const { formatDateTime, formatObservedDate } = useFormat()

  // Дата наблюдения может быть известна с точностью до месяца или неизвестна
  // совсем — тогда строки «Наблюдалось …» в хронологии просто нет.
  const observedDate = formatObservedDate(signal)
  const details = [
    phenomenonLabel(signal.phenomenon),
    signal.locationText,
    observedDate !== null && `${t("feed.signalObservedPrefix")} ${observedDate}`,
  ].filter((part): part is string => typeof part === "string")

  return (
    <article className="flex flex-col gap-1">
      <h4 className="text-sm font-medium text-pretty">{signal.title}</h4>
      <p className="text-xs text-muted-foreground">
        {t(`phenomena.verificationStatus.${signal.verificationStatus}`)} ·{" "}
        {t("feed.signalReportedPrefix")} {formatDateTime(signal.reportedAt)}
      </p>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronRight
            aria-hidden
            className={cn("size-3 transition-transform", open && "rotate-90")}
          />
          {t("feed.signalDetailsLabel")}
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
