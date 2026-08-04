import type { Feature, LineString, Polygon } from "geojson"
import type { EvidenceStatement } from "./evidence-statement"

// ТЗ §8, таблица `investigations`.
export type EvidenceLevel = "L0" | "L1" | "L2" | "L3"

export type Investigation = {
  id: string
  title: string
  signalIds: string[]
  indicator: string
  evidenceLevel: EvidenceLevel
  corridor: Feature<LineString | Polygon> | null
  supportedFacts: EvidenceStatement[]
  contradictedHypotheses: EvidenceStatement[]
  unknowns: string[]
  conclusion: string
  updatedAt: string
}
