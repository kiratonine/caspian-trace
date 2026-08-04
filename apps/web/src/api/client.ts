import { API_BASE_URL } from "@/constants/api"

// Тонкая обёртка над fetch. Пока функции ресурсов — заглушки; по мере готовности
// бэка каждая переключается на apiGet/apiPost правкой своего модуля.

type QueryParams = Record<string, string | number | undefined>

export function buildApiUrl(path: string, params?: QueryParams): URL {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
  }
  return url
}

export async function apiGet<T>(
  path: string,
  params?: QueryParams
): Promise<T> {
  const response = await fetch(buildApiUrl(path, params))
  if (!response.ok) throw new Error(`GET ${path}: HTTP ${response.status}`)
  return (await response.json()) as T
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    method: "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`POST ${path}: HTTP ${response.status}`)
  return (await response.json()) as T
}

export async function apiDownload(
  path: string,
  params?: QueryParams
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(buildApiUrl(path, params))
  if (!response.ok) throw new Error(`GET ${path}: HTTP ${response.status}`)
  const disposition = response.headers.get("content-disposition") ?? ""
  const filename = /filename="([^"]+)"/i.exec(disposition)?.[1] ?? "dossier"
  return { blob: await response.blob(), filename }
}

// Разовый warn на заглушку — на интеграции забытые заглушки видны в консоли
// (правило docs/stubs.md).
const warnedStubs = new Set<string>()

export function warnStubOnce(message: string): void {
  if (warnedStubs.has(message)) return
  warnedStubs.add(message)
  console.warn(`STUB: ${message}`)
}
