import type { IncidentDetail } from "@/api/contracts"
import { EvidenceLevelBadge, InsufficientData } from "@/components/common"
import { REGION_LABELS } from "@/constants/regions"

// Экран «недостаточно данных» (ТЗ §13 «Экран Актау», §7.6) — полноценное
// состояние центральной колонки, когда у события нет ни одного створа:
// отказ от вывода показывается так же охотно, как схема показывает вывод.
// Всё содержимое приходит с бэка: заголовок и осторожный вывод — дословно,
// причины — unknowns; экран ничего не сочиняет и не хардкодит кейс Актау.

type InsufficientDataScreenProps = {
  detail: IncidentDetail
}

export function InsufficientDataScreen({
  detail,
}: InsufficientDataScreenProps) {
  const { investigation, region } = detail

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="flex w-full max-w-xl flex-col gap-5">
          <header className="flex flex-col items-start gap-2">
            <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              {REGION_LABELS[region]}
            </p>
            <h2 className="text-lg font-semibold text-balance">
              {investigation.title}
            </h2>
            <EvidenceLevelBadge level={investigation.evidenceLevel} />
          </header>
          <blockquote className="border-l-2 pl-4 text-base leading-relaxed text-pretty">
            {investigation.conclusion}
          </blockquote>
          <InsufficientData reasons={investigation.unknowns} />
        </div>
      </div>
    </div>
  )
}
