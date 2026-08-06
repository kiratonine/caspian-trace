import { ArrowUp } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

type CorridorBandProps = {
  /** Верхней границы нет (upstreamStationId = null): лента растворяется кверху. */
  openUp: boolean
  children: ReactNode
}

// Открытый вверх интервал раньше рисовался рамкой со срезанной верхней гранью —
// и читался как незакрытый прямоугольник, то есть как дефект вёрстки. Теперь
// у ленты нет рамки вовсе: заливка и рельс слева просто исчезают кверху.
// Растворение честнее среза: у интервала действительно нет верхней границы.
// 1.25rem, а не больше: у сентября коридор — одна строка высотой ~2.5rem,
// и длинный градиент не успевал набрать плотность, лента выглядела блёклой.
const FADE_UP =
  "[mask-image:linear-gradient(to_bottom,transparent,#000_1.25rem)]"

/**
 * Лента вероятного коридора вокруг участка между створами-границами.
 * Коридор — данные бэка (corridorBounds), фронт его не вычисляет (запрет 6);
 * монохромная заливка — это не «зона опасности» (запрет 4).
 */
export function CorridorBand({ openUp, children }: CorridorBandProps) {
  const { t } = useTranslation()
  return (
    <div className="-mx-3">
      <p className="flex items-center justify-end gap-1 px-3 pb-1 text-[10px] font-medium text-muted-foreground">
        {openUp && <ArrowUp aria-hidden className="size-3 shrink-0" />}
        {t("scheme.corridorLabel")}
        {openUp && <span>· {t("scheme.corridorOpenUpNote")}</span>}
      </p>
      <div className="relative px-3 pb-1">
        {/* Декоративные слои маскируются отдельно от содержимого: маска на
            всей ленте затянула бы и подписи створов. */}
        <span
          aria-hidden
          className={cn("absolute inset-0 bg-foreground/5", openUp && FADE_UP)}
        />
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 w-0.5 bg-foreground/25",
            openUp && FADE_UP
          )}
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  )
}
