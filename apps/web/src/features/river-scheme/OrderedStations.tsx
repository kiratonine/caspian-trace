import { CorridorBand } from "./CorridorBand"
import { StationNode } from "./StationNode"
import type { SchemeModel, StationSchemeEntry } from "./scheme-model"

type OrderedStationsProps = {
  /** Уже отсортированы по riverOrder: первый — выше всех по течению. */
  entries: StationSchemeEntry[]
  corridor: SchemeModel["corridor"]
}

/** Линия реки: вертикаль через центры узлов, лента коридора между границами. */
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
      {/* Узлы size-2.5 → центр в 5px от края ряда; линия w-px по центру. */}
      <span
        aria-hidden
        className="left-1.125 absolute inset-y-4 w-px bg-border"
      />
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
