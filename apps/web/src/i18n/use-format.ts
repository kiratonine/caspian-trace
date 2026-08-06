import { useMemo } from "react"

import * as format from "@/lib/format"
import { useLocale } from "./use-locale"

/** Форматтеры, связанные с текущей локалью. Под ними — чистые функции
 *  `lib/format.ts` с явным параметром: их зовёт код вне React. */
export function useFormat() {
  const { locale } = useLocale()

  return useMemo(
    () => ({
      formatNumber: format.formatNumber,
      // Подпись единицы приходит готовой строкой из unitLabel(): справочник
      // единиц станет переводом в i18n-ресурсе, а lib/format.ts не должен
      // знать про i18next.
      formatMeasurement: (value: number, unitLabel: string) =>
        format.formatMeasurement(value, unitLabel),
      formatDate: (iso: string) => format.formatDate(iso, locale),
      formatDateTime: (iso: string) => format.formatDateTime(iso, locale),
      formatMonth: (isoMonth: string) => format.formatMonth(isoMonth, locale),
      formatSampledDate: (m: Parameters<typeof format.formatSampledDate>[0]) =>
        format.formatSampledDate(m, locale),
      formatObservedDate: (
        s: Parameters<typeof format.formatObservedDate>[0]
      ) => format.formatObservedDate(s, locale),
    }),
    [locale]
  )
}
