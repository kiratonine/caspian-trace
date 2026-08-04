import { X } from "lucide-react"

import { EvidenceLevelBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  VERDICT_CHANGE_AFTER,
  VERDICT_CHANGE_BEFORE,
  VERDICT_CHANGE_DISMISS,
  VERDICT_CHANGE_EXPLANATION,
  VERDICT_CHANGE_TITLE,
} from "@/constants/comparison"
import { formatMonth } from "@/lib/format"
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
export function VerdictChange({
  before,
  after,
  onDismiss,
}: VerdictChangeProps) {
  return (
    <section
      aria-label={VERDICT_CHANGE_TITLE}
      className="flex flex-col gap-2 border-b bg-muted/30 px-4 py-3"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-medium tracking-widest uppercase">
          {VERDICT_CHANGE_TITLE}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          aria-label={VERDICT_CHANGE_DISMISS}
          title={VERDICT_CHANGE_DISMISS}
          className="-my-1 size-6 shrink-0"
        >
          <X />
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <VerdictSideRow label={VERDICT_CHANGE_BEFORE} side={before} muted />
        <VerdictSideRow label={VERDICT_CHANGE_AFTER} side={after} />
      </div>
      <p className="text-xs text-pretty text-muted-foreground">
        {VERDICT_CHANGE_EXPLANATION}
      </p>
    </section>
  )
}

type VerdictSideRowProps = {
  label: string
  side: VerdictSide
  /** Прошлый вывод приглушён: актуален тот, что показан ниже в панели. */
  muted?: boolean
}

// Оба вывода обрезаны до двух строк: плашка — сводка перехода, а целиком
// актуальный вывод читается в блоке 1 панели прямо под ней. Полный текст
// остаётся доступен в title (дословная формулировка с бэка не теряется).
function VerdictSideRow({ label, side, muted = false }: VerdictSideRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="uppercase">{label}</span>
        {side.period !== null && <span>{formatMonth(side.period)}</span>}
        <EvidenceLevelBadge level={side.evidenceLevel} compact />
      </p>
      <p
        title={side.conclusion}
        className={
          muted
            ? "line-clamp-2 text-xs text-pretty text-muted-foreground"
            : "line-clamp-2 text-xs text-pretty"
        }
      >
        {side.conclusion}
      </p>
    </div>
  )
}
