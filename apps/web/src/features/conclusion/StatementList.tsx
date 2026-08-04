import { MeasurementValue } from "@/components/common"
import type { StatementEntry } from "./panel-model"

type StatementListProps = {
  entries: StatementEntry[]
  /** Пустое состояние — своё у фактов и у версий (константы panel.ts). */
  emptyText: string
}

/**
 * Утверждения «Что установлено» / «Что не подтверждается» (§13, блоки 3–4):
 * текст приходит с бэка дословно, под ним — измерения-основания с кликабельными
 * значениями. Один компонент на оба блока — различие только в данных.
 */
export function StatementList({ entries, emptyText }: StatementListProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {entries.map(({ statement, refs }) => (
        <li key={statement.id} className="flex flex-col gap-1.5">
          <p className="text-sm text-pretty">{statement.text}</p>
          {refs.length > 0 && (
            <ul className="flex flex-col gap-1 border-l pl-3">
              {refs.map(({ measurement, station, sourceDocument }) => (
                <li
                  key={measurement.id}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="text-xs text-pretty text-muted-foreground">
                    {station?.name ?? measurement.stationId}
                  </span>
                  {sourceDocument && (
                    <MeasurementValue
                      measurement={measurement}
                      sourceDocument={sourceDocument}
                      className="text-xs"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}
