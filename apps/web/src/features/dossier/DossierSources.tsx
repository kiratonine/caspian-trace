import { useTranslation } from "react-i18next"

import {
  DOSSIER_SHA_LABEL,
  DOSSIER_SHA_NOT_COMPUTED,
  DOSSIER_SOURCE_PAGE_PREFIX,
} from "@/constants/dossier"
import type { SourceEntry } from "@/features/conclusion/panel-model"
import { useFormat } from "@/i18n/use-format"
import { hasConfirmedPage, sourceHref } from "@/lib/source"

type DossierSourcesProps = {
  entries: SourceEntry[]
}

/**
 * Источники досье (роадмап §21.1, п. 11): URL, издатель, дата, SHA-256
 * и страница. В отличие от `SourceLink` на экране, ссылка печатается текстом:
 * на бумаге кликнуть нельзя, а проверить документ читатель обязан.
 */
export function DossierSources({ entries }: DossierSourcesProps) {
  const { t } = useTranslation()
  const { formatDate } = useFormat()
  if (entries.length === 0) {
    return <p className="text-muted-foreground">{t("panel.noSources")}</p>
  }

  return (
    <ol className="flex flex-col gap-3">
      {entries.map(({ document, page }) => {
        const href = sourceHref(document, page)
        const meta = [document.publisher]
        if (hasConfirmedPage(document, page)) {
          meta.push(`${DOSSIER_SOURCE_PAGE_PREFIX} ${page}`)
        }
        if (document.publishedAt) {
          meta.push(formatDate(document.publishedAt))
        }

        return (
          <li
            key={document.id}
            className="flex break-inside-avoid flex-col gap-0.5"
          >
            <p className="font-medium text-pretty">{document.title}</p>
            <p className="text-xs text-muted-foreground">{meta.join(" · ")}</p>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs break-all underline decoration-muted-foreground/40 underline-offset-3"
            >
              {href}
            </a>
            <p className="text-xs text-muted-foreground">
              {DOSSIER_SHA_LABEL}:{" "}
              {document.sha256 ? (
                <span className="font-mono break-all">{document.sha256}</span>
              ) : (
                // Пустой хэш не замалчиваем: читатель должен видеть, что
                // сверить целостность файла пока нечем.
                DOSSIER_SHA_NOT_COMPUTED
              )}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
