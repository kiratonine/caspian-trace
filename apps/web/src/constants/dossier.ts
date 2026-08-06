// Печатное досье (роадмап §21.1, состав экспорта). Документ уходит на бумагу
// и живёт дольше экрана, поэтому формулировки здесь ещё осторожнее, чем
// в интерфейсе: ни одна строка не должна читаться как утверждение о виновности
// (ТЗ §4, §17).

// Порядок разделов = состав досье из роадмапа §21.1, пункты 1–12 сверху вниз.
// Как и CONCLUSION_SECTIONS, массив и есть контракт: страница рендерит его
// как есть, и полноту состава видно в одном месте. Заголовки — в i18n-ресурсе
// (dossier.section.<id>), не здесь.
// `lead` — пункты 1–2: титул документа и оговорка. Они открывают лист
// и не получают заголовка раздела, но остаются в списке, чтобы состав §21.1
// не пришлось искать по компонентам.
export const DOSSIER_SECTIONS = [
  { id: "header", lead: true },
  { id: "disclaimer", lead: true },
  { id: "conclusion", lead: false },
  { id: "evidenceLevel", lead: false },
  { id: "signals", lead: false },
  { id: "measurements", lead: false },
  { id: "supportedFacts", lead: false },
  { id: "contradictedHypotheses", lead: false },
  { id: "unknowns", lead: false },
  { id: "candidateObjects", lead: false },
  { id: "sources", lead: false },
  { id: "provenance", lead: false },
] as const

export type DossierSectionId = (typeof DOSSIER_SECTIONS)[number]["id"]
