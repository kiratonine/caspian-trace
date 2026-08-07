import { useTranslation } from "react-i18next"

import type { DataMode } from "@/constants/api"
import { STUB_DATA_SOURCES } from "@/constants/stubs"

// Что на экране приходит из файла, а что заменит бэкенд. Реестр показывается
// в обоих режимах: в `seed` он объясняет происхождение данных, в `api` —
// какие эндпоинты уже отвечают, а какие ещё нет (пустая колонка в api-режиме
// имеет ровно эту причину).

type DataModeNoticeProps = {
  mode: DataMode
}

export function DataModeNotice({ mode }: DataModeNoticeProps) {
  const { t } = useTranslation()
  const isSeed = mode === "seed"

  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="font-medium">{t("stubs.dataModeTitle")}</h3>
      <p className="text-pretty text-muted-foreground">
        {isSeed
          ? t("stubs.dataModeSeedSummary")
          : t("stubs.dataModeApiSummary")}
      </p>
      {isSeed && (
        <p className="text-pretty text-muted-foreground">
          {t("stubs.dataModeSeedExplanation")}
        </p>
      )}
      <ul className="flex flex-col gap-1.5 border-t pt-1.5">
        {STUB_DATA_SOURCES.map((source) => (
          <li key={source.id}>
            <p className="text-pretty">
              {t(`stubs.source.${source.id}.screenArea`)}
            </p>
            <p className="text-muted-foreground">
              <code className="font-mono">{source.endpoint}</code> —{" "}
              {source.backendReady
                ? t("stubs.endpointReady")
                : t("stubs.endpointMissing")}
            </p>
          </li>
        ))}
      </ul>
      {/* Оговорка про карту стоит в этом же реестре, а не плашкой поверх неё
          (решение владельца продукта 06.08.2026): «что на экране не из
          проверенных данных» — один список, а не метки по всему интерфейсу. */}
      <div className="border-t pt-1.5">
        <p className="font-medium">{t("stubs.mapCoordsDisclaimerTitle")}</p>
        <p className="text-pretty text-muted-foreground">
          {t("stubs.mapCoordsDisclaimer")}
        </p>
      </div>
    </section>
  )
}
