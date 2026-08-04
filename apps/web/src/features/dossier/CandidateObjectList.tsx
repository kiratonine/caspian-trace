import {
  DOSSIER_COMPLETENESS_LABELS,
  DOSSIER_NO_OBJECTS,
  DOSSIER_OBJECT_BASIS_LABEL,
  DOSSIER_OBJECT_NO_BASIS,
} from "@/constants/dossier"
import { OBJECT_FOR_REVIEW_LABEL } from "@/constants/strings"
import type { DossierObjectEntry } from "./dossier-model"

type CandidateObjectListProps = {
  entries: DossierObjectEntry[]
}

/**
 * Объекты для проверки (роадмап §21.1, п. 10). Название компании в бумажном
 * документе допустимо только с явной подписью «объект для проверки» и вместе
 * с документами-основаниями: досье не утверждает ничьей причастности (ТЗ §4).
 */
export function CandidateObjectList({ entries }: CandidateObjectListProps) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground">{DOSSIER_NO_OBJECTS}</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {entries.map(({ object, evidenceDocuments }) => (
        <li key={object.id} className="flex break-inside-avoid flex-col gap-1">
          <p className="text-pretty">
            <span className="font-medium">{object.name}</span>
            {" — "}
            {OBJECT_FOR_REVIEW_LABEL}
          </p>
          <p className="text-xs text-muted-foreground">
            {[
              object.category,
              object.waterBody,
              DOSSIER_COMPLETENESS_LABELS[object.completeness],
            ]
              .filter((part): part is string => typeof part === "string")
              .join(" · ")}
          </p>
          <p className="text-xs text-pretty text-muted-foreground">
            {DOSSIER_OBJECT_BASIS_LABEL}:{" "}
            {evidenceDocuments.length > 0
              ? evidenceDocuments.map((document) => document.title).join("; ")
              : DOSSIER_OBJECT_NO_BASIS}
          </p>
        </li>
      ))}
    </ul>
  )
}
