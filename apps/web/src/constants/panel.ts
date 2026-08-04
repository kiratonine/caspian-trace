// Порядок блоков правой панели — строго по ТЗ §13, пункты 1–6.
// Номер блока — не декорация, а порядок чтения доказательств из ТЗ,
// поэтому порядок массива и есть контракт: панель рендерит его как есть.
export const CONCLUSION_SECTIONS = [
  { id: "conclusion", title: "Вывод" },
  { id: "evidenceLevel", title: "Уровень доказательности" },
  { id: "supportedFacts", title: "Что установлено" },
  { id: "contradictedHypotheses", title: "Что не подтверждается" },
  { id: "unknowns", title: "Что неизвестно" },
  { id: "sources", title: "Источники" },
] as const

export type ConclusionSectionId = (typeof CONCLUSION_SECTIONS)[number]["id"]

// Пустые состояния блоков — осторожные формулировки: отсутствие исключённых
// версий или фактов — это состояние данных, а не оценка чьей-то невиновности.
export const PANEL_NO_FACTS = "Установленных фактов нет."

export const PANEL_NO_REJECTED =
  "Ни одна конкретная версия пока не исключена фактами."

export const PANEL_NO_UNKNOWNS = "Пробелы в данных не перечислены."

export const PANEL_NO_SOURCES = "Документы-источники не приложены."
