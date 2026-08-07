import { ApiErrorSchema } from "@caspian-trace/contracts"

import { API_BASE_URL, API_TIMEOUT_MS, DATA_MODE } from "@/constants/api"

// Единственное место, где фронт разговаривает с сетью. Правила границы:
//   • ответ проверяется схемой из `@caspian-trace/contracts`, `as T` запрещён;
//   • у каждого запроса есть таймаут и он слушает `AbortSignal` вызывающего;
//   • любая неудача превращается в `ApiRequestError` с формой `{code, message,
//     requestId}` — той же, что отдаёт NestJS;
//   • отмена запроса ошибкой НЕ считается: наверх уходит исходный `AbortError`,
//     и TanStack Query трактует его как отмену, а не как сбой источника.

/**
 * Схема ответа. Структурный тип вместо импорта из `zod`: схемы приходят
 * из пакета контрактов, который zod уже тянет, и объявлять его второй раз
 * в зависимостях фронта незачем.
 */
export type ResponseSchema<T> = { parse: (value: unknown) => T }

/** Режим офлайн-демо: данные берутся из `seed-data.ts`, сеть не трогается. */
export const IS_SEED_MODE = DATA_MODE === "seed"

/** Коды, которые фронт порождает сам; остальные приходят от бэка. */
export const CLIENT_ERROR_CODES = {
  /** Сеть недоступна или запрос не дошёл. */
  networkUnavailable: "NETWORK_UNAVAILABLE",
  /** Ответ не пришёл за `API_TIMEOUT_MS`. */
  timeout: "TIMEOUT",
  /** Ответ пришёл, но не совпал со схемой контракта. */
  invalidResponse: "INVALID_RESPONSE",
} as const

export class ApiRequestError extends Error {
  readonly code: string
  /** Идентификатор запроса из ответа бэка; null — ответа не было. */
  readonly requestId: string | null
  readonly status: number | null

  constructor(
    code: string,
    message: string,
    options: { requestId?: string | null; status?: number | null } = {}
  ) {
    super(message)
    this.name = "ApiRequestError"
    this.code = code
    this.requestId = options.requestId ?? null
    this.status = options.status ?? null
  }
}

type QueryParams = Record<string, string | number | undefined>

type RequestOptions = {
  params?: QueryParams
  body?: unknown
  signal?: AbortSignal
}

function buildUrl(path: string, params?: QueryParams): URL {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
  }
  return url
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

/** Тело ошибки бэка, если оно совпало с контрактом `ApiError`. */
async function readApiError(
  response: Response
): Promise<{ code: string; message: string; requestId: string } | null> {
  try {
    const parsed = ApiErrorSchema.safeParse(await response.json())
    return parsed.success ? parsed.data : null
  } catch {
    // Тело не JSON или пустое — ниже соберём ошибку из статуса.
    return null
  }
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  schema: ResponseSchema<T>,
  options: RequestOptions = {}
): Promise<T> {
  const timeoutSignal = AbortSignal.timeout(API_TIMEOUT_MS)
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.params), {
      method,
      signal,
      headers:
        options.body === undefined
          ? undefined
          : { "Content-Type": "application/json" },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch (error) {
    // Отмену вызывающим пробрасываем как есть: это не сбой источника.
    if (options.signal?.aborted) throw error
    if (isAbortError(error) || timeoutSignal.aborted) {
      throw new ApiRequestError(
        CLIENT_ERROR_CODES.timeout,
        `${method} ${path}: ответ не пришёл за ${API_TIMEOUT_MS} мс`
      )
    }
    throw new ApiRequestError(
      CLIENT_ERROR_CODES.networkUnavailable,
      `${method} ${path}: не удалось связаться с API`
    )
  }

  if (!response.ok) {
    const apiError = await readApiError(response)
    throw new ApiRequestError(
      apiError?.code ?? `HTTP_${response.status}`,
      apiError?.message ?? `${method} ${path}: HTTP ${response.status}`,
      { requestId: apiError?.requestId ?? null, status: response.status }
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiRequestError(
      CLIENT_ERROR_CODES.invalidResponse,
      `${method} ${path}: ответ не является JSON`,
      { status: response.status }
    )
  }

  try {
    return schema.parse(payload)
  } catch (error) {
    // Расхождение с контрактом — ошибка интеграции, а не данных: показать её
    // нужно громко, иначе UI молча отрисует половину полей.
    throw new ApiRequestError(
      CLIENT_ERROR_CODES.invalidResponse,
      `${method} ${path}: ответ не совпал с контрактом — ${
        error instanceof Error ? error.message : String(error)
      }`,
      { status: response.status }
    )
  }
}

export function apiGet<T>(
  path: string,
  schema: ResponseSchema<T>,
  options: Omit<RequestOptions, "body"> = {}
): Promise<T> {
  return request("GET", path, schema, options)
}

export function apiPost<T>(
  path: string,
  schema: ResponseSchema<T>,
  options: RequestOptions = {}
): Promise<T> {
  return request("POST", path, schema, options)
}

/**
 * Проверка офлайн-данных той же схемой, что и ответа сети. Сид — это тоже
 * «ответ», просто из файла: если он разойдётся с контрактом после правки
 * `@caspian-trace/contracts`, узнать об этом надо сразу, а не на интеграции.
 * Стоимость — разбор трёх событий, о ней можно не думать.
 */
export function parseSeed<T>(
  schema: ResponseSchema<T>,
  value: unknown,
  label: string
): T {
  try {
    return schema.parse(value)
  } catch (error) {
    throw new ApiRequestError(
      CLIENT_ERROR_CODES.invalidResponse,
      `${label}: seed-данные не совпали с контрактом — ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

// Разовый warn на заглушку — на интеграции забытые заглушки видны в консоли
// (правило docs/stubs.md).
const warnedStubs = new Set<string>()

export function warnStubOnce(message: string): void {
  if (warnedStubs.has(message)) return
  warnedStubs.add(message)
  console.warn(`STUB: ${message}`)
}
