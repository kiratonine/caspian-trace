import {
  MAP_RIVER_AMPLITUDE,
  MAP_RIVER_X,
  MAP_VIEWBOX_HEIGHT,
} from "@/constants/map"

// Форма русла условна и ничего не утверждает о географии (запрет 2 CLAUDE.md,
// оговорка стоит подписью под картой). Но линия и точки на ней обязаны считаться
// ОДНОЙ функцией: две независимые формулы разъедутся, и створы съедут с реки.

/** Горизонтальное положение русла на высоте y, в единицах viewBox. */
export function riverXAt(y: number): number {
  return (
    MAP_RIVER_X +
    MAP_RIVER_AMPLITUDE * Math.sin((y / MAP_VIEWBOX_HEIGHT) * Math.PI * 1.5)
  )
}

/**
 * Путь русла ломаной с мелким шагом — на экране это гладкая кривая, зато
 * каждая её точка получена той же `riverXAt`, что и точки створов.
 */
export function riverPathD(steps = 48): string {
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const y = (MAP_VIEWBOX_HEIGHT / steps) * index
    return `${riverXAt(y).toFixed(2)} ${y.toFixed(2)}`
  })
  return `M ${points.join(" L ")}`
}
