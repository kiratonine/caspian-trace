import { CorridorBand } from "./CorridorBand"
import { StationNode } from "./StationNode"
import type { SchemeModel, StationSchemeEntry } from "./scheme-model"

type OrderedStationsProps = {
  /** Уже отсортированы по riverOrder: первый — выше всех по течению. */
  entries: StationSchemeEntry[]
  corridor: SchemeModel["corridor"]
}

/**
 * Упорядоченные створы: сверху вниз по течению, лента коридора между границами.
 * Вертикальной линии через узлы больше нет (решение сессии 16, минимализм):
 * подтверждённый порядок читается из подзаголовка схемы и из оговорки у группы
 * без ранжирования, а лишняя графика на проекторе только шумела.
 */
export function OrderedStations({ entries, corridor }: OrderedStationsProps) {
  const downstreamIndex = corridor
    ? entries.findIndex((e) => e.station.id === corridor.downstreamStationId)
    : -1
  const openUp = corridor?.upstreamStationId == null
  const upstreamIndex =
    !corridor || downstreamIndex === -1
      ? -1
      : openUp
        ? 0 // интервал открыт вверх — лента начинается с верхнего края линии
        : entries.findIndex((e) => e.station.id === corridor.upstreamStationId)
  const hasBand =
    downstreamIndex !== -1 &&
    upstreamIndex !== -1 &&
    upstreamIndex <= downstreamIndex

  const row = (entry: StationSchemeEntry) => (
    <StationNode key={entry.station.id} entry={entry} />
  )

  return (
    <div className="relative">
      {hasBand ? (
        <>
          {entries.slice(0, upstreamIndex).map(row)}
          <CorridorBand openUp={openUp}>
            {entries.slice(upstreamIndex, downstreamIndex + 1).map(row)}
          </CorridorBand>
          {entries.slice(downstreamIndex + 1).map(row)}
        </>
      ) : (
        entries.map(row)
      )}
    </div>
  )
}
