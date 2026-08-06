import { Link } from "react-router-dom"

import type { IncidentDetail } from "@/api/contracts"
import { EvidenceLevelBadge } from "@/components/common/EvidenceLevelBadge"
import { buttonVariants } from "@/components/ui/button"
import {
  MAP_VERDICT_CORRIDOR_PREFIX,
  MAP_VERDICT_DOSSIER_LINK,
  MAP_VERDICT_EVIDENCE_LINK,
  MAP_VERDICT_EXCLUDED_PREFIX,
} from "@/constants/map"
import { dossierPath } from "@/constants/routing"

type MapVerdictProps = {
  detail: IncidentDetail
  /** Готовая подпись участка; null — участка у события нет. */
  corridorLabel: string | null
  onOpenEvidence: () => void
}

/**
 * Заключение поверх карты. Процента вероятности здесь нет и не будет:
 * его не вычисляет ни расчётное ядро, ни фронт (запрет 6 CLAUDE.md), а
 * придуманное число рядом с именем юрлица было бы обвинением без основания.
 * Вместо него — то, что система действительно выдала: уровень
 * доказательности, границы участка и число версий, исключённых фактами.
 */
export function MapVerdict({
  detail,
  corridorLabel,
  onOpenEvidence,
}: MapVerdictProps) {
  const { investigation } = detail
  const excludedCount = investigation.contradictedHypotheses.length

  return (
    <aside className="pointer-events-auto w-full max-w-sm space-y-2 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur-sm">
      <EvidenceLevelBadge level={investigation.evidenceLevel} />
      {corridorLabel && (
        <p className="text-sm">
          <span className="text-muted-foreground">
            {MAP_VERDICT_CORRIDOR_PREFIX}{" "}
          </span>
          {corridorLabel}
        </p>
      )}
      {excludedCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {MAP_VERDICT_EXCLUDED_PREFIX} {excludedCount}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onOpenEvidence}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {MAP_VERDICT_EVIDENCE_LINK}
        </button>
        {/* Link + buttonVariants, а не Button render={<Link/>}: Base UI вешает
            на такой <a> role="button" и ломает «открыть в новой вкладке»
            (решение сессии 12). */}
        <Link
          to={dossierPath(investigation.id)}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {MAP_VERDICT_DOSSIER_LINK}
        </Link>
      </div>
    </aside>
  )
}
