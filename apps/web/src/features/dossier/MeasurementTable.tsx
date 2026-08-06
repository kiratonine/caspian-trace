import { useTranslation } from "react-i18next"

import { MeasurementValue } from "@/components/common"
import {
  DOSSIER_MEASUREMENT_COLUMNS,
  DOSSIER_MEASUREMENT_SHARED_PREFIX,
  DOSSIER_NO_DATE,
  DOSSIER_NO_MEASUREMENTS,
} from "@/constants/dossier"
import { useFormat } from "@/i18n/use-format"
import { useMatrixLabel, useUnitLabel } from "@/i18n/use-labels"
import { useLocale } from "@/i18n/use-locale"
import {
  measurementSourceLabel,
  sharedMeasurementColumns,
  type DossierMeasurementRow,
} from "./dossier-model"

type MeasurementTableProps = {
  rows: DossierMeasurementRow[]
}

/**
 * Таблица измерений (роадмап §21.1, п. 6) — те же числа, что в бюллетене.
 * Значение остаётся кликабельным и в досье (критерий §16 п.5), а полные
 * названия и URL документов печатаются в разделе «Источники»: в колонке
 * достаточно издателя и страницы.
 *
 * Колонки, одинаковые во всех строках, печатаются один раз подзаголовком:
 * у события с однородными измерениями четыре колонки из шести были копиями
 * самих себя. Свёртка считается по данным (sharedMeasurementColumns), поэтому
 * разнородное событие получит полную таблицу.
 */
export function MeasurementTable({ rows }: MeasurementTableProps) {
  const { t } = useTranslation()
  const { formatMeasurement, formatSampledDate } = useFormat()
  const { locale } = useLocale()
  const unitLabel = useUnitLabel()
  const matrixLabel = useMatrixLabel()

  if (rows.length === 0) {
    return <p className="text-muted-foreground">{DOSSIER_NO_MEASUREMENTS}</p>
  }

  const shared = sharedMeasurementColumns(rows, locale, t)
  const sharedParts = [
    shared.indicator,
    shared.matrix,
    shared.sampledDate,
    shared.source,
  ].filter((part): part is string => part !== null)

  return (
    <div className="flex flex-col gap-1.5">
      {sharedParts.length > 0 && (
        <p className="text-xs text-pretty text-muted-foreground">
          {DOSSIER_MEASUREMENT_SHARED_PREFIX}: {sharedParts.join(" · ")}
        </p>
      )}
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b">
            <th className="py-1.5 pr-3 font-medium">
              {DOSSIER_MEASUREMENT_COLUMNS.station}
            </th>
            {shared.indicator === null && (
              <th className="py-1.5 pr-3 font-medium">
                {DOSSIER_MEASUREMENT_COLUMNS.indicator}
              </th>
            )}
            {shared.matrix === null && (
              <th className="py-1.5 pr-3 font-medium">
                {DOSSIER_MEASUREMENT_COLUMNS.matrix}
              </th>
            )}
            {shared.sampledDate === null && (
              <th className="py-1.5 pr-3 font-medium">
                {DOSSIER_MEASUREMENT_COLUMNS.sampledAt}
              </th>
            )}
            <th className="py-1.5 pr-3 font-medium last:pr-0">
              {DOSSIER_MEASUREMENT_COLUMNS.value}
            </th>
            {shared.source === null && (
              <th className="py-1.5 font-medium">
                {DOSSIER_MEASUREMENT_COLUMNS.source}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { measurement, station, sourceDocument } = row
            const sampledDate = formatSampledDate(measurement)

            return (
              <tr
                key={measurement.id}
                className="break-inside-avoid border-b align-baseline"
              >
                <td className="py-1.5 pr-3 text-pretty">
                  {station?.name ?? measurement.stationId}
                </td>
                {shared.indicator === null && (
                  <td className="py-1.5 pr-3">{measurement.indicator}</td>
                )}
                {shared.matrix === null && (
                  <td className="py-1.5 pr-3">
                    {matrixLabel(measurement.matrix)}
                  </td>
                )}
                {shared.sampledDate === null && (
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {sampledDate ?? (
                      <span className="text-muted-foreground">
                        {DOSSIER_NO_DATE}
                      </span>
                    )}
                  </td>
                )}
                <td className="py-1.5 pr-3">
                  {sourceDocument ? (
                    <MeasurementValue
                      measurement={measurement}
                      sourceDocument={sourceDocument}
                      className="text-xs"
                    />
                  ) : (
                    // Документа нет в ответе — число печатается без ссылки,
                    // но остаётся на своём месте в таблице.
                    <span className="font-medium tabular-nums">
                      {formatMeasurement(
                        measurement.value,
                        unitLabel(measurement.unit)
                      )}
                    </span>
                  )}
                </td>
                {shared.source === null && (
                  <td className="py-1.5 text-pretty text-muted-foreground">
                    {measurementSourceLabel(row)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
