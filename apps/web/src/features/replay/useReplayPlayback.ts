import { useEffect, useState } from "react"

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { getReplayPositionMs, useReplayStore } from "@/stores/replayStore"

/**
 * Драйвер воспроизведения: один setTimeout до границы следующего шага,
 * задержка каждый раз считается от performance.now() и абсолютного offsetMs —
 * цепочка относительных setTimeout накапливает дрейф («подводные камни» плана).
 * Пауза и перемотка меняют зависимости эффекта, и таймер пересоздаётся сам.
 * Монтируется один раз — в ReplayTimeline.
 */
export function useReplayPlayback() {
  const scenario = useReplayStore((state) => state.scenario)
  const status = useReplayStore((state) => state.status)
  const stepIndex = useReplayStore((state) => state.stepIndex)
  const anchorTimeMs = useReplayStore((state) => state.anchorTimeMs)

  useEffect(() => {
    if (!scenario || status !== "playing") return
    const nextIndex = stepIndex + 1
    const next = scenario.steps[nextIndex]
    if (!next) {
      // Играть дальше некуда — паркуем реплей в finished.
      useReplayStore.getState().advanceToStep(nextIndex)
      return
    }
    const delay = next.offsetMs - getReplayPositionMs(useReplayStore.getState())
    const timer = setTimeout(
      () => useReplayStore.getState().advanceToStep(nextIndex),
      Math.max(0, delay)
    )
    return () => clearTimeout(timer)
  }, [scenario, status, stepIndex, anchorTimeMs])
}

/**
 * Позиция плейхеда для отрисовки шкалы: во время воспроизведения обновляется
 * через requestAnimationFrame, на паузе — статичный якорь; null — реплей
 * не запущен. Живёт отдельно от стора, чтобы 60 fps не дёргали подписчиков.
 *
 * При системной настройке «меньше движения» rAF не запускается вовсе, и
 * плейхед стоит на offsetMs текущего шага: шаги реплея по-прежнему идут
 * (это содержание, а не анимация), но между ними ничего не ползёт.
 */
export function useReplayPositionMs(): number | null {
  const scenario = useReplayStore((state) => state.scenario)
  const status = useReplayStore((state) => state.status)
  const stepIndex = useReplayStore((state) => state.stepIndex)
  const anchorPositionMs = useReplayStore((state) => state.anchorPositionMs)
  const reduceMotion = usePrefersReducedMotion()
  const playing = scenario !== null && status === "playing"
  const animated = playing && !reduceMotion
  // Тикающее значение существует только во время воспроизведения; setState —
  // только из rAF-колбэка (правило react-hooks/set-state-in-effect).
  const [playheadMs, setPlayheadMs] = useState<number | null>(null)

  useEffect(() => {
    if (!animated) return
    let frame = requestAnimationFrame(function tick() {
      setPlayheadMs(getReplayPositionMs(useReplayStore.getState()))
      frame = requestAnimationFrame(tick)
    })
    return () => {
      cancelAnimationFrame(frame)
      setPlayheadMs(null)
    }
  }, [animated])

  if (!scenario) return null
  if (reduceMotion) {
    return scenario.steps[stepIndex]?.offsetMs ?? anchorPositionMs
  }
  return animated && playheadMs !== null ? playheadMs : anchorPositionMs
}
