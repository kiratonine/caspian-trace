// Порядок блоков правой панели — строго по ТЗ §13, пункты 1–6.
// Номер блока — не декорация, а порядок чтения доказательств из ТЗ,
// поэтому порядок массива и есть контракт: панель рендерит его как есть.
// Заголовки блоков — в i18n-ресурсе (panel.section.<id>.title), не здесь:
// порядок и состав остаются кодом, текст переведён.
export const CONCLUSION_SECTIONS = [
  { id: "conclusion" },
  { id: "evidenceLevel" },
  { id: "supportedFacts" },
  { id: "contradictedHypotheses" },
  { id: "unknowns" },
  { id: "sources" },
] as const

export type ConclusionSectionId = (typeof CONCLUSION_SECTIONS)[number]["id"]
