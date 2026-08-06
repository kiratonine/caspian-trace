import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { unitLabel } from "@/constants/units"
import { useFormat } from "@/i18n/use-format"
import { hasConfirmedPage, sourceHref } from "@/lib/source"
import { cn } from "@/lib/utils"
import type { Measurement, SourceDocument } from "@/types"

type MeasurementValueProps = {
  measurement: Measurement
  /** Документ, из которого взято число; ищется по `measurement.sourceDocumentId`. */
  sourceDocument: SourceDocument
  /**
   * false — единица печатается один раз подписью столбца, а не у каждого
   * значения. Из тултипа она не уходит: число без размерности непроверяемо.
   */
  showUnit?: boolean
  className?: string
}

/**
 * Любое число в интерфейсе кликабельно и открывает документ и страницу,
 * откуда оно взято (критерий приёмки №5 ТЗ §16).
 */
export function MeasurementValue({
  measurement,
  sourceDocument,
  showUnit = true,
  className,
}: MeasurementValueProps) {
  const { formatMeasurement, formatNumber, formatSampledDate } = useFormat()
  const pageConfirmed = hasConfirmedPage(sourceDocument, measurement.sourcePage)
  // Даты может не быть вовсе — тогда в подписи её просто нет, а не пустое место.
  const sampledDate = formatSampledDate(measurement)
  const full = formatMeasurement(measurement.value, unitLabel(measurement.unit))

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
            {showUnit ? full : formatNumber(measurement.value)}
          </a>
        }
      />
      <TooltipContent>
        <p className="max-w-64 text-pretty">
          {!showUnit && <>{full} · </>}
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
