import { MeasurementValue } from "@/components/common"
import {
  DOSSIER_MEASUREMENT_COLUMNS,
  DOSSIER_NO_DATE,
  DOSSIER_NO_MEASUREMENTS,
  DOSSIER_SOURCE_PAGE_PREFIX,
} from "@/constants/dossier"
import { matrixLabel } from "@/constants/units"
import { formatMeasurement, formatSampledDate } from "@/lib/format"
import { hasConfirmedPage } from "@/lib/source"
import type { DossierMeasurementRow } from "./dossier-model"

type MeasurementTableProps = {
  rows: DossierMeasurementRow[]
}

/**
 * Таблица измерений (роадмап §21.1, п. 6) — те же числа, что в бюллетене.
 * Значение остаётся кликабельным и в досье (критерий §16 п.5), а полные
 * названия и URL документов печатаются в разделе «Источники»: в колонке
 * достаточно издателя и страницы.
 */
export function MeasurementTable({ rows }: MeasurementTableProps) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground">{DOSSIER_NO_MEASUREMENTS}</p>
  }

  return (
    <table className="w-full border-collapse text-left text-xs">
      <thead>
        <tr className="border-b">
          {Object.values(DOSSIER_MEASUREMENT_COLUMNS).map((column) => (
            <th key={column} className="py-1.5 pr-3 font-medium last:pr-0">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ measurement, station, sourceDocument }) => {
          const sampledDate = formatSampledDate(measurement)
          const source = sourceDocument
            ? [
                sourceDocument.publisher,
                hasConfirmedPage(sourceDocument, measurement.sourcePage) &&
                  `${DOSSIER_SOURCE_PAGE_PREFIX} ${measurement.sourcePage}`,
              ]
                .filter((part): part is string => typeof part === "string")
                .join(", ")
            : null

          return (
            <tr
              key={measurement.id}
              className="break-inside-avoid border-b align-baseline"
            >
              <td className="py-1.5 pr-3 text-pretty">
                {station?.name ?? measurement.stationId}
              </td>
              <td className="py-1.5 pr-3">{measurement.indicator}</td>
              <td className="py-1.5 pr-3">{matrixLabel(measurement.matrix)}</td>
              <td className="py-1.5 pr-3 whitespace-nowrap">
                {sampledDate ?? (
                  <span className="text-muted-foreground">
                    {DOSSIER_NO_DATE}
                  </span>
                )}
              </td>
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
                    {formatMeasurement(measurement.value, measurement.unit)}
                  </span>
                )}
              </td>
              <td className="py-1.5 text-pretty text-muted-foreground">
                {source}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
