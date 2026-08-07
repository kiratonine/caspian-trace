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
  mark: SourceHealthMark
  /** Чем больше, тем заметнее состояние: индикатор показывает худшее. */
  severity: number
}

// label/shortLabel/description — в i18n-ресурсе (liveStatus.sourceHealth.<status>),
// не здесь: mark и severity остаются кодом, они определяют форму и порядок,
// а не текст.
export const SOURCE_HEALTH_META = {
  healthy: { mark: "filled", severity: 0 },
  never_run: { mark: "dashed", severity: 1 },
  degraded: { mark: "ring", severity: 2 },
  rate_limited: { mark: "square", severity: 3 },
  failed: { mark: "diamond", severity: 4 },
} as const satisfies Record<SourceHealthStatus, SourceHealthMeta>
