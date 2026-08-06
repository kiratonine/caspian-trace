import { useTranslation } from "react-i18next"

import type { DossierObjectEntry } from "./dossier-model"

type CandidateObjectListProps = {
  entries: DossierObjectEntry[]
}

/** Документы-основания одной строкой; отсутствие оснований — тоже значение. */
function objectBasis(entry: DossierObjectEntry, noBasisText: string): string {
  return entry.evidenceDocuments.length > 0
    ? entry.evidenceDocuments.map((document) => document.title).join("; ")
    : noBasisText
}

/**
 * Объекты для проверки (роадмап §21.1, п. 10). Название компании в бумажном
 * документе допустимо только с явной подписью «объект для проверки» и вместе
 * с документами-основаниями: досье не утверждает ничьей причастности (ТЗ §4).
 */
export function CandidateObjectList({ entries }: CandidateObjectListProps) {
  const { t } = useTranslation()
  const noBasisText = t("dossier.objectNoBasis")
  if (entries.length === 0) {
    return <p className="text-muted-foreground">{t("dossier.noObjects")}</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry, index) => {
        const { object } = entry
        const basis = objectBasis(entry, noBasisText)
        // Одинаковое основание у соседей печатается один раз: два подряд
        // идентичных абзаца — шум, а не подсказка (решение сессии 15).
        const previous = entries[index - 1]
        const previousBasis = previous
          ? objectBasis(previous, noBasisText)
          : null

        return (
          <li
            key={object.id}
            className="flex break-inside-avoid flex-col gap-1"
          >
            <p className="text-pretty">
              <span className="font-medium">{object.name}</span>
              {" — "}
              {t("app.objectForReview")}
            </p>
            <p className="text-xs text-muted-foreground">
              {[
                object.category,
                object.waterBody,
                t(`dossier.completeness.${object.completeness}`),
              ]
                .filter((part): part is string => typeof part === "string")
                .join(" · ")}
            </p>
            {basis !== previousBasis && (
              <p className="text-xs text-pretty text-muted-foreground">
                {t("dossier.objectBasisLabel")}: {basis}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
