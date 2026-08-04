import { SearchX } from "lucide-react"

import {
  INSUFFICIENT_DATA_EXPLANATION,
  INSUFFICIENT_DATA_REASONS_LABEL,
  INSUFFICIENT_DATA_TITLE,
} from "@/constants/strings"
import { cn } from "@/lib/utils"

type InsufficientDataProps = {
  /** Причины отказа от вывода — приходят с бэка (unknowns), фронт их не сочиняет. */
  reasons: string[]
  className?: string
}

/**
 * «Недостаточно данных» — полноценный результат проверки, не ошибка (ТЗ §6):
 * продукт публикует отказ от вывода с причинами так же охотно, как вывод.
 */
export function InsufficientData({
  reasons,
  className,
}: InsufficientDataProps) {
  return (
    <section
      role="status"
      className={cn("flex flex-col gap-4 border border-dashed p-6", className)}
    >
      <div className="flex items-center gap-2.5">
        <SearchX
          aria-hidden
          className="size-5 shrink-0 text-muted-foreground"
        />
        <h3 className="text-base font-semibold">{INSUFFICIENT_DATA_TITLE}</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        {INSUFFICIENT_DATA_EXPLANATION}
      </p>
      {reasons.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            {INSUFFICIENT_DATA_REASONS_LABEL}
          </h4>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
