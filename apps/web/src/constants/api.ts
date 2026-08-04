// Фолбэк обязателен: сборка и демо работают без .env (критерий приёмки — полный офлайн).
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "/api"

// Роадмап §9.1: параметр limit у GET /api/incidents, максимум 100.
export const MAX_INCIDENTS_LIMIT = 100

export type DataMode = "api" | "seed"

// Режим данных (этап F2): 'api' — ходить в NestJS, 'seed' — отдавать проверенные
// данные из `src/api/seed-data.ts`. По умолчанию 'seed', ПОКА read-эндпоинты не
// подняты: демо обязано работать без бэкенда и без `.env`, а запросы к
// несуществующему `/api` выглядели бы на экране как поломка данных.
// После контрольной точки C дефолт меняется здесь одной строкой.
export const DATA_MODE: DataMode =
  import.meta.env.VITE_DATA_MODE === "api" ? "api" : "seed"

// Потолок ожидания ответа. Сеть демо локальная: 8 с с запасом покрывают холодный
// старт NestJS, но не дают запросу висеть бесконечно во время показа.
export const API_TIMEOUT_MS = 8_000

// Единственные данные, которые во время показа меняются: состояние источников.
// Остальные запросы живут с `staleTime: Infinity` (решение сессии 3).
export const LIVE_STATUS_STALE_TIME_MS = 60_000
