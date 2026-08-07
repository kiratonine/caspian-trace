import type { IncidentSummary } from "@/api/contracts"
import { sameIncidentReference } from "@/lib/incident-reference"

// Сопоставимые события — те, что описывают ОДИН участок наблюдений: одна
// область и один показатель, период известен. Связь берётся из полей API,
// а не выдумывается: как именно бэк свяжет май и сентябрь — вопрос 4 плана,
// до ответа сопоставимость выводится из region + indicator.

export function findComparablePeriods(
  summaries: IncidentSummary[],
  selectedId: string | null
): IncidentSummary[] {
  const selected = summaries.find((summary) =>
    sameIncidentReference(summary.id, selectedId)
  )
  if (!selected || selected.period === null) return []

  const group = summaries.filter(
    (s) =>
      s.period !== null &&
      s.region === selected.region &&
      s.indicator === selected.indicator
  )
  // Один период — сравнивать не с чем, переключатель не нужен.
  if (group.length < 2) return []

  // Свежий период первым: демо идёт от сентября к маю (ТЗ §14).
  return [...group].sort((a, b) => (a.period! < b.period! ? 1 : -1))
}

/** Сравнимы ли два события между собой (тот же участок и показатель). */
export function areComparable(
  a: IncidentSummary | undefined,
  b: IncidentSummary | undefined
): boolean {
  return (
    a !== undefined &&
    b !== undefined &&
    a.id !== b.id &&
    a.period !== null &&
    b.period !== null &&
    a.region === b.region &&
    a.indicator === b.indicator
  )
}

/**
 * Переключатель периодов имеет смысл только при паре и более. Предикат
 * общий: по нему `PeriodSwitcher` решает, показываться ли, а схема — печатать
 * ли дату отбора (когда кнопок нет, период иначе исчез бы с экрана).
 */
export function hasComparablePeriods(
  periods: readonly IncidentSummary[]
): boolean {
  return periods.length >= 2
}
