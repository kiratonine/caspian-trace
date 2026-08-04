import { ExternalLink } from "lucide-react"

import { formatDate } from "@/lib/format"
import { hasConfirmedPage, sourceHref } from "@/lib/source"
import { cn } from "@/lib/utils"
import type { SourceDocument } from "@/types"

type SourceLinkProps = {
  sourceDocument: SourceDocument
  /** Страница PDF; null — страница не подтверждена, в подписи не показывается. */
  page?: number | null
  className?: string
}

/**
 * Ссылка на первоисточник: название, издатель, страница и хэш (ТЗ §13, блок 6).
 * Каждое утверждение продукта должно вести к документу, который можно открыть.
 */
export function SourceLink({
  sourceDocument,
  page,
  className,
}: SourceLinkProps) {
  const meta = [sourceDocument.publisher]
  if (hasConfirmedPage(sourceDocument, page)) {
    meta.push(`стр. ${page}`)
  }
  if (sourceDocument.publishedAt) {
    meta.push(formatDate(sourceDocument.publishedAt))
  }

  return (
    <a
      href={sourceHref(sourceDocument, page)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group/source flex flex-col gap-0.5 outline-none",
        className
      )}
    >
      <span className="text-sm underline decoration-muted-foreground/40 underline-offset-3 group-hover/source:decoration-current group-focus-visible/source:decoration-current">
        {sourceDocument.title}
        <ExternalLink
          aria-hidden
          className="ml-1 inline size-3 align-baseline text-muted-foreground"
        />
      </span>
      <span className="text-xs text-muted-foreground">
        {meta.join(" · ")}
        {sourceDocument.sha256 && (
          // Полный SHA-256 — в title; на экране достаточно префикса для сверки.
          <span title={`SHA-256: ${sourceDocument.sha256}`}>
            {" · "}
            <span className="font-mono">
              {sourceDocument.sha256.slice(0, 8)}
            </span>
          </span>
        )}
      </span>
    </a>
  )
}
