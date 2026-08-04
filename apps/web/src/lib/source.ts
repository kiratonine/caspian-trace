import type { SourceDocument } from "@/types"

/**
 * Ссылка на первоисточник. Для PDF с подтверждённой страницей добавляет
 * якорь `#page=N` (критерий приёмки №5 ТЗ §16: клик открывает документ
 * и страницу). `page = null` — страница не подтверждена (сентинел `0`
 * отменён обновлённым контрактом): открываем документ целиком.
 */
export function sourceHref(doc: SourceDocument, page?: number | null): string {
  if (hasConfirmedPage(doc, page)) {
    return `${doc.url}#page=${page}`
  }
  return doc.url
}

/** Страница подтверждена и имеет смысл в ссылке/подписи. */
export function hasConfirmedPage(
  doc: SourceDocument,
  page?: number | null
): page is number {
  // Нумерация страниц в контракте положительная (`int().positive()`),
  // так что 0 и отрицательные — заведомо не страница.
  return doc.contentType === "pdf" && page != null && page > 0
}
