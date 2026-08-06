import type { DataMode } from "@/constants/api"
import {
  DATA_MODE_API_SUMMARY,
  DATA_MODE_SEED_EXPLANATION,
  DATA_MODE_SEED_SUMMARY,
  DATA_MODE_TITLE,
  MAP_COORDS_DISCLAIMER,
  MAP_COORDS_DISCLAIMER_TITLE,
  STUB_DATA_SOURCES,
  STUB_ENDPOINT_MISSING,
  STUB_ENDPOINT_READY,
} from "@/constants/stubs"

// Что на экране приходит из файла, а что заменит бэкенд. Реестр показывается
// в обоих режимах: в `seed` он объясняет происхождение данных, в `api` —
// какие эндпоинты уже отвечают, а какие ещё нет (пустая колонка в api-режиме
// имеет ровно эту причину).

type DataModeNoticeProps = {
  mode: DataMode
}

export function DataModeNotice({ mode }: DataModeNoticeProps) {
  const isSeed = mode === "seed"

  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="font-medium">{DATA_MODE_TITLE}</h3>
      <p className="text-pretty text-muted-foreground">
        {isSeed ? DATA_MODE_SEED_SUMMARY : DATA_MODE_API_SUMMARY}
      </p>
      {isSeed && (
        <p className="text-pretty text-muted-foreground">
          {DATA_MODE_SEED_EXPLANATION}
        </p>
      )}
      <ul className="flex flex-col gap-1.5 border-t pt-1.5">
        {STUB_DATA_SOURCES.map((source) => (
          <li key={source.id}>
            <p className="text-pretty">{source.screenArea}</p>
            <p className="text-muted-foreground">
              <code className="font-mono">{source.endpoint}</code> —{" "}
              {source.backendReady
                ? STUB_ENDPOINT_READY
                : STUB_ENDPOINT_MISSING}
            </p>
          </li>
        ))}
      </ul>
      {/* Оговорка про карту стоит в этом же реестре, а не плашкой поверх неё
          (решение владельца продукта 06.08.2026): «что на экране не из
          проверенных данных» — один список, а не метки по всему интерфейсу. */}
      <div className="border-t pt-1.5">
        <p className="font-medium">{MAP_COORDS_DISCLAIMER_TITLE}</p>
        <p className="text-pretty text-muted-foreground">
          {MAP_COORDS_DISCLAIMER}
        </p>
      </div>
    </section>
  )
}
