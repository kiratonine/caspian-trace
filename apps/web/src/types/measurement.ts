// ТЗ §8, таблица `measurements`.
export type Measurement = {
  id: string
  stationId: string
  sampledAt: string | null
  sampledPeriod: string | null
  indicator: string
  value: number
  rawValueText: string
  unit: "mg/dm3" | "mg/kg" | "percent"
  matrix: "water" | "sediment"
  qualityClass: number | null
  sourceDocumentId: string
  sourcePage: number | null
  sourceExcerpt: string | null
  verified: boolean
}
