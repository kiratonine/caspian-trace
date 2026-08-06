import { useTranslation } from "react-i18next"

import { SourceLink } from "@/components/common"
import type { SourceEntry } from "./panel-model"

type SourcesListProps = {
  entries: SourceEntry[]
}

/** Блок 6 §13: кликабельные документы; страница — из ссылающегося измерения. */
export function SourcesList({ entries }: SourcesListProps) {
  const { t } = useTranslation()
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("panel.noSources")}</p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {entries.map(({ document, page }) => (
        <li key={document.id}>
          <SourceLink sourceDocument={document} page={page} />
        </li>
      ))}
    </ul>
  )
}
