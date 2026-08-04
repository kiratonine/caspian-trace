// ТЗ §8, таблица `candidate_objects`. Всегда «объект для проверки», никогда не «виновник».
export type CandidateObject = {
  id: string
  name: string
  category: string
  location: { lat: number; lon: number } | null
  waterBody: string | null
  riverOrder: number | null
  evidenceDocumentIds: string[]
  completeness: "confirmed" | "partial"
}
