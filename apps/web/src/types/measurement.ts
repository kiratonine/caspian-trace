// Контракт измерения — роадмап §7 (`MeasurementSchema`), он же MVP-форма ответа
// `GET /api/incidents/:id`. Заменяет описание ТЗ §8: сентинел `sourcePage = 0`
// отменён, дата отбора разделена на точную и период.
export type Measurement = {
  id: string
  stationId: string
  /** Точная дата отбора; null — в источнике её нет, смотреть `sampledPeriod`. */
  sampledAt: string | null
  /** Период отбора ('2025-09'); null — период не определён. */
  sampledPeriod: string | null
  indicator: string
  value: number
  // unit и matrix в контракте — свободные строки: бэк отдаёт значение так,
  // как оно стоит в бюллетене, а не приводит к нашему юниону.
  unit: string
  matrix: string
  sourceDocumentId: string
  /** Страница документа; null — страница не подтверждена, якорь `#page=` не ставим. */
  sourcePage: number | null
  sourceExcerpt: string
}
