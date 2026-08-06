import { MAP_UNPLACED_NOTE, MAP_UNPLACED_TITLE } from "@/constants/map"
import type { CandidateObject, Station } from "@/types"

type UnplacedListProps = {
  stations: Station[]
  objects: CandidateObject[]
}

/**
 * Створы и объекты, чьё место в цепочке течения не подтверждено. На карту их
 * ставить нельзя, не выдумав положение (запрет 2 CLAUDE.md), поэтому вместо
 * этого прямо говорим, что не знаем.
 */
export function UnplacedList({ stations, objects }: UnplacedListProps) {
  if (stations.length === 0 && objects.length === 0) return null

  return (
    <section className="w-full shrink-0 space-y-1 lg:w-64">
      <h3 className="text-xs font-medium">{MAP_UNPLACED_TITLE}</h3>
      <p className="text-xs text-muted-foreground">{MAP_UNPLACED_NOTE}</p>
      <ul className="space-y-0.5 pt-1 text-xs text-muted-foreground">
        {objects.map((object) => (
          <li key={object.id}>{object.name}</li>
        ))}
        {stations.map((station) => (
          <li key={station.id}>{station.name}</li>
        ))}
      </ul>
    </section>
  )
}
