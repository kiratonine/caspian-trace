// Контракт сигнала — роадмап §6.2/§6.3 (модель `IncidentSignal` и таблица
// `incident_signals`). Отличия от ТЗ §8 отмечены комментариями.

// Известные явления ТЗ §8. В схеме БД `phenomenon` — свободный текст без
// check-ограничения (в отличие от `extraction_mode` и `verification_status`),
// поэтому это справочник известных значений, а не закрытый список поля.
export type Phenomenon =
  | "oil_film"
  | "color_change"
  | "odor"
  | "fish_kill"
  | "wastewater"
  | "other"

// Роадмап §7 (`VerificationStatusSchema`) добавил к трём значениям ТЗ §8
// четвёртое: источники по одному сигналу могут расходиться.
export type VerificationStatus =
  | "unverified"
  | "corroborated"
  | "official"
  | "conflicting"

export type IncidentSignal = {
  id: string
  title: string
  /** Точная дата наблюдения; null — в сообщении её нет, смотреть `observedPeriod`. */
  observedAt: string | null
  /** Период наблюдения ('2025-09'); null — период не определён. */
  observedPeriod: string | null
  reportedAt: string
  location: { lat: number; lon: number } | null
  locationText: string
  phenomenon: string
  excerpt: string
  sourceDocumentId: string
  // Значения по check-ограничению таблицы: у ТЗ §8 было 'llm', в схеме бэка —
  // 'llm_verified' (извлечённое LLM и прошедшее проверку).
  extractionMode: "llm_verified" | "rule" | "verified_seed"
  verificationStatus: VerificationStatus
}
