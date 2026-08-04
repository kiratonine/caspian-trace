import type { SourceDocument } from "@/types"

/**
 * Ссылка на первоисточник. Для PDF с подтверждённой страницей добавляет
 * якорь `#page=N` (критерий приёмки №5 ТЗ §16: клик открывает документ
 * и страницу). `page = 0` — сентинел «страница не перепроверена»
 * (вопрос 8 плана): якорь не ставим, открываем документ целиком.
 */
export function sourceHref(doc: SourceDocument, page?: number): string {
  if (doc.contentType === "pdf" && page !== undefined && page > 0) {
    return `${doc.url}#page=${page}`
  }
  return doc.url
}

/** Страница подтверждена и имеет смысл в ссылке/подписи. */
export function hasConfirmedPage(
  doc: SourceDocument,
  page?: number
): page is number {
  return doc.contentType === "pdf" && page !== undefined && page > 0
}
