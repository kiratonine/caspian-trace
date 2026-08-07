import type { SourceHealthMark } from "@/constants/live-status"
import { cn } from "@/lib/utils"

// Метка состояния — форма, не цвет (см. комментарий в constants/live-status.ts).
// Пять разных начертаний, по одному на состояние: на монохромном проекторе
// цвет не различается, а форма различается.
const MARK_CLASSES: Record<SourceHealthMark, string> = {
  filled: "rounded-full bg-foreground",
  ring: "rounded-full border-2 border-foreground",
  square: "bg-foreground",
  diamond: "rotate-45 bg-foreground",
  dashed: "rounded-full border border-dashed border-muted-foreground",
}

type SourceHealthMarkProps = {
  /** Начертание берётся из справочника статусов; `dashed` — ещё и «не знаем». */
  mark: SourceHealthMark
  className?: string
}

export function SourceHealthMarkIcon({
  mark,
  className,
}: SourceHealthMarkProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0",
        MARK_CLASSES[mark],
        className
      )}
    />
  )
}
