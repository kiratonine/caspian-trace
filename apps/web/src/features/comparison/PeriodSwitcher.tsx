import { useTranslation } from "react-i18next"

import type { IncidentSummary } from "@/api/contracts"
import { EvidenceLevelBadge } from "@/components/common"
import { useFormat } from "@/i18n/use-format"
import { sameIncidentReference } from "@/lib/incident-reference"
import { cn } from "@/lib/utils"
import { hasComparablePeriods } from "./comparison-model"

type PeriodSwitcherProps = {
  periods: IncidentSummary[]
  selectedIncidentId: string | null
  onSelect: (id: string) => void
}

/**
 * Переключатель периодов одного участка (ТЗ §5, §14). Уровень стоит прямо
 * на кнопке: переключение периода — это смена вывода, а не смена фильтра,
 * и разница L2/L3 должна быть видна ещё до клика.
 */
export function PeriodSwitcher({
  periods,
  selectedIncidentId,
  onSelect,
}: PeriodSwitcherProps) {
  const { t } = useTranslation()
  const { formatMonth } = useFormat()
  if (!hasComparablePeriods(periods)) return null

  return (
    <nav aria-label={t("comparison.switcherLabel")}>
      <ul className="flex flex-wrap gap-2">
        {periods.map((period) => {
          const selected = sameIncidentReference(
            period.id,
            selectedIncidentId
          )
          return (
            <li key={period.id}>
              <button
                type="button"
                aria-current={selected || undefined}
                onClick={() => onSelect(period.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  selected
                    ? "border-foreground/40 bg-muted/60 font-medium"
                    : "text-muted-foreground hover:bg-muted/30"
                )}
              >
                {period.period !== null && formatMonth(period.period)}
                <EvidenceLevelBadge level={period.evidenceLevel} compact />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
