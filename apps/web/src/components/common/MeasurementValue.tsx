import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatMeasurement, formatSampledDate } from "@/lib/format"
import { hasConfirmedPage, sourceHref } from "@/lib/source"
import { cn } from "@/lib/utils"
import type { Measurement, SourceDocument } from "@/types"

type MeasurementValueProps = {
  measurement: Measurement
  /** Документ, из которого взято число; ищется по `measurement.sourceDocumentId`. */
  sourceDocument: SourceDocument
  className?: string
}

/**
 * Любое число в интерфейсе кликабельно и открывает документ и страницу,
 * откуда оно взято (критерий приёмки №5 ТЗ §16).
 */
export function MeasurementValue({
  measurement,
  sourceDocument,
  className,
}: MeasurementValueProps) {
  const pageConfirmed = hasConfirmedPage(sourceDocument, measurement.sourcePage)
  // Даты может не быть вовсе — тогда в подписи её просто нет, а не пустое место.
  const sampledDate = formatSampledDate(measurement)

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={sourceHref(sourceDocument, measurement.sourcePage)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "font-medium whitespace-nowrap tabular-nums underline decoration-muted-foreground/50 decoration-dotted underline-offset-4 outline-none hover:decoration-current hover:decoration-solid focus-visible:decoration-current focus-visible:decoration-solid",
              className
            )}
          >
            {formatMeasurement(measurement.value, measurement.unit)}
          </a>
        }
      />
      <TooltipContent>
        <p className="max-w-64 text-pretty">
          {measurement.indicator}
          {sampledDate && `, ${sampledDate}`} · {sourceDocument.title}
          {pageConfirmed
            ? `, стр. ${measurement.sourcePage}`
            : " (страница уточняется)"}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
