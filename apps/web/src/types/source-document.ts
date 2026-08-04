// ТЗ §8, таблица `source_documents`. Не менять без синхронизации с командой:
// файл 1:1 заменится импортом из packages/shared.
export type SourceDocument = {
  id: string
  title: string
  publisher: string
  url: string
  publishedAt: string | null
  fetchedAt: string | null
  contentType: "html" | "pdf" | "json"
  sha256: string | null
  cachePath: string | null
  status: "verified" | "unverified" | "unavailable"
}
