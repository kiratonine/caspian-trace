import { X } from "lucide-react"
import { useTranslation } from "react-i18next"

import { EvidenceLevelBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useFormat } from "@/i18n/use-format"
import type { EvidenceLevel } from "@/types"

export type VerdictSide = {
  /** Период события, ISO с точностью до месяца. */
  period: string | null
  evidenceLevel: EvidenceLevel
  /** Дословный вывод с бэка — фронт его не пересказывает и не сокращает. */
  conclusion: string
}

type VerdictChangeProps = {
  before: VerdictSide
  after: VerdictSide
  onDismiss: () => void
}

/**
 * «Вывод изменился» — главный сюжет демо (ТЗ §5, §14): при переходе между
 * периодами одного участка видно, что поменялся сам вывод и его уровень,
 * а не просто список значений. Живёт вне прокручиваемой области панели,
 * чтобы не потеряться, если панель прокручена.
 */
export function VerdictChange({ before, onDismiss }: VerdictChangeProps) {
  const { t } = useTranslation()
  return (
    <section
      aria-label={t("comparison.verdictChangeTitle")}
      className="flex flex-col gap-2 border-b bg-muted/30 px-4 py-3"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-medium">
          {t("comparison.verdictChangeTitle")}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          aria-label={t("comparison.verdictChangeDismiss")}
          title={t("comparison.verdictChangeDismiss")}
          className="-my-1 size-6 shrink-0"
        >
          <X />
        </Button>
      </div>
      {/* Показывается только ПРОШЛЫЙ вывод: актуальный дословно печатают блоки
          1 и 2 панели прямо под плашкой, и вторая его копия здесь была самым
          крупным дублем экрана. Контраст остаётся, но пространственный:
          «было» в плашке, «стало» — ниже. */}
      <VerdictSideRow label={t("comparison.verdictChangeBefore")} side={before} />
      <p className="text-xs text-pretty text-muted-foreground">
        {t("comparison.verdictChangeExplanation")}
      </p>
    </section>
  )
}

type VerdictSideRowProps = {
  label: string
  side: VerdictSide
}

// Вывод обрезан до двух строк: плашка — сводка перехода, а целиком прошлый
// текст остаётся в title (дословная формулировка с бэка не теряется).
function VerdictSideRow({ label, side }: VerdictSideRowProps) {
  const { formatMonth } = useFormat()
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
        {side.period !== null && <span>{formatMonth(side.period)}</span>}
        <EvidenceLevelBadge level={side.evidenceLevel} compact />
      </p>
      <p
        title={side.conclusion}
        className="line-clamp-2 text-xs text-pretty text-muted-foreground"
      >
        {side.conclusion}
      </p>
    </div>
  )
}
