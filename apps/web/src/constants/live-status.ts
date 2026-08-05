import type { SourceHealthStatus } from "@/api/contracts"

// Состояния внешних источников (этап F6, роадмап §9.1 `GET /api/live/status`).
// Главный смысл экрана — отделить «источник недоступен» от «событий нет»:
// пустая лента при упавшем источнике не должна читаться как отсутствие
// загрязнения.

// Форма метки, а НЕ цвет: хром интерфейса ахроматичен (решение сессии 3),
// цвет несут только уровни доказательности §6. Красная точка рядом со схемой
// реки читалась бы с проектора как «опасность», то есть как запрещённая
// шкала (запрет 4). Смысл несёт подпись, метка её только поддерживает.
export type SourceHealthMark =
  "filled" | "ring" | "square" | "diamond" | "dashed"

export type SourceHealthMeta = {
  label: string
  /** Короткая форма для строки индикатора: «не опрашивались: 4». */
  shortLabel: string
  description: string
  mark: SourceHealthMark
  /** Чем больше, тем заметнее состояние: индикатор показывает худшее. */
  severity: number
}

export const SOURCE_HEALTH_META = {
  healthy: {
    label: "Отвечает",
    shortLabel: "отвечают",
    description: "Последний опрос прошёл без ошибок.",
    mark: "filled",
    severity: 0,
  },
  never_run: {
    label: "Ни разу не опрашивался",
    shortLabel: "не опрашивались",
    description:
      "Источник описан в конфигурации, но обращений к нему ещё не было.",
    mark: "dashed",
    severity: 1,
  },
  degraded: {
    label: "Отвечает с перебоями",
    shortLabel: "с перебоями",
    description:
      "Часть запросов завершается ошибкой: данные источника могут быть неполными.",
    mark: "ring",
    severity: 2,
  },
  rate_limited: {
    label: "Ограничение частоты запросов",
    shortLabel: "лимит запросов",
    description:
      "Источник временно отказывает в обслуживании по лимиту: обновление отложено.",
    mark: "square",
    severity: 3,
  },
  failed: {
    label: "Недоступен",
    shortLabel: "недоступны",
    description: "Последний опрос завершился ошибкой.",
    mark: "diamond",
    severity: 4,
  },
} as const satisfies Record<SourceHealthStatus, SourceHealthMeta>

export const LIVE_STATUS_TRIGGER_LABEL = "Источники"

export const LIVE_STATUS_TITLE = "Состояние данных"

export const LIVE_STATUS_SOURCES_TITLE = "Внешние источники"

// Ключевая оговорка этапа F6: недоступность источника не является выводом
// об отсутствии события.
export const LIVE_STATUS_DISCLAIMER =
  "Недоступный источник — это пробел в данных, а не отсутствие события: " +
  "экран показывает только то, что уже проверено."

export const LIVE_STATUS_LAST_SUCCESS_LABEL = "Последний успешный опрос"

export const LIVE_STATUS_NEVER_SUCCEEDED = "успешных опросов не было"

export const LIVE_STATUS_CACHE_AVAILABLE = "есть кэш последнего ответа"

export const LIVE_STATUS_CACHE_MISSING = "кэша нет"

export const LIVE_STATUS_ALL_HEALTHY = "все отвечают"

export const LIVE_STATUS_EMPTY =
  "Список источников пуст: опрашивать нечего, и это тоже состояние данных."

export const LIVE_STATUS_LOADING = "состояние уточняется"

// Сбой самого `GET /api/live/status` — тоже состояние источников, а не поломка
// экрана: остальные колонки продолжают показывать загруженные данные.
export const LIVE_STATUS_ERROR = "состояние источников не получено"
